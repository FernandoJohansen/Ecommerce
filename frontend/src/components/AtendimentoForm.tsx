import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiFetch } from "@/lib/api";
import { type ProdutoApi } from "@/lib/precos";
import { imagensDoProduto } from "@/lib/produto-imagens";
import { CompraProduto, type Aroma } from "@/components/CompraProduto";

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

  // Initialise selections once data loads
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
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Produto</Label>
        <RadioGroup
          value={effectiveProdutoId}
          onValueChange={handleProdutoChange}
          className="grid gap-2"
        >
          {produtos.map((p) => (
            <label
              key={p.id}
              htmlFor={p.id}
              className={`flex cursor-pointer items-center justify-between border px-5 py-4 transition-colors ${
                effectiveProdutoId === p.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground/50"
              }`}
            >
              <span className="serif text-xl">{p.nome}</span>
              <RadioGroupItem value={p.id} id={p.id} className="sr-only" />
              <span className="text-xs uppercase tracking-widest opacity-70">
                {p.tamanhos.join(" · ")}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-6">
        {effectiveProduto && fotoAtual && (
          <div className="space-y-2">
            <div className="overflow-hidden bg-secondary">
              <img
                key={fotoAtual}
                src={fotoAtual}
                alt={effectiveProduto.nome}
                width={800}
                height={1000}
                loading="lazy"
                className="animate-fade-up h-56 w-full object-contain"
              />
            </div>
            {fotos.length > 1 && (
              <div className="flex gap-2">
                {fotos.map((foto, i) => (
                  <button
                    key={foto}
                    type="button"
                    onClick={() => setFotoIdx(i)}
                    aria-label={`Foto ${i + 1} de ${effectiveProduto.nome}`}
                    className={`h-14 w-14 overflow-hidden border transition-colors ${
                      i === fotoIdx
                        ? "border-foreground"
                        : "border-border opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={foto}
                      alt=""
                      width={112}
                      height={112}
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
