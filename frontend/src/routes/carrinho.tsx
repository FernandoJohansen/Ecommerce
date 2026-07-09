import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

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
};

function CarrinhoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [obs, setObs] = useState("");
  const [finalizado, setFinalizado] = useState(false);

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
    enabled: checked && !finalizado,
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

  const finalizar = useMutation({
    mutationFn: () =>
      apiFetch("/carrinho/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: obs.trim() || null }),
      }),
    onSuccess: () => {
      setFinalizado(true);
      queryClient.setQueryData(["carrinho"], []);
    },
  });

  if (!checked) return null;

  const totalItens = itens.reduce((soma, item) => soma + item.quantidade, 0);

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

        {finalizado ? (
          <div className="border border-border p-8 text-center sm:p-12">
            <p className="serif mb-4 text-2xl">Pedido enviado!</p>
            <p className="mb-8 text-sm text-muted-foreground">
              Recebemos o seu pedido e entraremos em contato em breve.
            </p>
            <Button
              asChild
              className="rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
            >
              <Link to="/">Voltar à loja</Link>
            </Button>
          </div>
        ) : (
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
                          disabled={alterarQuantidade.isPending}
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
                    <span className="uppercase tracking-[0.2em] text-muted-foreground">Total</span>
                    <span>
                      {totalItens} {totalItens === 1 ? "item" : "itens"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Observações
                    </Label>
                    <Textarea
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      rows={3}
                      className="rounded-none border border-foreground/30 bg-transparent"
                    />
                  </div>

                  {finalizar.isError && (
                    <p className="text-sm text-destructive">
                      Não foi possível finalizar o pedido. Tente novamente.
                    </p>
                  )}

                  <Button
                    onClick={() => finalizar.mutate()}
                    disabled={finalizar.isPending}
                    className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
                  >
                    {finalizar.isPending ? "Enviando…" : "Finalizar pedido"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
