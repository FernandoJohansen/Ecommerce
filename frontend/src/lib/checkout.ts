// "Comprar agora" na vitrine guarda o item aqui e manda para /checkout, que
// então fecha o pedido direto (sem passar pelo carrinho).

export type ItemDireto = {
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
};

const KEY = "checkout_item_direto";

export function salvarItemDireto(item: ItemDireto) {
  sessionStorage.setItem(KEY, JSON.stringify(item));
}

export function lerItemDireto(): ItemDireto | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ItemDireto) : null;
  } catch {
    return null;
  }
}

export function limparItemDireto() {
  sessionStorage.removeItem(KEY);
}
