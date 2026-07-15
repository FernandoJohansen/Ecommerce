import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { formatarPreco } from "@/lib/precos";
import { PagamentoConfirmado, type PagamentoMp } from "./comum";

type Props = {
  pedidoId: string;
  temCpf: boolean;
};

const formatarVencimento = (iso: string | null) => {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? null
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function BoletoView({ pedidoId, temCpf }: Props) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Idempotente no backend: reload devolve o mesmo boleto pendente do pedido
  const gerar = useMutation({
    mutationFn: (): Promise<PagamentoMp> =>
      apiFetch("/pagamento/boleto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId, email: email.trim() }),
      }),
  });

  const poll = useQuery<PagamentoMp>({
    queryKey: ["mp-status", gerar.data?.id],
    queryFn: () => apiFetch(`/pagamento/mp/${gerar.data!.id}`),
    enabled: gerar.data !== undefined && gerar.data.situacao === "pendente",
    // Boleto não muda em segundos; 30s é suficiente
    refetchInterval: (query) => (query.state.data?.situacao === "pendente" ? 30000 : false),
  });
  const boleto = poll.data ?? gerar.data;

  // Some o seletor de métodos e atualiza o status do pedido na página
  const aprovado = boleto?.situacao === "aprovado";
  useEffect(() => {
    if (aprovado) {
      queryClient.invalidateQueries({ queryKey: ["pagamento-resumo", pedidoId] });
    }
  }, [aprovado, pedidoId, queryClient]);

  if (!temCpf) {
    return (
      <p className="text-sm text-muted-foreground">
        Este pedido não tem CPF cadastrado, obrigatório para boleto. Pague por PIX ou refaça o
        pedido.
      </p>
    );
  }

  if (boleto?.situacao === "aprovado") {
    return <PagamentoConfirmado valorCentavos={boleto.valor_centavos} />;
  }

  if (boleto && boleto.situacao !== "pendente") {
    return (
      <>
        <p className="mb-6 text-sm text-muted-foreground">Este boleto venceu ou foi cancelado.</p>
        <Button
          onClick={() => gerar.mutate()}
          disabled={gerar.isPending}
          variant="outline"
          className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
        >
          {gerar.isPending ? "Gerando…" : "Gerar novo boleto"}
        </Button>
      </>
    );
  }

  if (boleto) {
    const vencimento = formatarVencimento(boleto.boleto_vencimento);
    const copiar = async () => {
      if (!boleto.boleto_linha_digitavel) return;
      await navigator.clipboard.writeText(boleto.boleto_linha_digitavel);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    };
    return (
      <>
        <p className="serif mb-2 text-2xl">Pague com boleto</p>
        <p className="mb-6 text-sm text-muted-foreground">
          Total: {formatarPreco(boleto.valor_centavos)}
          {vencimento ? ` · vence em ${vencimento}` : ""}
        </p>
        {boleto.boleto_linha_digitavel && (
          <div className="mb-6">
            <p className="mb-3 break-all border border-border p-3 text-left font-mono text-xs text-muted-foreground">
              {boleto.boleto_linha_digitavel}
            </p>
            <Button
              onClick={copiar}
              variant="outline"
              className="w-full rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
            >
              {copiado ? "Copiado!" : "Copiar linha digitável"}
            </Button>
          </div>
        )}
        {boleto.boleto_url && (
          <Button
            asChild
            className="mb-6 w-full rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
          >
            <a href={boleto.boleto_url} target="_blank" rel="noreferrer">
              Abrir boleto (PDF)
            </a>
          </Button>
        )}
        <p className="animate-pulse text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Aguardando pagamento…
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          O boleto compensa em até 3 dias úteis após o pagamento. A confirmação aqui é automática.
        </p>
      </>
    );
  }

  const submeter = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErroEmail("Informe um e-mail válido");
      return;
    }
    setErroEmail(null);
    gerar.mutate();
  };

  return (
    <>
      <p className="serif mb-2 text-2xl">Pague com boleto</p>
      <p className="mb-6 text-sm text-muted-foreground">
        Informe seu e-mail para gerar o boleto. Ele vence em 3 dias e compensa em até 3 dias úteis
        após o pagamento.
      </p>
      <div className="mb-6 space-y-2 text-left">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">E-mail</Label>
        <Input
          type="email"
          value={email}
          placeholder="voce@email.com"
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-none border-0 border-b border-foreground bg-transparent px-0"
        />
        {erroEmail && <p className="text-xs text-destructive">{erroEmail}</p>}
      </div>
      {gerar.isError && (
        <p className="mb-4 text-sm text-destructive">
          {gerar.error instanceof ApiError && gerar.error.detail
            ? gerar.error.detail
            : "Não foi possível gerar o boleto. Tente novamente."}
        </p>
      )}
      <Button
        onClick={submeter}
        disabled={gerar.isPending}
        className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {gerar.isPending ? "Gerando…" : "Gerar boleto"}
      </Button>
    </>
  );
}
