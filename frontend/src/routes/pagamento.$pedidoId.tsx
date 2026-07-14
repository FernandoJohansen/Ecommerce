import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { ApiError, apiFetch } from "@/lib/api";
import { formatarPreco } from "@/lib/precos";

export const Route = createFileRoute("/pagamento/$pedidoId")({
  component: PagamentoPage,
});

type CobrancaPix = {
  txid: string;
  pedido_id: string;
  status: string;
  valor_centavos: number;
  brcode: string | null;
  qrcode: string | null;
};

function PagamentoPage() {
  const { pedidoId } = Route.useParams();
  const queryClient = useQueryClient();
  const [copiado, setCopiado] = useState(false);

  // POST é idempotente no backend: reaproveita a cobrança ativa do pedido
  const criar = useQuery<CobrancaPix>({
    queryKey: ["pix-cobranca", pedidoId],
    queryFn: () =>
      apiFetch("/pagamento/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId }),
      }),
    staleTime: Infinity,
    retry: false,
  });

  const txid = criar.data?.txid;
  const status = useQuery<CobrancaPix>({
    queryKey: ["pix-status", txid],
    queryFn: () => apiFetch(`/pagamento/pix/${txid}`),
    enabled: !!txid,
    refetchInterval: (query) => (query.state.data?.status === "ATIVA" ? 5000 : false),
  });

  const cobranca = status.data ?? criar.data;
  const indisponivel = criar.error instanceof ApiError && criar.error.status === 503;
  const pago = cobranca?.status === "CONCLUIDA";
  const removida = cobranca !== undefined && cobranca.status.startsWith("REMOVIDA");

  const copiar = async () => {
    if (!cobranca?.brcode) return;
    await navigator.clipboard.writeText(cobranca.brcode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const novaCobranca = () => {
    queryClient.removeQueries({ queryKey: ["pix-status"] });
    queryClient.invalidateQueries({ queryKey: ["pix-cobranca", pedidoId] });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Pagamento</span>
          </Link>
          <Button
            asChild
            variant="outline"
            className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
          >
            <Link to="/">Loja</Link>
          </Button>
        </div>

        <div className="border border-border p-8 text-center sm:p-12">
          {criar.isPending && (
            <p className="text-sm text-muted-foreground">Gerando cobrança PIX…</p>
          )}

          {indisponivel && (
            <>
              <p className="serif mb-4 text-2xl">Pedido confirmado!</p>
              <p className="mb-8 text-sm text-muted-foreground">
                O pagamento por PIX está indisponível no momento. Recebemos o seu pedido e
                entraremos em contato pelo WhatsApp para combinar o pagamento e a entrega.
              </p>
              <Button
                asChild
                className="rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
              >
                <Link to="/">Voltar à loja</Link>
              </Button>
            </>
          )}

          {criar.isError && !indisponivel && (
            <>
              <p className="mb-6 text-sm text-destructive">
                {criar.error instanceof ApiError && criar.error.detail
                  ? criar.error.detail
                  : "Não foi possível gerar a cobrança PIX."}
              </p>
              <Button
                onClick={novaCobranca}
                variant="outline"
                className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
              >
                Tentar novamente
              </Button>
            </>
          )}

          {pago && (
            <>
              <p className="serif mb-4 text-2xl">Pagamento confirmado!</p>
              <p className="mb-2 text-sm text-muted-foreground">
                Total: {formatarPreco(cobranca!.valor_centavos)}
              </p>
              <p className="mb-8 text-sm text-muted-foreground">
                Recebemos o seu pagamento. Entraremos em contato pelo WhatsApp para combinar a
                entrega.
              </p>
              <Button
                asChild
                className="rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
              >
                <Link to="/">Voltar à loja</Link>
              </Button>
            </>
          )}

          {removida && (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                Esta cobrança PIX expirou ou foi cancelada.
              </p>
              <Button
                onClick={novaCobranca}
                variant="outline"
                className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
              >
                Gerar nova cobrança
              </Button>
            </>
          )}

          {cobranca && cobranca.status === "ATIVA" && (
            <>
              <p className="serif mb-2 text-2xl">Pague com PIX</p>
              <p className="mb-6 text-sm text-muted-foreground">
                Total: {formatarPreco(cobranca.valor_centavos)}
              </p>
              {cobranca.qrcode && (
                <img
                  src={cobranca.qrcode}
                  alt="QR Code PIX"
                  className="mx-auto mb-6 h-56 w-56 border border-border"
                />
              )}
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Escaneie o QR Code ou use o copia e cola
              </p>
              {cobranca.brcode && (
                <div className="mb-6">
                  <p className="mb-3 break-all border border-border p-3 text-left font-mono text-[10px] text-muted-foreground">
                    {cobranca.brcode}
                  </p>
                  <Button
                    onClick={copiar}
                    variant="outline"
                    className="w-full rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
                  >
                    {copiado ? "Copiado!" : "Copiar código PIX"}
                  </Button>
                </div>
              )}
              <p className="animate-pulse text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Aguardando pagamento…
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                A confirmação é automática. Você pode fechar esta página e acompanhar o pedido em{" "}
                <Link to="/pedidos" className="underline">
                  Meus pedidos
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
