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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { isAdmin, isAuthenticated, logout, type Role } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Pedido = {
  id: string;
  produto_nome: string;
  tamanho: string;
  aroma: string;
  refil: boolean;
  quantidade: number;
  nome_cliente: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
};

const STATUS = {
  novo: "Novo",
  em_andamento: "Em andamento",
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
  const [aba, setAba] = useState<"pedidos" | "usuarios">("pedidos");
  const admin = checked && isAdmin();

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

  const {
    data: usuarios = [],
    isLoading: carregandoUsuarios,
    error: erroUsuarios,
  } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: () => apiFetch("/admin/usuarios"),
    enabled: admin && aba === "usuarios",
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

        {admin && (
          <div className="mb-8 flex gap-2">
            {(["pedidos", "usuarios"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAba(tab)}
                className={`border px-6 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                  aba === tab
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {tab === "pedidos" ? "Pedidos" : "Usuários"}
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
                      <TableHead>Produto</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Aroma</TableHead>
                      <TableHead>Refil</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosFiltrados.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell>{new Date(pedido.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{pedido.produto_nome}</TableCell>
                        <TableCell>{pedido.tamanho}</TableCell>
                        <TableCell>{pedido.aroma}</TableCell>
                        <TableCell>{pedido.refil ? "Sim" : "Não"}</TableCell>
                        <TableCell>{pedido.quantidade}</TableCell>
                        <TableCell>{pedido.nome_cliente ?? "—"}</TableCell>
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
                                  {pedido.produto_nome}) será removido permanentemente.
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
