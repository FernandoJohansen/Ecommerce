import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/assets/logo.png";
import { ApiError, apiFetch } from "@/lib/api";
import { headersPagamento } from "@/lib/pagamento-token";
import { PagamentoConfirmado } from "@/components/pagamento/comum";
import { PixView } from "@/components/pagamento/pix-view";
import { CartaoView } from "@/components/pagamento/cartao-view";
import { BoletoView } from "@/components/pagamento/boleto-view";

export const Route = createFileRoute("/pagamento/$pedidoId")({
  component: PagamentoPage,
});

type Metodos = {
  pix: boolean;
  cartao: boolean;
  boleto: boolean;
  max_parcelas: number;
};

type ResumoPedido = {
  pedido_id: string;
  total_centavos: number;
  status: string;
  tem_documento: boolean;
};

type MetodoPagamento = "pix" | "cartao" | "boleto";

const ROTULOS: Record<MetodoPagamento, { titulo: string; legenda: (m: Metodos) => string }> = {
  pix: { titulo: "PIX", legenda: () => "Recomendado · aprovação imediata" },
  cartao: { titulo: "Cartão de crédito", legenda: (m) => `até ${m.max_parcelas}x` },
  boleto: { titulo: "Boleto", legenda: () => "compensa em 1–3 dias úteis" },
};

function PagamentoPage() {
  const { pedidoId } = Route.useParams();
  const [escolhido, setEscolhido] = useState<MetodoPagamento | null>(null);

  const metodosQuery = useQuery<Metodos>({
    queryKey: ["pagamento-metodos"],
    queryFn: () => apiFetch("/pagamento/metodos"),
    staleTime: Infinity,
  });
  // Se /metodos falhar, degrada para o fluxo antigo (só PIX)
  const metodos = metodosQuery.data ?? {
    pix: true,
    cartao: false,
    boleto: false,
    max_parcelas: 12,
  };

  const resumoQuery = useQuery<ResumoPedido>({
    queryKey: ["pagamento-resumo", pedidoId],
    queryFn: () =>
      apiFetch(`/pagamento/resumo/${pedidoId}`, { headers: headersPagamento(pedidoId) }),
    retry: false,
  });
  const resumo = resumoQuery.data;

  const disponiveis = (["pix", "cartao", "boleto"] as const).filter((m) => metodos[m]);
  const metodo =
    escolhido && disponiveis.includes(escolhido) ? escolhido : (disponiveis[0] ?? null);

  const pedidoNaoEncontrado =
    resumoQuery.error instanceof ApiError && resumoQuery.error.status === 404;

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

        {disponiveis.length > 1 && resumo?.status !== "pago" && !pedidoNaoEncontrado && (
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {disponiveis.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEscolhido(m)}
                className={`border p-4 text-left transition-colors ${
                  metodo === m
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                <span className="block text-xs uppercase tracking-[0.2em]">
                  {ROTULOS[m].titulo}
                </span>
                <span
                  className={`mt-1 block text-[10px] uppercase tracking-widest ${
                    metodo === m ? "text-background/70" : "text-muted-foreground"
                  }`}
                >
                  {ROTULOS[m].legenda(metodos)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="border border-border p-8 text-center sm:p-12">
          {pedidoNaoEncontrado && (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                Pedido não encontrado — ou este link de pagamento expirou. Se você tem conta, entre
                para acessar o pedido em Meus pedidos.
              </p>
              <Button
                asChild
                variant="outline"
                className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
              >
                <Link to="/">Voltar à loja</Link>
              </Button>
            </>
          )}

          {!pedidoNaoEncontrado && resumo?.status === "pago" && (
            <PagamentoConfirmado valorCentavos={resumo.total_centavos} />
          )}

          {!pedidoNaoEncontrado && resumo?.status !== "pago" && (
            <>
              {disponiveis.length === 0 && (
                <>
                  <p className="serif mb-4 text-2xl">Pedido confirmado!</p>
                  <p className="mb-8 text-sm text-muted-foreground">
                    O pagamento online está indisponível no momento. Recebemos o seu pedido e
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

              {metodo === "pix" && <PixView pedidoId={pedidoId} />}

              {metodo === "cartao" &&
                (resumo ? (
                  <CartaoView
                    pedidoId={pedidoId}
                    totalCentavos={resumo.total_centavos}
                    maxParcelas={metodos.max_parcelas}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-6 w-48 rounded-none" />
                    <Skeleton className="h-12 w-full rounded-none" />
                    <Skeleton className="h-12 w-full rounded-none" />
                    <Skeleton className="h-12 w-full rounded-none" />
                    <Skeleton className="h-10 w-full rounded-none" />
                  </div>
                ))}

              {metodo === "boleto" &&
                (resumo ? (
                  <BoletoView pedidoId={pedidoId} temDocumento={resumo.tem_documento} />
                ) : (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-6 w-44 rounded-none" />
                    <Skeleton className="h-4 w-full rounded-none" />
                    <Skeleton className="h-4 w-3/4 rounded-none" />
                    <Skeleton className="h-10 w-full rounded-none" />
                    <Skeleton className="h-12 w-full rounded-none" />
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
