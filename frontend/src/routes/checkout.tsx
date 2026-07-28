import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/logo.png";
import { ApiError, apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { formatarPreco, precoUnitario, type ProdutoApi } from "@/lib/precos";
import { lerItemDireto, limparItemDireto, type ItemDireto } from "@/lib/checkout";
import { salvarTokenPagamento } from "@/lib/pagamento-token";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): { direto?: true } => ({
    // "Comprar agora" chega com ?direto=true; sem isso o checkout fecha o
    // carrinho, mesmo que exista um item direto abandonado no sessionStorage
    direto: search.direto === true || search.direto === "true" ? true : undefined,
  }),
  component: CheckoutPage,
});

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

type ItemCarrinho = {
  id: string;
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
  preco_unitario_centavos: number | null;
  subtotal_centavos: number | null;
};

type PedidoCriado = {
  id: string;
  total_centavos: number;
  token_pagamento: string | null;
};

type FreteOpcao = {
  servico_id: number;
  nome: string;
  transportadora: string;
  valor_centavos: number;
  prazo_dias: number | null;
  frete_gratis: boolean;
};

type CotacaoFrete = {
  opcoes: FreteOpcao[];
  frete_gratis_minimo_centavos: number;
};

const formatarCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

const formatarTelefone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

// Máscara de CPF até 11 dígitos; com o 12º em diante vira máscara de CNPJ
const formatarCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

// Mesma regra do backend: 11 dígitos, não todos iguais, dígitos verificadores
const validarCpf = (digitos: string) => {
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(digitos[i]) * (tamanho + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(digitos[tamanho])) return false;
  }
  return true;
};

// Mesma regra do backend: 14 dígitos, não todos iguais, dígitos verificadores
const validarCnpj = (digitos: string) => {
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const tabelas = [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  ];
  for (const pesos of tabelas) {
    const soma = pesos.reduce((acc, peso, i) => acc + Number(digitos[i]) * peso, 0);
    let dv = 11 - (soma % 11);
    if (dv >= 10) dv = 0;
    if (dv !== Number(digitos[pesos.length])) return false;
  }
  return true;
};

const validarCpfCnpj = (digitos: string) =>
  digitos.length === 14 ? validarCnpj(digitos) : validarCpf(digitos);

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { direto } = Route.useSearch();

  // Resolvidos no cliente (sessionStorage/localStorage não existem no SSR)
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [itemDireto, setItemDireto] = useState<ItemDireto | null>(null);

  useEffect(() => {
    const item = direto ? lerItemDireto() : null;
    const autenticado = isAuthenticated();
    // Sem item direto, o checkout fecha o carrinho — e carrinho exige login
    if (!item && !autenticado) {
      navigate({ to: "/login" });
      return;
    }
    setItemDireto(item);
    setLogado(autenticado);
    setPronto(true);
  }, [navigate, direto]);

  const modoDireto = itemDireto !== null;

  const { data: catalogo = [], isLoading: carregandoCatalogo } = useQuery<ProdutoApi[]>({
    queryKey: ["produtos"],
    queryFn: () => apiFetch("/produtos"),
    enabled: pronto && modoDireto,
  });

  const { data: itensCarrinho = [], isLoading: carregandoCarrinho } = useQuery<ItemCarrinho[]>({
    queryKey: ["carrinho"],
    queryFn: () => apiFetch("/carrinho"),
    enabled: pronto && !modoDireto && logado,
  });

  const itens = modoDireto
    ? [itemDireto].map((item) => {
        const preco = precoUnitario(catalogo, item.produto_nome, item.tamanho, item.refil);
        return {
          ...item,
          preco_unitario_centavos: preco,
          subtotal_centavos: preco !== null ? preco * item.quantidade : null,
        };
      })
    : itensCarrinho;

  const total = itens.reduce((soma, item) => soma + (item.subtotal_centavos ?? 0), 0);
  // Enquanto o catálogo carrega (modo direto) ou quando um item perdeu o
  // preço, o total estaria errado — não deixa confirmar
  const carregandoPrecos = modoDireto && carregandoCatalogo;
  const temItemSemPreco = !carregandoPrecos && itens.some((i) => i.subtotal_centavos === null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");

  const [cep, setCep] = useState("");
  const [freteId, setFreteId] = useState<number | null>(null);
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("PR");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  // Pre-fill email from auth profile for logged-in users
  const { data: perfil } = useQuery<{ email: string }>({
    queryKey: ["perfil-email"],
    queryFn: () => apiFetch("/auth/me"),
    enabled: pronto && logado,
  });
  useEffect(() => {
    if (perfil?.email && !email) setEmail(perfil.email);
  }, [perfil, email]);

  // Cotação de frete: dispara quando o CEP fica completo e os itens têm
  // preço. 503 = integração desligada → o pedido segue sem frete (entrega
  // combinada pelo WhatsApp), como antes do Sprint 7.
  const cepDigitos = cep.replace(/\D/g, "");
  const itensFrete = itens.map((item) => ({
    produto_nome: item.produto_nome,
    tamanho: item.tamanho,
    refil: item.refil,
    quantidade: item.quantidade,
  }));
  const chaveItens = JSON.stringify(itensFrete);
  const cotacao = useQuery<CotacaoFrete>({
    queryKey: ["frete", cepDigitos, chaveItens],
    queryFn: () =>
      apiFetch("/frete/cotacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: cepDigitos, itens: itensFrete }),
      }),
    enabled:
      pronto &&
      cepDigitos.length === 8 &&
      itens.length > 0 &&
      !carregandoPrecos &&
      !temItemSemPreco,
    retry: false,
    staleTime: 60_000,
  });
  const freteIndisponivel = cotacao.error instanceof ApiError && cotacao.error.status === 503;
  const opcoesFrete = useMemo(() => cotacao.data?.opcoes ?? [], [cotacao.data]);
  const freteSelecionado = opcoesFrete.find((o) => o.servico_id === freteId) ?? null;

  // Pré-seleciona a opção mais barata (primeira) quando a cotação muda e a
  // escolha anterior não existe mais
  useEffect(() => {
    if (opcoesFrete.length > 0 && !opcoesFrete.some((o) => o.servico_id === freteId)) {
      setFreteId(opcoesFrete[0].servico_id);
    }
  }, [opcoesFrete, freteId]);

  const totalComFrete = total + (freteSelecionado?.valor_centavos ?? 0);
  // Com a cotação carregada, o pedido só sai com uma opção escolhida; sem
  // cotação (CEP incompleto/erro), o backend decide — se o frete estiver
  // ativo por lá, devolve o erro real
  const aguardandoFrete = cotacao.isFetching || (opcoesFrete.length > 0 && !freteSelecionado);

  const validar = () => {
    const novos: Record<string, string> = {};
    if (nome.trim().length < 2) novos.nome = "Informe o nome completo";
    if (!email.trim() || !email.includes("@")) novos.email = "Informe um e-mail válido";
    const telDigitos = telefone.replace(/\D/g, "");
    if (telDigitos.length < 10 || telDigitos.length > 11) novos.telefone = "Informe DDD + número";
    if (!validarCpfCnpj(cpfCnpj.replace(/\D/g, ""))) novos.cpf_cnpj = "CPF/CNPJ inválido";
    if (cep.replace(/\D/g, "").length !== 8) novos.cep = "CEP deve ter 8 dígitos";
    if (rua.trim().length < 2) novos.rua = "Informe a rua";
    if (!numero.trim()) novos.numero = "Informe o número";
    if (bairro.trim().length < 2) novos.bairro = "Informe o bairro";
    if (cidade.trim().length < 2) novos.cidade = "Informe a cidade";
    if (!UFS.includes(estado)) novos.estado = "UF inválida";
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const dadosCliente = () => ({
    nome_cliente: nome.trim(),
    email_cliente: email.trim().toLowerCase() || null,
    telefone: telefone.replace(/\D/g, ""),
    cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
    endereco: {
      cep: cep.replace(/\D/g, ""),
      rua: rua.trim(),
      numero: numero.trim(),
      complemento: complemento.trim() || null,
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      estado,
    },
    observacoes: obs.trim() || null,
    frete: freteSelecionado ? { servico_id: freteSelecionado.servico_id } : null,
  });

  const enviar = useMutation({
    mutationFn: (): Promise<PedidoCriado> =>
      modoDireto
        ? apiFetch("/pedidos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itens: [
                {
                  produto_nome: itemDireto!.produto_nome,
                  tamanho: itemDireto!.tamanho,
                  aroma: itemDireto!.aroma,
                  refil: itemDireto!.refil,
                  quantidade: itemDireto!.quantidade,
                },
              ],
              ...dadosCliente(),
            }),
          })
        : apiFetch("/carrinho/finalizar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dadosCliente()),
          }),
    onSuccess: (pedido) => {
      if (modoDireto) limparItemDireto();
      else queryClient.setQueryData(["carrinho"], []);
      salvarTokenPagamento(pedido.id, pedido.token_pagamento);
      navigate({ to: "/pagamento/$pedidoId", params: { pedidoId: pedido.id } });
    },
  });

  const submeter = () => {
    if (validar()) enviar.mutate();
  };

  if (!pronto) return null;

  const campo = (
    label: string,
    valor: string,
    onChange: (v: string) => void,
    chave: string,
    props?: { placeholder?: string; className?: string; type?: string; autoComplete?: string },
  ) => (
    <div className={`space-y-2 ${props?.className ?? ""}`}>
      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
      <Input
        value={valor}
        placeholder={props?.placeholder}
        type={props?.type}
        autoComplete={props?.autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-none border-0 border-b border-foreground bg-transparent px-0"
      />
      {erros[chave] && <p className="text-xs text-destructive">{erros[chave]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Checkout</span>
          </Link>
          <Button
            asChild
            variant="outline"
            className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
          >
            <Link to={modoDireto ? "/" : "/carrinho"}>{modoDireto ? "Loja" : "Carrinho"}</Link>
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <div className="border border-border p-8">
            <h2 className="serif mb-8 text-2xl">Dados de entrega</h2>
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {campo("Nome completo", nome, setNome, "nome")}
                {campo(
                  "Telefone / WhatsApp",
                  telefone,
                  (v) => setTelefone(formatarTelefone(v)),
                  "telefone",
                  {
                    placeholder: "(42) 99999-9999",
                  },
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                {campo("E-mail", email, setEmail, "email", {
                  type: "email",
                  placeholder: "seu@email.com",
                  autoComplete: "email",
                })}
                {campo("CPF ou CNPJ", cpfCnpj, (v) => setCpfCnpj(formatarCpfCnpj(v)), "cpf_cnpj", {
                  placeholder: "000.000.000-00",
                })}
              </div>
              <div className="grid gap-6 sm:grid-cols-[140px_1fr_100px]">
                {campo("CEP", cep, (v) => setCep(formatarCep(v)), "cep", {
                  placeholder: "84000-000",
                })}
                {campo("Rua", rua, setRua, "rua")}
                {campo("Número", numero, setNumero, "numero")}
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                {campo("Complemento (opcional)", complemento, setComplemento, "complemento")}
                {campo("Bairro", bairro, setBairro, "bairro")}
              </div>
              <div className="grid gap-6 sm:grid-cols-[1fr_120px]">
                {campo("Cidade", cidade, setCidade, "cidade")}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    UF
                  </Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger className="rounded-none border-0 border-b border-foreground bg-transparent px-0 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {erros.estado && <p className="text-xs text-destructive">{erros.estado}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Observações (opcional)
                </Label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={3}
                  className="rounded-none border border-foreground/30 bg-transparent"
                />
              </div>
            </div>
          </div>

          <div className="h-fit border border-border p-8">
            <h2 className="serif mb-6 text-2xl">Resumo</h2>
            {!modoDireto && carregandoCarrinho && (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-1 border-b border-border pb-4">
                    <Skeleton className="h-5 w-3/4 rounded-none" />
                    <Skeleton className="h-3 w-1/2 rounded-none" />
                    <Skeleton className="h-4 w-16 rounded-none" />
                  </div>
                ))}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-16 rounded-none" />
                    <Skeleton className="h-4 w-20 rounded-none" />
                  </div>
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-4 w-10 rounded-none" />
                    <Skeleton className="h-6 w-24 rounded-none" />
                  </div>
                </div>
              </div>
            )}
            {itens.length === 0 && !carregandoCarrinho && (
              <div>
                <p className="mb-6 text-sm text-muted-foreground">Nenhum item para finalizar.</p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
                >
                  <Link to="/" hash="atendimento">
                    Escolher produtos
                  </Link>
                </Button>
              </div>
            )}
            {itens.length > 0 && (
              <>
                <ul className="divide-y divide-border">
                  {itens.map((item, i) => (
                    <li key={i} className="py-4">
                      <p className="serif text-lg">{item.produto_nome}</p>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {item.tamanho} · {item.aroma}
                        {item.refil ? " · com refil" : ""} · {item.quantidade}x
                      </p>
                      <p className="mt-1 text-sm">
                        {item.subtotal_centavos !== null
                          ? formatarPreco(item.subtotal_centavos)
                          : "—"}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-border pt-6">
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Frete
                  </p>
                  {cepDigitos.length !== 8 && (
                    <p className="text-sm text-muted-foreground">
                      Informe o CEP para calcular o frete.
                    </p>
                  )}
                  {cotacao.isFetching && (
                    <p className="text-sm text-muted-foreground">Calculando frete…</p>
                  )}
                  {freteIndisponivel && (
                    <p className="text-sm text-muted-foreground">
                      Cálculo de frete indisponível no momento — combinaremos a entrega pelo
                      WhatsApp.
                    </p>
                  )}
                  {cotacao.isError && !freteIndisponivel && (
                    <p className="text-sm text-destructive">
                      {cotacao.error instanceof ApiError && cotacao.error.detail
                        ? cotacao.error.detail
                        : "Não foi possível calcular o frete. Confira o CEP."}
                    </p>
                  )}
                  {!cotacao.isFetching && opcoesFrete.length > 0 && (
                    <div className="space-y-2">
                      {opcoesFrete.map((opcao) => (
                        <button
                          key={opcao.servico_id}
                          type="button"
                          onClick={() => setFreteId(opcao.servico_id)}
                          className={`flex w-full items-center justify-between border px-3 py-2 text-left text-sm ${
                            opcao.servico_id === freteId
                              ? "border-foreground"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          <span>
                            {opcao.nome} · {opcao.transportadora}
                            {opcao.prazo_dias != null && (
                              <span className="block text-xs text-muted-foreground">
                                {opcao.prazo_dias === 1
                                  ? "até 1 dia útil"
                                  : `até ${opcao.prazo_dias} dias úteis`}
                              </span>
                            )}
                          </span>
                          <span>
                            {opcao.valor_centavos === 0
                              ? "Grátis"
                              : formatarPreco(opcao.valor_centavos)}
                          </span>
                        </button>
                      ))}
                      {cotacao.data &&
                        total < cotacao.data.frete_gratis_minimo_centavos &&
                        !carregandoPrecos &&
                        !temItemSemPreco && (
                          <p className="text-xs text-muted-foreground">
                            Faltam{" "}
                            {formatarPreco(cotacao.data.frete_gratis_minimo_centavos - total)} em
                            produtos para ganhar frete grátis.
                          </p>
                        )}
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-2 border-t border-border pt-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Produtos</span>
                    <span>{carregandoPrecos || temItemSemPreco ? "—" : formatarPreco(total)}</span>
                  </div>
                  {freteSelecionado && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Frete</span>
                      <span>
                        {freteSelecionado.valor_centavos === 0
                          ? "Grátis"
                          : formatarPreco(freteSelecionado.valor_centavos)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Total
                    </span>
                    <span className="serif text-2xl">
                      {carregandoPrecos || temItemSemPreco || aguardandoFrete
                        ? "—"
                        : formatarPreco(totalComFrete)}
                    </span>
                  </div>
                </div>

                {temItemSemPreco && (
                  <p className="mt-4 text-sm text-destructive">
                    Um dos itens está sem preço disponível.{" "}
                    {modoDireto
                      ? "Volte à loja e refaça a seleção."
                      : "Remova-o do carrinho para continuar."}
                  </p>
                )}

                {enviar.isError && (
                  <p className="mt-4 text-sm text-destructive">
                    {enviar.error instanceof ApiError && enviar.error.detail
                      ? enviar.error.detail
                      : "Não foi possível confirmar o pedido. Confira os dados e tente novamente."}
                  </p>
                )}

                <Button
                  onClick={submeter}
                  disabled={
                    enviar.isPending || carregandoPrecos || temItemSemPreco || aguardandoFrete
                  }
                  className="mt-6 w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
                >
                  {enviar.isPending ? "Confirmando…" : "Confirmar pedido"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
