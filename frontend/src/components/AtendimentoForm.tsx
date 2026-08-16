import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiFetch } from "@/lib/api";
import { type ProdutoApi } from "@/lib/precos";
import { imagensDoProduto } from "@/lib/produto-imagens";
import { supabaseSrcSet } from "@/lib/utils";
import { CompraProduto, type Aroma } from "@/components/CompraProduto";
import { Skeleton } from "@/components/ui/skeleton";

export function AtendimentoForm() {
  const { data: produtos = [], isLoading: loadingProdutos } = useQuery<ProdutoApi[]>({
    queryKey: ["produtos"],
    queryFn: () => apiFetch("/produtos"),
  });

  const { data: aromas = [], isLoading: loadingAromas } = useQuery<Aroma[]>({
    queryKey: ["aromas"],
    queryFn: () => apiFetch("/aromas"),
  });

  const [produtoId, setProdutoId] = useState<string>("");
  const [fotoIdx, setFotoIdx] = useState(0);

  const produtoAtual = useMemo(
    () => produtos.find((p) => p.id === produtoId),
    [produtos, produtoId],
  );

  const effectiveProdutoId = produtoId || produtos[0]?.id || "";
  const effectiveProduto = produtoAtual ?? produtos[0];

  const handleProdutoChange = (id: string) => {
    setProdutoId(id);
    setFotoIdx(0);
  };

  const fotos = effectiveProduto ? imagensDoProduto(effectiveProduto) : [];
  const fotoAtual = fotos[fotoIdx] ?? fotos[0];

  if (loadingProdutos || loadingAromas) {
    return (
      <div className="grid gap-0 md:grid-cols-[1fr_1px_1fr]">
        <div className="pr-0 md:pr-12">
          <Skeleton className="mb-6 h-3 w-20 rounded-none" />
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-none" />
            ))}
          </div>
        </div>
        <div className="hidden bg-border md:block" />
        <div className="space-y-6 pt-8 md:pl-12 md:pt-0">
          <Skeleton className="h-72 w-full rounded-none" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-0 md:grid-cols-[1fr_1px_1fr]">
      {/* Product selector */}
      <div className="pr-0 md:pr-12">
        <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Produto
        </span>
        <RadioGroup
          value={effectiveProdutoId}
          onValueChange={handleProdutoChange}
          className="mt-4 grid gap-2"
        >
          {produtos.map((p) => {
            const ativo = effectiveProdutoId === p.id;
            return (
              <label
                key={p.id}
                htmlFor={p.id}
                className={`group flex cursor-pointer items-center justify-between border px-5 py-4 transition-all duration-300 ${
                  ativo
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:border-foreground/60 hover:bg-foreground/5"
                }`}
              >
                <span className="serif text-xl transition-colors duration-300">{p.nome}</span>
                <span
                  className={`text-[10px] uppercase tracking-widest transition-colors duration-300 ${
                    ativo ? "text-background/60" : "text-muted-foreground"
                  }`}
                >
                  {p.tamanhos.join(" · ")}
                </span>
                <RadioGroupItem value={p.id} id={p.id} className="sr-only" />
              </label>
            );
          })}
        </RadioGroup>
      </div>

      {/* Vertical divider */}
      <div className="hidden bg-border md:block" />

      {/* Controls */}
      <div className="mt-10 md:mt-0 md:pl-12">
        {effectiveProduto && fotoAtual && (
          <div className="mb-8">
            <div className="overflow-hidden bg-secondary">
              <img
                key={fotoAtual}
                src={fotoAtual}
                srcSet={supabaseSrcSet(fotoAtual)}
                sizes="(max-width: 640px) 100vw, 500px"
                alt={effectiveProduto.nome}
                width={800}
                height={1000}
                loading="lazy"
                className="animate-fade-up h-72 w-full object-contain"
              />
            </div>
            {fotos.length > 1 && (
              <div className="mt-3 flex gap-2">
                {fotos.map((foto, i) => (
                  <button
                    key={foto}
                    type="button"
                    onClick={() => setFotoIdx(i)}
                    aria-label={`Foto ${i + 1} de ${effectiveProduto.nome}`}
                    className={`h-12 w-12 overflow-hidden border transition-all duration-200 ${
                      i === fotoIdx
                        ? "border-foreground"
                        : "border-transparent opacity-50 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={foto}
                      srcSet={supabaseSrcSet(foto, [96, 192])}
                      sizes="96px"
                      alt=""
                      width={96}
                      height={96}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {effectiveProduto && (
          <CompraProduto produto={effectiveProduto} produtos={produtos} aromas={aromas} />
        )}
      </div>
    </div>
  );
}
