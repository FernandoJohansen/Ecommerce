// Token de pagamento devolvido na criação do pedido: os endpoints de
// pagamento exigem prova de posse do pedido (o UUID sozinho não dá mais
// acesso). Guardado por pedido no localStorage para sobreviver a reload e
// nova aba; o backend também aceita o Bearer do dono logado.

const chave = (pedidoId: string) => `token_pagamento:${pedidoId}`;

export function salvarTokenPagamento(pedidoId: string, token: string | null | undefined) {
  if (!token || typeof window === "undefined") return;
  localStorage.setItem(chave(pedidoId), token);
}

// Headers extras das chamadas a /pagamento/* (vazio sem token salvo)
export function headersPagamento(pedidoId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(chave(pedidoId));
  return token ? { "X-Payment-Token": token } : {};
}
