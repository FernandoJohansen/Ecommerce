import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { statusPedidoLabel } from "@/lib/pedido-status";
import { formatarPreco } from "@/lib/precos";

export const Route = createFileRoute("/pedidos")({
  component: PedidosPage,
});

type PedidoItem = {
  id: string;
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
  subtotal_centavos: number;
};

type Pedido = {
  id: string;
  total_centavos: number;
  frete_centavos: number;
  frete_servico: string | null;
  frete_prazo_dias: number | null;
  codigo_rastreio: string | null;
  status: string;
  created_at: string | null;
  itens: PedidoItem[];
};

function PedidosPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    setChecked(true);
  }, [navigate]);

  const {
    data: pedidos = [],
    isLoading,
    error,
  } = useQuery<Pedido[]>({
    queryKey: ["meus-pedidos"],
    queryFn: () => apiFetch("/pedidos/meus"),
    enabled: checked,
  });

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Meus pedidos</span>
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

        {isLoading && <p className="text-sm text-muted-foreground">Carregando pedidos…</p>}

        {error != null && (
          <p className="text-sm text-destructive">Não foi possível carregar os pedidos.</p>
        )}

        {!isLoading && error == null && pedidos.length === 0 && (
          <div className="border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não tem pedidos.</p>
            <Button asChild className="mt-6 rounded-none text-xs uppercase tracking-[0.2em]">
              <Link to="/">Ver a coleção</Link>
            </Button>
          </div>
        )}

        <div className="space-y-6">
          {pedidos.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido} />
          ))}
        </div>

        {pedidos.length > 0 && (
          <p className="mt-8 text-xs text-muted-foreground">
            Pedidos feitos sem estar logado não aparecem aqui — em caso de dúvida, fale com a gente
            pelo WhatsApp.
          </p>
        )}
      </div>
    </div>
  );
}

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const [copiado, setCopiado] = useState(false);

  const copiarRastreio = async () => {
    if (!pedido.codigo_rastreio) return;
    await navigator.clipboard.writeText(pedido.codigo_rastreio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const subtotal = pedido.total_centavos - pedido.frete_centavos;

  return (
    <div className="border border-border p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {pedido.created_at ? new Date(pedido.created_at).toLocaleString("pt-BR") : "—"}
        </span>
        <span className="border border-foreground px-3 py-1 text-xs uppercase tracking-[0.2em]">
          {statusPedidoLabel(pedido.status)}
        </span>
      </div>

      <ul className="mb-6 space-y-2 text-sm">
        {pedido.itens.map((item) => (
          <li key={item.id} className="flex justify-between gap-4">
            <span>
              {item.quantidade}× {item.produto_nome} {item.tamanho} · {item.aroma}
              {item.refil ? " · com refil" : ""}
            </span>
            <span className="whitespace-nowrap text-muted-foreground">
              {formatarPreco(item.subtotal_centavos)}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatarPreco(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Frete{pedido.frete_servico ? ` — ${pedido.frete_servico}` : ""}</span>
          <span>
            {pedido.frete_servico
              ? pedido.frete_centavos === 0
                ? "Grátis"
                : formatarPreco(pedido.frete_centavos)
              : "a combinar"}
          </span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span>{formatarPreco(pedido.total_centavos)}</span>
        </div>
      </div>

      {pedido.codigo_rastreio && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-border p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Código de rastreio
            </p>
            <p className="mt-1 font-mono text-sm">{pedido.codigo_rastreio}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copiarRastreio}
            className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
          >
            {copiado ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {pedido.status === "novo" && (
          <Button asChild className="flex-1 rounded-none text-xs uppercase tracking-[0.2em]">
            <Link to="/pagamento/$pedidoId" params={{ pedidoId: pedido.id }}>
              Pagar agora
            </Link>
          </Button>
        )}
        {pedido.status !== "cancelado" && (
          <Button
            asChild
            variant="outline"
            className="flex-1 rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
          >
            <Link to="/rastreio/$pedidoId" params={{ pedidoId: pedido.id }}>
              Acompanhar pedido
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
