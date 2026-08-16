import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatarPreco, menorPreco, type ProdutoApi } from "@/lib/precos";
import { imagensDoProduto } from "@/lib/produto-imagens";
import { normalizarBusca, slugify, supabaseSrcSet } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/produtos")({
  component: ProdutosPage,
  head: () => ({
    meta: [
      { title: "Produtos — Carolina Viapiana" },
      {
        name: "description",
        content:
          "Toda a linha de difusores, home sprays, kits lavabo e refis. Aromas exclusivos criados artesanalmente em Ponta Grossa-PR.",
      },
    ],
  }),
});

type Categoria = { nome: string; total_produtos: number };

function ProdutosPage() {
  const { data: catalogo = [], isLoading } = useQuery<ProdutoApi[]>({
    queryKey: ["produtos"],
    queryFn: () => apiFetch("/produtos"),
  });
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => apiFetch("/categorias"),
  });

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const termo = normalizarBusca(busca.trim());
  const produtos = catalogo.filter(
    (p) =>
      (categoria === null || p.tag === categoria) &&
      (termo === "" || normalizarBusca(`${p.nome} ${p.descricao ?? ""}`).includes(termo)),
  );

  return (
    <main>
      <Header />
      <div className="pt-24">
        <section className="bg-background py-20">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <Reveal className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                  Coleção
                </span>
                <h1 className="serif mt-3 text-5xl md:text-6xl">Linha completa de aromas</h1>
              </div>
              <p className="max-w-md text-muted-foreground">
                Toda a coleção, pensada para diferentes ambientes e ocasiões. Busque pelo nome ou
                navegue pelas categorias.
              </p>
            </Reveal>

            {isLoading ? (
              <>
                <div className="mb-10 flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-20 rounded-none" />
                  ))}
                </div>
                <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-background p-6">
                      <Skeleton className="h-80 w-full rounded-none" />
                      <div className="space-y-3 pt-6">
                        <Skeleton className="h-3 w-16 rounded-none" />
                        <Skeleton className="h-6 w-3/4 rounded-none" />
                        <Skeleton className="h-4 w-full rounded-none" />
                        <Skeleton className="h-4 w-2/3 rounded-none" />
                        <Skeleton className="mt-2 h-4 w-24 rounded-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Reveal className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {[{ nome: "Todos", total_produtos: catalogo.length }, ...categorias].map((c) => {
                      const valor = c.nome === "Todos" ? null : c.nome;
                      const ativo = categoria === valor;
                      return (
                        <button
                          key={c.nome}
                          onClick={() => setCategoria(valor)}
                          className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
                            ativo
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          {c.nome}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar produto…"
                    aria-label="Buscar produto"
                    className="w-full border-0 border-b border-foreground bg-transparent px-0 py-2 text-base outline-none placeholder:text-muted-foreground md:max-w-xs"
                  />
                </Reveal>

                {produtos.length === 0 && (
                  <p className="py-12 text-center text-muted-foreground">
                    Nenhum produto encontrado{busca.trim() ? ` para "${busca.trim()}"` : ""}.
                  </p>
                )}

                <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                  {produtos.map((p, i) => {
                    const fotos = imagensDoProduto(p);
                    const precoInicial = menorPreco(p.precos);
                    return (
                      <Reveal key={p.id} delay={i * 100} className="bg-background transition-colors duration-300 hover:bg-secondary/60">
                        <article className="group flex h-full flex-col p-6">
                          <Link to="/produto/$slug" params={{ slug: slugify(p.nome) }}>
                            <div className="relative overflow-hidden bg-secondary">
                              {fotos[0] ? (
                                <img
                                  src={fotos[0]}
                                  srcSet={supabaseSrcSet(fotos[0])}
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                                  alt={p.nome}
                                  width={800}
                                  height={1000}
                                  loading="lazy"
                                  className="h-80 w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-80 w-full items-center justify-center">
                                  <span className="serif text-6xl text-foreground/20">
                                    {p.nome.charAt(0)}
                                  </span>
                                </div>
                              )}
                              {fotos[1] && (
                                <img
                                  src={fotos[1]}
                                  srcSet={supabaseSrcSet(fotos[1])}
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                                  alt=""
                                  width={800}
                                  height={1000}
                                  loading="lazy"
                                  aria-hidden
                                  className="absolute inset-0 h-80 w-full bg-secondary object-contain opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
                                />
                              )}
                              <span className="serif absolute left-4 top-3 text-sm tracking-widest text-foreground/60">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            </div>
                          </Link>
                          <div className="flex flex-1 flex-col pt-6">
                            {p.tag && (
                              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                                {p.tag}
                              </span>
                            )}
                            <h3 className="serif mt-2 text-2xl">{p.nome}</h3>
                            {p.descricao && (
                              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                                {p.descricao}
                              </p>
                            )}
                            {precoInicial !== null && (
                              <p className="mt-4 text-sm">
                                <span className="text-muted-foreground">a partir de </span>
                                {formatarPreco(precoInicial)}
                              </p>
                            )}
                            <Link
                              to="/produto/$slug"
                              params={{ slug: slugify(p.nome) }}
                              className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-all duration-300 group-hover:text-foreground"
                            >
                              Ver produto
                              <span className="h-px w-6 bg-current transition-all duration-300 group-hover:w-10" />
                            </Link>
                          </div>
                        </article>
                      </Reveal>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
