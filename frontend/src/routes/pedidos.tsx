import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { statusPedidoLabel } from "@/lib/pedido-status";
import { formatarPreco } from "@/lib/precos";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/pedidos")({
  component: PedidosPage,
  head: () => ({
    meta: [{ title: "Meus Pedidos — Carolina Viapiana" }],
  }),
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
  total_centavos: number;
  frete_centavos: number;
  frete_servico: string | null;
  frete_prazo_dias: number | null;
  codigo_rastreio: string | null;
  status: string;
  created_at: string | null;
  itens: PedidoItem[];
};

const statusConfig: Record<string, { dot: string; text: string }> = {
  novo:         { dot: "bg-foreground/40",  text: "text-foreground/60"  },
  em_andamento: { dot: "bg-yellow-500",     text: "text-yellow-700"     },
  pago:         { dot: "bg-green-500",      text: "text-green-700"      },
  enviado:      { dot: "bg-blue-500",       text: "text-blue-700"       },
  concluido:    { dot: "bg-foreground",     text: "text-foreground"     },
  cancelado:    { dot: "bg-destructive",    text: "text-destructive"    },
  expirado:     { dot: "bg-destructive/60", text: "text-destructive/80" },
  reembolsado:  { dot: "bg-foreground/40",  text: "text-foreground/60"  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { dot: "bg-foreground/40", text: "text-foreground/60" };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span className={`text-[11px] uppercase tracking-[0.25em] ${cfg.text}`}>
        {statusPedidoLabel(status)}
      </span>
    </span>
  );
}

function PedidosPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    setChecked(true);
  }, [navigate]);

  const { data: pedidos = [], isLoading, error } = useQuery<Pedido[]>({
    queryKey: ["meus-pedidos"],
    queryFn: () => apiFetch("/pedidos/meus"),
    enabled: checked,
  });

  if (!checked) return null;

  return (
    <main>
      <Header />
      <div className="pt-24">
        <section className="min-h-[70vh] bg-background py-20">
          <div className="mx-auto max-w-4xl px-6 md:px-12">

            <Reveal className="mb-14">
              <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Histórico
              </span>
              <h1 className="serif mt-3 text-5xl md:text-6xl">Meus pedidos</h1>
            </Reveal>

            {/* Loading */}
            {isLoading && (
              <div className="space-y-px border border-border bg-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-background p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-32 rounded-none" />
                      <Skeleton className="h-3 w-20 rounded-none" />
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full rounded-none" />
                      <Skeleton className="h-4 w-2/3 rounded-none" />
                    </div>
                    <div className="border-t border-border pt-4 flex justify-between">
                      <Skeleton className="h-3 w-16 rounded-none" />
                      <Skeleton className="h-5 w-24 rounded-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error != null && (
              <p className="text-sm text-destructive">Não foi possível carregar os pedidos.</p>
            )}

            {/* Empty */}
            {!isLoading && error == null && pedidos.length === 0 && (
              <Reveal className="flex flex-col items-start gap-8 border-t border-border pt-14">
                <div>
                  <p className="serif text-4xl md:text-5xl">
                    Nenhum pedido
                    <br />
                    <em className="font-light italic text-muted-foreground">por enquanto.</em>
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Pedidos feitos sem estar logado não aparecem aqui.
                  </p>
                </div>
                <Link
                  to="/produtos"
                  className="group inline-flex items-center gap-3 border border-foreground bg-foreground px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors duration-300 hover:bg-transparent hover:text-foreground"
                >
                  Ver coleção
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-300 group-hover:translate-x-1">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </Reveal>
            )}

            {/* Order list */}
            {pedidos.length > 0 && (
              <>
                <div className="space-y-px border border-border bg-border">
                  {pedidos.map((pedido, i) => (
                    <Reveal key={pedido.id} delay={i * 80}>
                      <PedidoCard pedido={pedido} />
                    </Reveal>
                  ))}
                </div>

                <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Pedidos feitos sem estar logado não aparecem aqui — em caso de dúvida, fale pelo WhatsApp.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const [copiado, setCopiado] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const copiarRastreio = async () => {
    if (!pedido.codigo_rastreio) return;
    await navigator.clipboard.writeText(pedido.codigo_rastreio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const subtotal = pedido.total_centavos - pedido.frete_centavos;
  const data = pedido.created_at
    ? new Date(pedido.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="bg-background">
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="group w-full px-8 py-6 text-left transition-colors duration-200 hover:bg-secondary/40"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <StatusBadge status={pedido.status} />
            <span className="text-xs text-muted-foreground">{data}</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="serif text-xl">{formatarPreco(pedido.total_centavos)}</span>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`shrink-0 text-muted-foreground transition-transform duration-300 ${expandido ? "rotate-180" : ""}`}
            >
              <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Item preview — fades out when expanding */}
        <p
          className="mt-2 text-[11px] text-muted-foreground transition-all duration-300"
          style={{ opacity: expandido ? 0 : 1, maxHeight: expandido ? 0 : "2rem", overflow: "hidden" }}
        >
          {pedido.itens.map((item) => `${item.produto_nome} ${item.tamanho}`).join(" · ")}
        </p>
      </button>

      {/* Expanded detail — animated via grid-rows */}
      <div
        className="grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateRows: expandido ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
        <div className="border-t border-border px-8 pb-8 pt-6 space-y-6"
          style={{ opacity: expandido ? 1 : 0, transition: "opacity 0.35s ease 0.1s" }}
        >

          {/* Items */}
          <ul className="space-y-3">
            {pedido.itens.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-6">
                <div>
                  <span className="serif text-lg">{item.produto_nome}</span>
                  <span className="ml-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {item.tamanho} · {item.aroma}
                    {item.refil ? " · com refil" : ""}
                  </span>
                  {item.quantidade > 1 && (
                    <span className="ml-2 text-[11px] text-muted-foreground">×{item.quantidade}</span>
                  )}
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatarPreco(item.subtotal_centavos)}
                </span>
              </li>
            ))}
          </ul>

          {/* Price breakdown */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatarPreco(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Frete{pedido.frete_servico ? ` — ${pedido.frete_servico}` : ""}</span>
              <span className="tabular-nums">
                {pedido.frete_servico
                  ? pedido.frete_centavos === 0 ? "Grátis" : formatarPreco(pedido.frete_centavos)
                  : "a combinar"}
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
              <span className="serif text-2xl tabular-nums">{formatarPreco(pedido.total_centavos)}</span>
            </div>
          </div>

          {/* Tracking code */}
          {pedido.codigo_rastreio && (
            <div className="flex items-center justify-between gap-4 border border-border px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Código de rastreio
                </p>
                <p className="mt-1 font-mono text-sm tracking-wider">{pedido.codigo_rastreio}</p>
              </div>
              <button
                type="button"
                onClick={copiarRastreio}
                className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {copiado ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            {pedido.status === "novo" && (
              <Link
                to="/pagamento/$pedidoId"
                params={{ pedidoId: pedido.id }}
                className="group flex flex-1 items-center justify-between border border-foreground bg-foreground px-6 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors duration-300 hover:bg-foreground/85"
              >
                Pagar agora
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
            {pedido.status !== "cancelado" && (
              <Link
                to="/rastreio/$pedidoId"
                params={{ pedidoId: pedido.id }}
                className="group flex flex-1 items-center justify-between border border-foreground/30 px-6 py-4 text-xs uppercase tracking-[0.3em] text-muted-foreground transition-all duration-300 hover:border-foreground hover:text-foreground"
              >
                Acompanhar pedido
                <span className="h-px w-4 bg-current transition-all duration-300 group-hover:w-7" />
              </Link>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
