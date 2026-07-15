export type ProdutoApi = {
  id: string;
  nome: string;
  tamanhos: string[];
  descricao?: string | null;
  tag?: string | null;
  estoque: number;
  precos: Record<string, number>;
  // URLs de fotos enviadas pelo admin (primeira = principal); quando vazio,
  // o site usa as fotos embutidas de produto-imagens.ts
  imagens?: string[];
};

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function menorPreco(precos: Record<string, number> | undefined): number | null {
  const valores = Object.values(precos ?? {});
  return valores.length > 0 ? Math.min(...valores) : null;
}

// Produto do catálogo que serve de add-on quando um item é pedido "com refil"
// (mesma regra do backend, que é quem de fato precifica o pedido).
export const REFIL_PRODUTO = "Refil";

export function precoUnitario(
  produtos: ProdutoApi[],
  produtoNome: string,
  tamanho: string,
  refil: boolean,
): number | null {
  const base = produtos.find((p) => p.nome === produtoNome)?.precos?.[tamanho];
  if (base === undefined) return null;
  if (refil) {
    // Produtos que já são refis não aceitam o add-on
    if (produtoNome.toLowerCase().includes("refil")) return null;
    const precoRefil = produtos.find((p) => p.nome === REFIL_PRODUTO)?.precos?.[tamanho];
    if (precoRefil === undefined) return null;
    return base + precoRefil;
  }
  return base;
}
