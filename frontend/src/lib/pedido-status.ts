export const STATUS_PEDIDO = {
  novo: "Novo",
  em_andamento: "Em andamento",
  pago: "Pago",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  expirado: "Expirado",
  reembolsado: "Reembolsado",
} as const;

export type StatusPedido = keyof typeof STATUS_PEDIDO;

export const statusPedidoLabel = (status: string) =>
  STATUS_PEDIDO[status as StatusPedido] ?? status;
