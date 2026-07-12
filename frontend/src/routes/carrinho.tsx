import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { formatarPreco } from "@/lib/precos";

export const Route = createFileRoute("/carrinho")({
  component: CarrinhoPage,
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

  const {
    data: itens = [],
    isLoading,
    error,
  } = useQuery<ItemCarrinho[]>({
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
  // Com um item sem preço o total estaria errado — e o checkout vai bloquear
  const temItemSemPreco = itens.some((item) => item.subtotal_centavos === null);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Meu carrinho</span>
          </Link>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
            >
              <Link to="/">Loja</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
            >
              <Link to="/perfil">Perfil</Link>
            </Button>
          </div>
        </div>

        <>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando carrinho…</p>}

          {error && (
            <p className="text-sm text-destructive">Não foi possível carregar o carrinho.</p>
          )}

          {!isLoading && !error && itens.length === 0 && (
            <div className="border border-border p-8 text-center sm:p-12">
              <p className="mb-8 text-sm text-muted-foreground">Seu carrinho está vazio.</p>
              <Button
                asChild
                className="rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
              >
                <Link to="/" hash="atendimento">
                  Escolher produtos
                </Link>
              </Button>
            </div>
          )}

          {itens.length > 0 && (
            <div className="border border-border p-8 sm:p-12">
              <ul className="divide-y divide-border">
                {itens.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-5">
                    <div className="min-w-0 flex-1">
                      <p className="serif text-xl">{item.produto_nome}</p>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {item.tamanho} · {item.aroma}
                        {item.refil ? " · com refil" : ""}
                      </p>
                      <p className="mt-1 text-sm">
                        {item.subtotal_centavos !== null ? (
                          <>
                            {formatarPreco(item.subtotal_centavos)}
                            {item.quantidade > 1 && item.preco_unitario_centavos !== null && (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                ({item.quantidade} × {formatarPreco(item.preco_unitario_centavos)})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">preço indisponível</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center border border-border">
                      <button
                        aria-label="Diminuir quantidade"
                        disabled={item.quantidade <= 1 || alterarQuantidade.isPending}
                        onClick={() =>
                          alterarQuantidade.mutate({
                            id: item.id,
                            quantidade: item.quantidade - 1,
                          })
                        }
                        className="px-3 py-1 transition-colors hover:bg-foreground hover:text-background disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantidade}</span>
                      <button
                        aria-label="Aumentar quantidade"
                        disabled={item.quantidade >= 99 || alterarQuantidade.isPending}
                        onClick={() =>
                          alterarQuantidade.mutate({
                            id: item.id,
                            quantidade: item.quantidade + 1,
                          })
                        }
                        className="px-3 py-1 transition-colors hover:bg-foreground hover:text-background disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removerItem.mutate(item.id)}
                      disabled={removerItem.isPending}
                      className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-8 space-y-6 border-t border-border pt-8">
                <div className="flex items-center justify-between text-sm">
                  <span className="uppercase tracking-[0.2em] text-muted-foreground">
                    Total ({totalItens} {totalItens === 1 ? "item" : "itens"})
                  </span>
                  <span className="serif text-2xl">
                    {temItemSemPreco ? "—" : formatarPreco(totalCentavos)}
                  </span>
                </div>

                {temItemSemPreco && (
                  <p className="text-sm text-destructive">
                    Um dos itens está sem preço disponível. Remova-o para finalizar o pedido.
                  </p>
                )}

                <Button
                  asChild
                  className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90"
                >
                  <Link to="/checkout">Finalizar pedido</Link>
                </Button>
              </div>
            </div>
          )}
        </>
      </div>
    </div>
  );
}
