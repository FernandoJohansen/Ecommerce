import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { formatarPreco, menorPreco, type ProdutoApi } from "@/lib/precos";
import { imagensDoProduto } from "@/lib/produto-imagens";
import { slugify, supabaseSrcSet } from "@/lib/utils";
import { CompraProduto, type Aroma } from "@/components/CompraProduto";
import { Avaliacoes } from "@/components/Avaliacoes";

export const Route = createFileRoute("/produto/$slug")({
  component: ProdutoPage,
  head: () => ({
    meta: [{ title: "Produto — Carolina Viapiana" }],
  }),
});

function ProdutoPage() {
  const { slug } = Route.useParams();
  const [fotoIdx, setFotoIdx] = useState(0);

  const {
    data: produtos = [],
    isLoading,
    error,
  } = useQuery<ProdutoApi[]>({
    queryKey: ["produtos"],
    queryFn: () => apiFetch("/produtos"),
  });

  const { data: aromas = [] } = useQuery<Aroma[]>({
    queryKey: ["aromas"],
    queryFn: () => apiFetch("/aromas"),
  });

  const produto = produtos.find((p) => slugify(p.nome) === slug);
  const fotos = produto ? imagensDoProduto(produto) : [];
  const fotoAtual = fotos[fotoIdx] ?? fotos[0];
  const precoInicial = produto ? menorPreco(produto.precos) : null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Carolina Viapiana</span>
          </Link>
          <Button
            asChild
            variant="outline"
            className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
          >
            <Link to="/">Voltar à loja</Link>
          </Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {error != null && (
          <p className="text-sm text-destructive">Não foi possível carregar o produto.</p>
        )}

        {!isLoading && error == null && !produto && (
          <div className="py-20 text-center">
            <h1 className="serif text-4xl">Produto não encontrado</h1>
            <p className="mt-4 text-muted-foreground">
              Este produto não existe ou não está mais disponível.
            </p>
            <Button
              asChild
              className="mt-8 rounded-none bg-foreground px-8 py-6 text-xs uppercase tracking-[0.3em] text-background"
            >
              <Link to="/" hash="produtos">
                Ver todos os produtos
              </Link>
            </Button>
          </div>
        )}

        {produto && (
          <>
          <div className="grid gap-12 md:grid-cols-2">
            <div className="space-y-3">
              {fotoAtual ? (
                <div className="overflow-hidden bg-secondary">
                  <img
                    key={fotoAtual}
                    src={fotoAtual}
                    srcSet={supabaseSrcSet(fotoAtual)}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={produto.nome}
                    width={800}
                    height={1000}
                    className="animate-fade-up h-[28rem] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-[28rem] items-center justify-center bg-secondary">
                  <span className="serif text-6xl text-foreground/20">
                    {produto.nome.charAt(0)}
                  </span>
                </div>
              )}
              {fotos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {fotos.map((foto, i) => (
                    <button
                      key={foto}
                      type="button"
                      onClick={() => setFotoIdx(i)}
                      aria-label={`Foto ${i + 1} de ${produto.nome}`}
                      className={`h-16 w-16 overflow-hidden border transition-all duration-300 ${
                        i === fotoIdx
                          ? "border-foreground"
                          : "border-border opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={foto}
                        srcSet={supabaseSrcSet(foto, [128, 256])}
                        sizes="128px"
                        alt=""
                        width={128}
                        height={128}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              {produto.tag && (
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {produto.tag}
                </span>
              )}
              <h1 className="serif mt-2 text-4xl md:text-5xl">{produto.nome}</h1>
              {precoInicial !== null && (
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">a partir de </span>
                  {formatarPreco(precoInicial)}
                </p>
              )}
              {produto.descricao && (
                <p className="mt-5 text-muted-foreground">{produto.descricao}</p>
              )}
              {produto.estoque === 0 && (
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-destructive">Esgotado</p>
              )}

              <div className="mt-8 border-t border-border pt-8">
                <CompraProduto produto={produto} produtos={produtos} aromas={aromas} />
              </div>
            </div>
          </div>

          <Avaliacoes produtoId={produto.id} />
          </>
        )}
      </div>
    </div>
  );
}
