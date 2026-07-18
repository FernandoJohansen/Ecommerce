import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { ApiError, apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { formatarPreco } from "@/lib/precos";

export const Route = createFileRoute("/rastreio/$pedidoId")({
  component: RastreioPage,
});

type PedidoItem = {
  id: string;
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
  subtotal_centavos: number;
};

type Pedido = {
  id: string;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  total_centavos: number;
  frete_centavos: number;
  frete_servico: string | null;
  frete_prazo_dias: number | null;
  codigo_rastreio: string | null;
  status: string;
  created_at: string | null;
  itens: PedidoItem[];
};

const ETAPAS = [
  { chave: "recebido", label: "Pedido recebido" },
  { chave: "pago", label: "Pagamento confirmado" },
  { chave: "enviado", label: "Enviado" },
  { chave: "entregue", label: "Entregue" },
] as const;

// Quantas etapas da linha do tempo cada status do pedido completa
const ETAPA_POR_STATUS: Record<string, number> = {
  novo: 1,
  em_andamento: 1,
  pago: 2,
  enviado: 3,
  concluido: 4,
};

function linkTransportadora(freteServico: string | null, codigo: string): string | null {
  const servico = (freteServico ?? "").toLowerCase();
  if (/correios|pac|sedex|mini envios/.test(servico)) {
    return `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(codigo)}`;
  }
  if (servico.includes("jadlog")) {
    return `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${encodeURIComponent(codigo)}`;
  }
  return null;
}

function RastreioPage() {
  const { pedidoId } = Route.useParams();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    setChecked(true);
  }, [navigate]);

  const {
    data: pedido,
    isLoading,
    error,
  } = useQuery<Pedido>({
    queryKey: ["meu-pedido", pedidoId],
    queryFn: () => apiFetch(`/pedidos/meus/${pedidoId}`),
    enabled: checked,
    // Pedido a caminho pode mudar de status a qualquer momento
    refetchInterval: (query) =>
      query.state.data && ["concluido", "cancelado"].includes(query.state.data.status)
        ? false
        : 30_000,
  });

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Acompanhar pedido</span>
          </Link>
          <Button
            asChild
            variant="outline"
            className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
          >
            <Link to="/pedidos">Meus pedidos</Link>
          </Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando pedido…</p>}

        {error != null && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError && error.status === 404
              ? "Pedido não encontrado."
              : "Não foi possível carregar o pedido."}
          </p>
        )}

        {pedido && <Rastreio pedido={pedido} />}
      </div>
    </div>
  );
}

function Rastreio({ pedido }: { pedido: Pedido }) {
  const [copiado, setCopiado] = useState(false);
  const cancelado = pedido.status === "cancelado";
  const etapaAtual = ETAPA_POR_STATUS[pedido.status] ?? 0;

  const copiarRastreio = async () => {
    if (!pedido.codigo_rastreio) return;
    await navigator.clipboard.writeText(pedido.codigo_rastreio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const linkExterno = pedido.codigo_rastreio
    ? linkTransportadora(pedido.frete_servico, pedido.codigo_rastreio)
    : null;

  return (
    <div className="space-y-6">
      <div className="border border-border p-6 sm:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Pedido de{" "}
            {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString("pt-BR") : "—"}
          </span>
          {cancelado && (
            <span className="border border-foreground px-3 py-1 text-xs uppercase tracking-[0.2em]">
              Cancelado
            </span>
          )}
        </div>

        {cancelado ? (
          <p className="text-sm text-muted-foreground">
            Este pedido foi cancelado. Em caso de dúvida, fale com a gente pelo WhatsApp.
          </p>
        ) : (
          <ol className="space-y-0">
            {ETAPAS.map((etapa, i) => {
              const feita = i < etapaAtual;
              const ultima = i === ETAPAS.length - 1;
              return (
                <li key={etapa.chave} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex size-3 shrink-0 border border-foreground ${
                        feita ? "bg-foreground" : "bg-background"
                      }`}
                      aria-hidden
                    />
                    {!ultima && (
                      <span
                        className={`w-px flex-1 ${i < etapaAtual - 1 ? "bg-foreground" : "bg-border"}`}
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className={ultima ? "" : "pb-8"}>
                    <p
                      className={`text-xs uppercase tracking-[0.2em] ${
                        feita ? "" : "text-muted-foreground"
                      }`}
                    >
                      {etapa.label}
                    </p>
                    {etapa.chave === "recebido" && pedido.status === "novo" && (
                      <p className="mt-1 text-sm text-muted-foreground">Aguardando pagamento.</p>
                    )}
                    {etapa.chave === "recebido" && pedido.status === "em_andamento" && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pedido em andamento — combinamos os detalhes pelo WhatsApp.
                      </p>
                    )}
                    {etapa.chave === "enviado" &&
                      pedido.status === "enviado" &&
                      pedido.frete_prazo_dias != null && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Prazo estimado: {pedido.frete_prazo_dias}{" "}
                          {pedido.frete_prazo_dias === 1 ? "dia útil" : "dias úteis"} após a
                          postagem.
                        </p>
                      )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {pedido.status === "novo" && (
          <Button asChild className="mt-8 w-full rounded-none text-xs uppercase tracking-[0.2em]">
            <Link to="/pagamento/$pedidoId" params={{ pedidoId: pedido.id }}>
              Pagar agora
            </Link>
          </Button>
        )}
      </div>

      {pedido.codigo_rastreio && !cancelado && (
        <div className="border border-border p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Código de rastreio{pedido.frete_servico ? ` — ${pedido.frete_servico}` : ""}
          </p>
          <p className="mt-2 font-mono text-sm">{pedido.codigo_rastreio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copiarRastreio}
              className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </Button>
            {linkExterno && (
              <Button asChild size="sm" className="rounded-none text-xs uppercase tracking-[0.1em]">
                <a href={linkExterno} target="_blank" rel="noopener noreferrer">
                  Rastrear na transportadora
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {pedido.rua && (
        <div className="border border-border p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Endereço de entrega
          </p>
          <p className="mt-2 text-sm">
            {pedido.rua}, {pedido.numero}
            {pedido.complemento ? ` — ${pedido.complemento}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {pedido.bairro} · {pedido.cidade}/{pedido.estado}
            {pedido.cep ? ` · CEP ${pedido.cep}` : ""}
          </p>
        </div>
      )}

      <div className="border border-border p-6 sm:p-8">
        <ul className="mb-6 space-y-2 text-sm">
          {pedido.itens.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span>
                {item.quantidade}× {item.produto_nome} {item.tamanho} · {item.aroma}
                {item.refil ? " · com refil" : ""}
              </span>
              <span className="whitespace-nowrap text-muted-foreground">
                {formatarPreco(item.subtotal_centavos)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-border pt-4 text-sm font-medium">
          <span>Total</span>
          <span>{formatarPreco(pedido.total_centavos)}</span>
        </div>
      </div>
    </div>
  );
}
