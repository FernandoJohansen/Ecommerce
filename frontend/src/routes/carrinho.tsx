import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { formatarPreco } from "@/lib/precos";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/carrinho")({
  component: CarrinhoPage,
  head: () => ({
    meta: [{ title: "Carrinho — Carolina Viapiana" }],
  }),
});

type ItemCarrinho = {
  id: string;
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
  preco_unitario_centavos: number | null;
  subtotal_centavos: number | null;
};

function CarrinhoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    setChecked(true);
  }, [navigate]);

  const { data: itens = [], isLoading, error } = useQuery<ItemCarrinho[]>({
    queryKey: ["carrinho"],
    queryFn: () => apiFetch("/carrinho"),
    enabled: checked,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["carrinho"] });

  const alterarQuantidade = useMutation({
    mutationFn: ({ id, quantidade }: { id: string; quantidade: number }) =>
      apiFetch(`/carrinho/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade }),
      }),
    onSuccess: invalidar,
  });

  const removerItem = useMutation({
    mutationFn: (id: string) => apiFetch(`/carrinho/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });

  if (!checked) return null;

  const totalItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  const totalCentavos = itens.reduce((soma, item) => soma + (item.subtotal_centavos ?? 0), 0);
  const temItemSemPreco = itens.some((item) => item.subtotal_centavos === null);

  return (
    <main>
      <Header />
      <div className="pt-24">
        <section className="min-h-[70vh] bg-background py-20">
          <div className="mx-auto max-w-7xl px-6 md:px-12">

            {/* Page heading */}
            <Reveal className="mb-14">
              <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Resumo
              </span>
              <h1 className="serif mt-3 text-5xl md:text-6xl">Meu carrinho</h1>
            </Reveal>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
                <div className="space-y-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-6 border-b border-border py-8">
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-6 w-48 rounded-none" />
                        <Skeleton className="h-3 w-32 rounded-none" />
                        <Skeleton className="h-4 w-20 rounded-none" />
                      </div>
                      <Skeleton className="h-10 w-28 rounded-none" />
                      <Skeleton className="h-4 w-12 rounded-none" />
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-none" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">Não foi possível carregar o carrinho.</p>
            )}

            {/* Empty state */}
            {!isLoading && !error && itens.length === 0 && (
              <Reveal className="flex flex-col items-start gap-8 border-t border-border pt-14">
                <div>
                  <p className="serif text-4xl md:text-5xl">
                    Seu carrinho está
                    <br />
                    <em className="font-light italic text-muted-foreground">vazio.</em>
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Explore nossa coleção e adicione produtos que você ama.
                  </p>
                </div>
                <Link
                  to="/produtos"
                  className="group inline-flex items-center gap-3 border border-foreground bg-foreground px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors duration-300 hover:bg-transparent hover:text-foreground"
                >
                  Ver produtos
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-300 group-hover:translate-x-1">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </Reveal>
            )}

            {/* Cart items */}
            {itens.length > 0 && (
              <div className="grid gap-12 lg:grid-cols-[1fr_320px]">

                {/* Item list */}
                <div>
                  <ul>
                    {itens.map((item, i) => (
                      <Reveal
                        key={item.id}
                        delay={i * 80}
                        className="group border-b border-border"
                      >
                        <li className="flex items-center gap-6 py-8">
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="serif text-2xl leading-tight">{item.produto_nome}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                              {item.tamanho} · {item.aroma}
                              {item.refil ? " · com refil" : ""}
                            </p>
                            <p className="mt-3 text-sm">
                              {item.subtotal_centavos !== null ? (
                                <>
                                  <span className="font-medium">{formatarPreco(item.subtotal_centavos)}</span>
                                  {item.quantidade > 1 && item.preco_unitario_centavos !== null && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {item.quantidade} × {formatarPreco(item.preco_unitario_centavos)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">preço indisponível</span>
                              )}
                            </p>
                          </div>

                          {/* Quantity control */}
                          <div className="flex items-center border border-border transition-colors duration-300 group-hover:border-foreground/30">
                            <button
                              aria-label="Diminuir quantidade"
                              disabled={item.quantidade <= 1 || alterarQuantidade.isPending}
                              onClick={() => alterarQuantidade.mutate({ id: item.id, quantidade: item.quantidade - 1 })}
                              className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-all duration-200 hover:bg-foreground hover:text-background disabled:opacity-30"
                            >
                              <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
                                <path d="M1 1h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                            <span className="w-8 text-center text-sm tabular-nums">{item.quantidade}</span>
                            <button
                              aria-label="Aumentar quantidade"
                              disabled={item.quantidade >= 99 || alterarQuantidade.isPending}
                              onClick={() => alterarQuantidade.mutate({ id: item.id, quantidade: item.quantidade + 1 })}
                              className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-all duration-200 hover:bg-foreground hover:text-background disabled:opacity-30"
                            >
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removerItem.mutate(item.id)}
                            disabled={removerItem.isPending}
                            aria-label="Remover item"
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-all duration-200 hover:text-foreground disabled:opacity-30"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </li>
                      </Reveal>
                    ))}
                  </ul>

                  <Reveal delay={itens.length * 80} className="mt-8">
                    <Link
                      to="/produtos"
                      className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground transition-all duration-300 hover:text-foreground"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-300 group-hover:-translate-x-1">
                        <path d="M13 8H3M7 12L3 8l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Continuar comprando
                    </Link>
                  </Reveal>
                </div>

                {/* Order summary */}
                <Reveal delay={120} className="lg:sticky lg:top-32 lg:self-start">
                  <div className="border border-border p-8 space-y-6">
                    <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                      Resumo do pedido
                    </span>

                    <div className="space-y-3 pt-2">
                      {itens.map((item) => (
                        <div key={item.id} className="flex items-baseline justify-between gap-4 text-sm">
                          <span className="truncate text-muted-foreground">
                            {item.produto_nome}
                            {item.quantidade > 1 && (
                              <span className="ml-1 text-xs">×{item.quantidade}</span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {item.subtotal_centavos !== null
                              ? formatarPreco(item.subtotal_centavos)
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border pt-4 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Total
                      </span>
                      <span className="serif text-3xl">
                        {temItemSemPreco ? "—" : formatarPreco(totalCentavos)}
                      </span>
                    </div>

                    {temItemSemPreco && (
                      <p className="text-xs text-destructive leading-relaxed">
                        Um dos itens está sem preço disponível. Remova-o para continuar.
                      </p>
                    )}

                    <Link
                      to="/checkout"
                      className="group flex w-full items-center justify-between border border-foreground bg-foreground px-6 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors duration-300 hover:bg-foreground/85"
                    >
                      Finalizar pedido
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-300 group-hover:translate-x-1">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>

                    <p className="text-[10px] text-center uppercase tracking-[0.2em] text-muted-foreground">
                      {totalItens} {totalItens === 1 ? "item" : "itens"} no carrinho
                    </p>
                  </div>
                </Reveal>
              </div>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
