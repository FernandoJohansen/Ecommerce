import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { ApiError, apiFetch } from "@/lib/api";
import { headersPagamento } from "@/lib/pagamento-token";
import { PagamentoConfirmado, type PagamentoMp } from "./comum";

const PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY as string | undefined;

let sdkInicializado = false;
const inicializarSdk = () => {
  if (!sdkInicializado && PUBLIC_KEY) {
    initMercadoPago(PUBLIC_KEY, { locale: "pt-BR" });
    sdkInicializado = true;
  }
};

type Props = {
  pedidoId: string;
  totalCentavos: number;
  maxParcelas: number;
};

export function CartaoView({ pedidoId, totalCentavos, maxParcelas }: Props) {
  const queryClient = useQueryClient();
  const [tentativa, setTentativa] = useState<PagamentoMp | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  inicializarSdk();

  // Cartão em análise (in_process): acompanha até o MP decidir
  const poll = useQuery<PagamentoMp>({
    queryKey: ["mp-status", tentativa?.id],
    queryFn: () =>
      apiFetch(`/pagamento/mp/${tentativa!.id}`, { headers: headersPagamento(pedidoId) }),
    enabled: tentativa !== null && tentativa.situacao === "pendente",
    refetchInterval: (query) => (query.state.data?.situacao === "pendente" ? 5000 : false),
  });
  const atual = poll.data ?? tentativa;

  // Some o seletor de métodos e atualiza o status do pedido na página
  const aprovado = atual?.situacao === "aprovado";
  useEffect(() => {
    if (aprovado) {
      queryClient.invalidateQueries({ queryKey: ["pagamento-resumo", pedidoId] });
    }
  }, [aprovado, pedidoId, queryClient]);

  if (!PUBLIC_KEY) {
    return (
      <p className="text-sm text-muted-foreground">
        O pagamento por cartão está indisponível no momento. Escolha outro método.
      </p>
    );
  }

  if (atual?.situacao === "aprovado") {
    return <PagamentoConfirmado valorCentavos={atual.valor_centavos} />;
  }

  if (atual?.situacao === "pendente") {
    return (
      <>
        <p className="serif mb-4 text-2xl">Pagamento em análise</p>
        <p className="mb-6 text-sm text-muted-foreground">
          O emissor do cartão está analisando o pagamento. A confirmação é automática — você pode
          fechar esta página.
        </p>
        <p className="animate-pulse text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Aguardando confirmação…
        </p>
      </>
    );
  }

  // Cada submit é uma tentativa nova no backend (recusa não bloqueia retry)
  const pagar = async (formData: {
    token: string;
    issuer_id: string;
    payment_method_id: string;
    installments: number;
    payer: { email?: string };
  }) => {
    setErro(null);
    try {
      const resposta = await apiFetch<PagamentoMp>("/pagamento/cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersPagamento(pedidoId) },
        body: JSON.stringify({
          pedido_id: pedidoId,
          token: formData.token,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id ? String(formData.issuer_id) : null,
          installments: formData.installments,
          payer_email: formData.payer?.email ?? "",
        }),
      });
      setTentativa(resposta);
      if (resposta.situacao === "recusado") {
        setErro(resposta.mensagem_recusa ?? "Pagamento recusado. Tente novamente.");
        // Rejeita para o Brick reabilitar o botão de pagar
        throw new Error(resposta.mensagem_recusa ?? "recusado");
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErro(e.detail ?? "Não foi possível processar o pagamento. Tente novamente.");
      }
      throw e;
    }
  };

  return (
    <>
      <p className="serif mb-6 text-2xl">Pague com cartão</p>
      {erro && <p className="mb-4 text-sm text-destructive">{erro}</p>}
      <div className="text-left">
        <CardPayment
          initialization={{ amount: totalCentavos / 100 }}
          customization={{
            paymentMethods: { maxInstallments: maxParcelas },
            visual: { style: { theme: "flat" } },
          }}
          onSubmit={pagar}
        />
      </div>
    </>
  );
}
