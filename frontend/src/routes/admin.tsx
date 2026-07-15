import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";
import { ApiError, apiFetch } from "@/lib/api";
import { isAdmin, isAuthenticated, isStaff, logout, type Role } from "@/lib/auth";
import { formatarPreco } from "@/lib/precos";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type PedidoItem = {
  id: string;
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
  preco_unitario_centavos: number;
  subtotal_centavos: number;
};

type Pedido = {
  id: string;
  nome_cliente: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  total_centavos: number;
  frete_centavos: number;
  frete_servico: string | null;
  frete_prazo_dias: number | null;
  codigo_rastreio: string | null;
  status: string;
  created_at: string;
  itens: PedidoItem[];
};

const enderecoResumo = (pedido: Pedido) => {
  if (!pedido.rua) return null;
  const linha1 = [pedido.rua, pedido.numero].filter(Boolean).join(", ");
  const linha2 = [pedido.bairro, pedido.cidade, pedido.estado].filter(Boolean).join(" · ");
  return [linha1, pedido.complemento, linha2, pedido.cep].filter(Boolean).join(" — ");
};

const STATUS = {
  novo: "Novo",
  em_andamento: "Em andamento",
  pago: "Pago",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
} as const;

type StatusKey = keyof typeof STATUS;

const statusLabel = (status: string) => STATUS[status as StatusKey] ?? status;

type Usuario = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string | null;
};

type Produto = {
  id: string;
  nome: string;
  tamanhos: string[];
  descricao: string | null;
  tag: string | null;
  ordem: number;
  ativo: boolean;
  estoque: number;
  precos: Record<string, number>;
  // undefined enquanto a migration das imagens não foi aplicada no banco
  imagens?: string[];
};

// Converte "79,90" (ou "79.90") para centavos; null quando inválido.
const parsePrecoReais = (valor: string): number | null => {
  const texto = valor.trim();
  if (!texto) return null;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const reais = Number(normalizado);
  if (!Number.isFinite(reais) || reais <= 0) return null;
  return Math.round(reais * 100);
};

const precoParaInput = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

const ROLES: Record<Role, string> = {
  customer: "Cliente",
  staff: "Equipe",
  admin: "Administrador",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | StatusKey>("todos");
  const [aba, setAba] = useState<"pedidos" | "produtos" | "usuarios">("pedidos");
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);
  const [fotosDeId, setFotosDeId] = useState<string | null>(null);
  const admin = checked && isAdmin();
  const staff = checked && isStaff();

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
    queryKey: ["pedidos"],
    queryFn: () => apiFetch("/pedidos"),
    enabled: checked,
  });

  const atualizarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
  });

  const excluirPedido = useMutation({
    mutationFn: (id: string) => apiFetch(`/pedidos/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
  });

  const salvarRastreio = useMutation({
    mutationFn: ({ id, codigo }: { id: string; codigo: string }) =>
      apiFetch(`/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo_rastreio: codigo }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
  });

  const {
    data: usuarios = [],
    isLoading: carregandoUsuarios,
    error: erroUsuarios,
  } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: () => apiFetch("/admin/usuarios"),
    enabled: admin && aba === "usuarios",
  });

  const {
    data: produtos = [],
    isLoading: carregandoProdutos,
    error: erroProdutos,
  } = useQuery<Produto[]>({
    queryKey: ["produtos-admin"],
    queryFn: () => apiFetch("/produtos/admin"),
    enabled: staff && aba === "produtos",
  });

  const invalidarProdutos = () => {
    queryClient.invalidateQueries({ queryKey: ["produtos-admin"] });
    queryClient.invalidateQueries({ queryKey: ["produtos"] });
  };

  const salvarEstoque = useMutation({
    mutationFn: ({ id, estoque }: { id: string; estoque: number }) =>
      apiFetch(`/produtos/${id}/estoque`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estoque }),
      }),
    onSuccess: invalidarProdutos,
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      apiFetch(`/produtos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      }),
    onSuccess: invalidarProdutos,
  });

  const alterarRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiFetch(`/admin/usuarios/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  if (!checked) return null;

  const contagem = pedidos.reduce<Record<string, number>>((acc, pedido) => {
    acc[pedido.status] = (acc[pedido.status] ?? 0) + 1;
    return acc;
  }, {});

  const pedidosFiltrados =
    filtro === "todos" ? pedidos : pedidos.filter((pedido) => pedido.status === filtro);

  const filtros: Array<{ value: "todos" | StatusKey; label: string; count: number }> = [
    { value: "todos", label: "Todos", count: pedidos.length },
    ...(Object.keys(STATUS) as StatusKey[]).map((key) => ({
      value: key,
      label: STATUS[key],
      count: contagem[key] ?? 0,
    })),
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Admin</span>
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
              onClick={handleLogout}
              variant="outline"
              className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
            >
              Sair
            </Button>
          </div>
        </div>

        {staff && (
          <div className="mb-8 flex gap-2">
            {(admin
              ? (["pedidos", "produtos", "usuarios"] as const)
              : (["pedidos", "produtos"] as const)
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setAba(tab)}
                className={`border px-6 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                  aba === tab
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {tab === "pedidos" ? "Pedidos" : tab === "produtos" ? "Produtos" : "Usuários"}
              </button>
            ))}
          </div>
        )}

        {aba === "usuarios" && admin && (
          <>
            {carregandoUsuarios && (
              <p className="text-sm text-muted-foreground">Carregando usuários…</p>
            )}

            {erroUsuarios != null && (
              <p className="text-sm text-destructive">Não foi possível carregar os usuários.</p>
            )}

            {usuarios.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Papel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>{usuario.name ?? "—"}</TableCell>
                        <TableCell>{usuario.email}</TableCell>
                        <TableCell>
                          {usuario.created_at
                            ? new Date(usuario.created_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={usuario.role}
                            onValueChange={(role) =>
                              alterarRole.mutate({ id: usuario.id, role: role as Role })
                            }
                          >
                            <SelectTrigger className="w-[180px] rounded-none text-xs uppercase tracking-[0.1em]">
                              <SelectValue>{ROLES[usuario.role]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {(Object.keys(ROLES) as Role[]).map((role) => (
                                <SelectItem key={role} value={role} className="rounded-none">
                                  {ROLES[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {aba === "produtos" && staff && (
          <>
            <div className="mb-8 flex justify-end">
              <Button
                onClick={() => setEditando("novo")}
                variant="outline"
                className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
              >
                Novo produto
              </Button>
            </div>

            {carregandoProdutos && (
              <p className="text-sm text-muted-foreground">Carregando produtos…</p>
            )}

            {erroProdutos != null && (
              <p className="text-sm text-destructive">Não foi possível carregar os produtos.</p>
            )}

            {produtos.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Preços</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto) => (
                      <ProdutoRow
                        key={produto.id}
                        produto={produto}
                        salvandoEstoque={salvarEstoque.isPending}
                        onSalvarEstoque={(estoque) =>
                          salvarEstoque.mutate({ id: produto.id, estoque })
                        }
                        alternandoAtivo={alternarAtivo.isPending}
                        onAlternarAtivo={() =>
                          alternarAtivo.mutate({ id: produto.id, ativo: !produto.ativo })
                        }
                        onEditar={() => setEditando(produto)}
                        onFotos={() => setFotosDeId(produto.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {editando !== null && (
              <ProdutoDialog
                key={editando === "novo" ? "novo" : editando.id}
                produto={editando === "novo" ? null : editando}
                onFechar={() => setEditando(null)}
                onSalvo={invalidarProdutos}
              />
            )}

            {fotosDeId !== null &&
              (() => {
                const produto = produtos.find((p) => p.id === fotosDeId);
                return produto ? (
                  <FotosDialog
                    produto={produto}
                    onFechar={() => setFotosDeId(null)}
                    onAtualizado={invalidarProdutos}
                  />
                ) : null;
              })()}
          </>
        )}

        {aba === "pedidos" && (
          <>
            <div className="mb-8 flex flex-wrap gap-2">
              {filtros.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFiltro(f.value)}
                  className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                    filtro === f.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {isLoading && <p className="text-sm text-muted-foreground">Carregando pedidos…</p>}

            {error && (
              <p className="text-sm text-destructive">Não foi possível carregar os pedidos.</p>
            )}

            {!isLoading && !error && pedidosFiltrados.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {filtro === "todos" ? "Nenhum pedido ainda." : "Nenhum pedido com este status."}
              </p>
            )}

            {pedidosFiltrados.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Frete</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Rastreio</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosFiltrados.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell>{new Date(pedido.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <ul className="space-y-1">
                            {pedido.itens.map((item) => (
                              <li key={item.id} className="whitespace-nowrap">
                                {item.quantidade}× {item.produto_nome} {item.tamanho} · {item.aroma}
                                {item.refil ? " · com refil" : ""}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarPreco(pedido.total_centavos)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {pedido.frete_servico ? (
                            <>
                              {pedido.frete_servico}
                              <span className="block text-xs text-muted-foreground">
                                {pedido.frete_centavos === 0
                                  ? "Grátis"
                                  : formatarPreco(pedido.frete_centavos)}
                                {pedido.frete_prazo_dias != null
                                  ? ` · até ${pedido.frete_prazo_dias}d`
                                  : ""}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{pedido.nome_cliente ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {pedido.telefone ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {enderecoResumo(pedido) ?? "—"}
                        </TableCell>
                        <TableCell>
                          <RastreioCell
                            // Reinicia o input quando o valor salvo muda
                            key={`${pedido.id}-${pedido.codigo_rastreio ?? ""}`}
                            codigo={pedido.codigo_rastreio}
                            salvando={
                              salvarRastreio.isPending && salvarRastreio.variables?.id === pedido.id
                            }
                            onSalvar={(codigo) => salvarRastreio.mutate({ id: pedido.id, codigo })}
                          />
                        </TableCell>
                        <TableCell>{pedido.observacoes ?? "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={pedido.status}
                            onValueChange={(status) =>
                              atualizarStatus.mutate({ id: pedido.id, status })
                            }
                          >
                            <SelectTrigger className="w-[160px] rounded-none text-xs uppercase tracking-[0.1em]">
                              <SelectValue>{statusLabel(pedido.status)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {(Object.keys(STATUS) as StatusKey[]).map((key) => (
                                <SelectItem key={key} value={key} className="rounded-none">
                                  {STATUS[key]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
                              >
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-none">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="serif">
                                  Excluir pedido?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  O pedido de {pedido.nome_cliente ?? "cliente sem nome"} (
                                  {formatarPreco(pedido.total_centavos)}) será removido
                                  permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-none">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => excluirPedido.mutate(pedido.id)}
                                  className="rounded-none"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RastreioCell({
  codigo,
  salvando,
  onSalvar,
}: {
  codigo: string | null;
  salvando: boolean;
  onSalvar: (codigo: string) => void;
}) {
  const [valor, setValor] = useState(codigo ?? "");
  const alterado = valor.trim() !== (codigo ?? "");
  return (
    <div className="flex items-center gap-2">
      <Input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Código"
        className="h-8 w-[150px] rounded-none text-xs"
      />
      {alterado && (
        <Button
          size="sm"
          disabled={salvando}
          onClick={() => onSalvar(valor.trim())}
          className="rounded-none text-xs uppercase tracking-[0.1em]"
        >
          {salvando ? "…" : "Salvar"}
        </Button>
      )}
    </div>
  );
}

function ProdutoRow({
  produto,
  salvandoEstoque,
  onSalvarEstoque,
  alternandoAtivo,
  onAlternarAtivo,
  onEditar,
  onFotos,
}: {
  produto: Produto;
  salvandoEstoque: boolean;
  onSalvarEstoque: (estoque: number) => void;
  alternandoAtivo: boolean;
  onAlternarAtivo: () => void;
  onEditar: () => void;
  onFotos: () => void;
}) {
  const [valor, setValor] = useState(String(produto.estoque));

  useEffect(() => {
    setValor(String(produto.estoque));
  }, [produto.estoque]);

  const parsed = Number.parseInt(valor, 10);
  const valido = Number.isInteger(parsed) && parsed >= 0;
  const alterado = valido && parsed !== produto.estoque;

  return (
    <TableRow className={produto.ativo ? undefined : "opacity-50"}>
      <TableCell>{produto.nome}</TableCell>
      <TableCell>{produto.tag ?? "—"}</TableCell>
      <TableCell>
        <ul className="space-y-1">
          {produto.tamanhos.map((tamanho) => (
            <li key={tamanho} className="whitespace-nowrap">
              {tamanho} ·{" "}
              {produto.precos[tamanho] !== undefined
                ? formatarPreco(produto.precos[tamanho])
                : "sem preço"}
            </li>
          ))}
        </ul>
      </TableCell>
      <TableCell>{produto.ordem}</TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-24 rounded-none"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!alterado || salvandoEstoque}
            onClick={() => onSalvarEstoque(parsed)}
            className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
          >
            Salvar
          </Button>
          {produto.estoque === 0 && (
            <span className="text-xs uppercase tracking-[0.1em] text-destructive">Esgotado</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`text-xs uppercase tracking-[0.1em] ${
            produto.ativo ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {produto.ativo ? "Ativo" : "Inativo"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEditar}
            className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
          >
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onFotos}
            className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
          >
            Fotos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={alternandoAtivo}
            onClick={onAlternarAtivo}
            className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
          >
            {produto.ativo ? "Desativar" : "Reativar"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

type LinhaPreco = { tamanho: string; preco: string };

function ProdutoDialog({
  produto,
  onFechar,
  onSalvo,
}: {
  produto: Produto | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [tag, setTag] = useState(produto?.tag ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [ordem, setOrdem] = useState(String(produto?.ordem ?? 0));
  const [linhas, setLinhas] = useState<LinhaPreco[]>(
    produto
      ? produto.tamanhos.map((tamanho) => ({
          tamanho,
          preco:
            produto.precos[tamanho] !== undefined ? precoParaInput(produto.precos[tamanho]) : "",
        }))
      : [{ tamanho: "", preco: "" }],
  );

  const salvar = useMutation({
    mutationFn: (payload: object) =>
      produto
        ? apiFetch(`/produtos/${produto.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : apiFetch("/produtos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
    onSuccess: () => {
      onSalvo();
      onFechar();
    },
  });

  const setLinha = (indice: number, campo: keyof LinhaPreco, valor: string) =>
    setLinhas((atual) =>
      atual.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)),
    );

  const tamanhos = linhas.map((linha) => linha.tamanho.trim());
  const nomeValido = nome.trim().length > 0;
  const ordemValida = Number.isInteger(Number.parseInt(ordem, 10));
  const linhasValidas =
    linhas.length > 0 &&
    linhas.every((linha) => linha.tamanho.trim() && parsePrecoReais(linha.preco) !== null);
  const tamanhosUnicos = new Set(tamanhos).size === tamanhos.length;
  const podeSalvar = nomeValido && ordemValida && linhasValidas && tamanhosUnicos;

  const renomeando = produto !== null && nome.trim() !== produto.nome;

  const handleSalvar = () => {
    const precos: Record<string, number> = {};
    for (const linha of linhas) {
      precos[linha.tamanho.trim()] = parsePrecoReais(linha.preco)!;
    }
    salvar.mutate({
      nome: nome.trim(),
      tag: tag.trim() || null,
      descricao: descricao.trim() || null,
      ordem: Number.parseInt(ordem, 10),
      tamanhos,
      precos,
    });
  };

  const erroSalvar =
    salvar.error instanceof ApiError && salvar.error.detail
      ? salvar.error.detail
      : salvar.error
        ? "Não foi possível salvar o produto."
        : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="serif">
            {produto ? `Editar ${produto.nome}` : "Novo produto"}
          </DialogTitle>
          <DialogDescription>
            Preços em reais, por tamanho. O produto aparece na loja quando está ativo e tem preço
            definido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="produto-nome">Nome</Label>
            <Input
              id="produto-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-none"
            />
            {renomeando && (
              <p className="text-xs text-muted-foreground">
                Renomear não altera pedidos antigos, mas itens salvos em carrinhos com o nome
                anterior deixam de ser reconhecidos, e a foto do produto (mapeada por nome no site)
                precisa ser reapontada.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="produto-tag">Tag</Label>
              <Input
                id="produto-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ex.: Mais vendido"
                className="rounded-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="produto-ordem">Ordem na vitrine</Label>
              <Input
                id="produto-ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                className="rounded-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="produto-descricao">Descrição</Label>
            <Textarea
              id="produto-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="rounded-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Tamanhos e preços</Label>
            {linhas.map((linha, indice) => (
              <div key={indice} className="flex items-center gap-2">
                <Input
                  value={linha.tamanho}
                  onChange={(e) => setLinha(indice, "tamanho", e.target.value)}
                  placeholder="250ml"
                  className="w-28 rounded-none"
                />
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  value={linha.preco}
                  onChange={(e) => setLinha(indice, "preco", e.target.value)}
                  placeholder="79,90"
                  className="w-28 rounded-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={linhas.length === 1}
                  onClick={() => setLinhas((atual) => atual.filter((_, i) => i !== indice))}
                  className="rounded-none text-xs uppercase tracking-[0.1em]"
                >
                  Remover
                </Button>
              </div>
            ))}
            {!tamanhosUnicos && <p className="text-xs text-destructive">Há tamanhos duplicados.</p>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinhas((atual) => [...atual, { tamanho: "", preco: "" }])}
              className="rounded-none text-xs uppercase tracking-[0.1em]"
            >
              Adicionar tamanho
            </Button>
          </div>

          {erroSalvar && <p className="text-sm text-destructive">{erroSalvar}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onFechar}
            className="rounded-none text-xs uppercase tracking-[0.2em]"
          >
            Cancelar
          </Button>
          <Button
            disabled={!podeSalvar || salvar.isPending}
            onClick={handleSalvar}
            className="rounded-none text-xs uppercase tracking-[0.2em]"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FotosDialog({
  produto,
  onFechar,
  onAtualizado,
}: {
  produto: Produto;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const imagens = produto.imagens ?? [];

  const enviar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch(`/produtos/${produto.id}/imagens`, { method: "POST", body: form });
    },
    onSuccess: onAtualizado,
  });

  const remover = useMutation({
    mutationFn: (url: string) =>
      apiFetch(`/produtos/${produto.id}/imagens`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    onSuccess: onAtualizado,
  });

  const tornarPrincipal = useMutation({
    mutationFn: (url: string) =>
      apiFetch(`/produtos/${produto.id}/imagens`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagens: [url, ...imagens.filter((i) => i !== url)] }),
      }),
    onSuccess: onAtualizado,
  });

  const erro = [enviar.error, remover.error, tornarPrincipal.error]
    .map((e) =>
      e instanceof ApiError && e.detail
        ? e.detail
        : e
          ? "Não foi possível salvar a alteração."
          : null,
    )
    .find((mensagem) => mensagem !== null);

  return (
    <Dialog open onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="serif">Fotos de {produto.nome}</DialogTitle>
          <DialogDescription>
            A primeira foto é a principal, exibida na vitrine. Enquanto o produto não tiver fotos
            enviadas, o site usa as fotos embutidas (quando existem para este produto).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {imagens.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma foto enviada ainda.</p>
          )}

          {imagens.map((url, i) => (
            <div key={url} className="flex items-center gap-3 border border-border p-2">
              <img
                src={url}
                alt={`Foto ${i + 1} de ${produto.nome}`}
                width={128}
                height={128}
                loading="lazy"
                className="h-16 w-16 bg-secondary object-cover"
              />
              <span className="flex-1 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                {i === 0 ? "Principal" : `Foto ${i + 1}`}
              </span>
              {i > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tornarPrincipal.isPending}
                  onClick={() => tornarPrincipal.mutate(url)}
                  className="rounded-none text-xs uppercase tracking-[0.1em]"
                >
                  Tornar principal
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={remover.isPending}
                onClick={() => remover.mutate(url)}
                className="rounded-none border-foreground text-xs uppercase tracking-[0.1em]"
              >
                Remover
              </Button>
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="foto-upload">Enviar nova foto (JPG, PNG ou WebP, até 5MB)</Label>
            <Input
              id="foto-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={enviar.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) enviar.mutate(file);
                e.target.value = "";
              }}
              className="rounded-none"
            />
            {enviar.isPending && <p className="text-sm text-muted-foreground">Enviando…</p>}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onFechar}
            className="rounded-none text-xs uppercase tracking-[0.2em]"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
