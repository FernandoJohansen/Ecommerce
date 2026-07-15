import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatarPreco } from "@/lib/precos";

// Espelho do PagamentoMpResponse do backend (cartão/boleto via Mercado Pago)
export type PagamentoMp = {
  id: string;
  pedido_id: string;
  metodo: string;
  status: string;
  situacao: "pendente" | "aprovado" | "recusado" | "cancelado" | "estornado";
  valor_centavos: number;
  status_detail: string | null;
  mensagem_recusa: string | null;
  parcelas: number | null;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  boleto_vencimento: string | null;
};

export function PagamentoConfirmado({ valorCentavos }: { valorCentavos?: number }) {
  return (
    <>
      <p className="serif mb-4 text-2xl">Pagamento confirmado!</p>
      {valorCentavos !== undefined && (
        <p className="mb-2 text-sm text-muted-foreground">Total: {formatarPreco(valorCentavos)}</p>
      )}
      <p className="mb-8 text-sm text-muted-foreground">
        Recebemos o seu pagamento. Entraremos em contato pelo WhatsApp para combinar a entrega.
      </p>
      <Button
        asChild
        className="rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
      >
        <Link to="/">Voltar à loja</Link>
      </Button>
    </>
  );
}
