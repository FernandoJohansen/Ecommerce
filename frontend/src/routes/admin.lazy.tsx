import { Link, createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createContext, useContext } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { getUserEmail, isAdmin, isAuthenticated, isStaff, logout, type Role } from "@/lib/auth";
import {
  STATUS_PEDIDO as STATUS,
  statusPedidoLabel as statusLabel,
  type StatusPedido as StatusKey,
} from "@/lib/pedido-status";
import { formatarPreco } from "@/lib/precos";

export const Route = createLazyFileRoute("/admin")({
  component: AdminPage,
});

const MATRIX_USER = "paradoxxnoob@gmail.com";

// ─── types ────────────────────────────────────────────────────────────────────

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
  cpf_cnpj: string | null;
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

type Usuario = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string | null;
};

type EventoAuditoria = {
  id: string;
  user_email: string | null;
  acao: string;
  alvo_tipo: string;
  alvo_id: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
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
  imagens?: string[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const enderecoResumo = (p: Pedido) => {
  if (!p.rua) return null;
  return [
    [p.rua, p.numero].filter(Boolean).join(", "),
    p.complemento,
    [p.bairro, p.cidade, p.estado].filter(Boolean).join(" · "),
    p.cep,
  ]
    .filter(Boolean)
    .join(" — ");
};

const RECEITA_STATUS = new Set<string>(["pago", "enviado", "concluido"]);
const podeExcluir = (p: Pedido) => !RECEITA_STATUS.has(p.status);

const parsePrecoReais = (valor: string): number | null => {
  const texto = valor.trim();
  if (!texto) return null;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const reais = Number(normalizado);
  if (!Number.isFinite(reais) || reais <= 0) return null;
  return Math.round(reais * 100);
};

const precoParaInput = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

const ROLES: Record<Role, string> = { customer: "CUSTOMER", staff: "STAFF", admin: "ADMIN" };

const ACOES_AUDITORIA: Record<string, string> = {
  "pedido.atualizar": "pedido.update",
  "pedido.excluir": "pedido.delete",
  "produto.criar": "produto.create",
  "produto.atualizar": "produto.update",
  "produto.estoque": "produto.stock",
  "produto.imagem.adicionar": "imagem.add",
  "produto.imagem.reordenar": "imagem.reorder",
  "produto.imagem.remover": "imagem.remove",
  "usuario.role": "usuario.role",
  "pix.webhook.registrar": "pix.webhook.register",
};

const STATUS_COLOR: Record<string, string> = {
  novo: "text-[#00ff41]/60",
  em_andamento: "text-yellow-400",
  pago: "text-[#00ff41]",
  enviado: "text-cyan-400",
  concluido: "text-[#00ff41]",
  cancelado: "text-red-500",
  expirado: "text-red-500/70",
  reembolsado: "text-[#00ff41]/50",
};

// ─── matrix rain ──────────────────────────────────────────────────────────────

function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ01アカサタナ";
    const fontSize = 14;
    let cols = Math.floor(canvas.width / fontSize);
    let drops = new Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const brightness = Math.random() > 0.95 ? "#ffffff" : "#00ff41";
        ctx.fillStyle = brightness;
        ctx.fillText(char, i * fontSize, y * fontSize);
        if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };

    const onResize = () => {
      cols = Math.floor(canvas.width / fontSize);
      drops = new Array(cols).fill(1);
    };
    window.addEventListener("resize", onResize);

    const interval = setInterval(draw, 40);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]" />;
}

// ─── matrix ui primitives ─────────────────────────────────────────────────────

const MX_MATRIX = {
  page: "min-h-screen bg-black font-mono text-[#00ff41]",
  border: "border-[#00ff41]/30",
  borderActive: "border-[#00ff41]",
  muted: "text-[#00ff41]/50",
  label: "text-[10px] uppercase tracking-[0.3em] text-[#00ff41]/60",
  btn: "border border-[#00ff41]/50 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#00ff41]/80 transition-all duration-200 hover:border-[#00ff41] hover:bg-[#00ff41]/10 hover:text-[#00ff41] disabled:opacity-30",
  btnActive:
    "border border-[#00ff41] bg-[#00ff41]/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#00ff41]",
  btnFill:
    "border border-[#00ff41] bg-[#00ff41] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-black transition-all duration-200 hover:bg-[#00ff41]/80 disabled:opacity-30",
  input:
    "bg-black border-[#00ff41]/40 text-[#00ff41] font-mono placeholder:text-[#00ff41]/25 focus:border-[#00ff41] rounded-none",
  row: "border-b border-[#00ff41]/10 transition-colors duration-150 hover:bg-[#00ff41]/5",
  th: "text-[10px] uppercase tracking-[0.3em] text-[#00ff41]/50 font-normal border-b border-[#00ff41]/20 py-3 px-4",
  td: "py-3 px-4 text-[11px] text-[#00ff41]/80 align-top",
};

const MX_NORMAL = {
  page: "min-h-screen bg-background font-sans text-foreground",
  border: "border-border",
  borderActive: "border-foreground",
  muted: "text-muted-foreground",
  label: "text-[10px] uppercase tracking-[0.3em] text-muted-foreground",
  btn: "border border-border px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground transition-all duration-200 hover:border-foreground hover:text-foreground disabled:opacity-30",
  btnActive:
    "border border-foreground bg-foreground/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-foreground",
  btnFill:
    "border border-foreground bg-foreground px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-background transition-all duration-200 hover:bg-foreground/80 disabled:opacity-30",
  input:
    "bg-background border-border text-foreground placeholder:text-muted-foreground/40 focus:border-foreground rounded-none",
  row: "border-b border-border transition-colors duration-150 hover:bg-secondary/40",
  th: "text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-normal border-b border-border py-3 px-4",
  td: "py-3 px-4 text-[11px] text-foreground/80 align-top",
};

const MxCtx = createContext(MX_NORMAL);
function useMx() {
  return useContext(MxCtx);
}

function MxInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const isMatrix = useContext(MxCtx) === MX_MATRIX;
  const base = isMatrix
    ? "w-full bg-black border border-[#00ff41]/40 px-3 py-2 text-[11px] font-mono text-[#00ff41] placeholder:text-[#00ff41]/25 focus:border-[#00ff41] outline-none transition-colors"
    : "w-full bg-background border border-border px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-foreground outline-none transition-colors";
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

function MxTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const isMatrix = useContext(MxCtx) === MX_MATRIX;
  const base = isMatrix
    ? "w-full bg-black border border-[#00ff41]/40 px-3 py-2 text-[11px] font-mono text-[#00ff41] placeholder:text-[#00ff41]/25 focus:border-[#00ff41] outline-none transition-colors resize-y"
    : "w-full bg-background border border-border px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-foreground outline-none transition-colors resize-y";
  return <textarea {...props} className={`${base} ${props.className ?? ""}`} />;
}

// ─── main page ────────────────────────────────────────────────────────────────

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | StatusKey>("todos");
  const [aba, setAba] = useState<"pedidos" | "produtos" | "usuarios" | "auditoria">("pedidos");
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);
  const [fotosDeId, setFotosDeId] = useState<string | null>(null);
  const admin = checked && isAdmin();
  const staff = checked && isStaff();
  const matrixMode = checked && getUserEmail() === MATRIX_USER;
  const mx = matrixMode ? MX_MATRIX : MX_NORMAL;

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

  const contagem = pedidos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const pedidosPagos = pedidos.filter((p) => RECEITA_STATUS.has(p.status));
  const receitaTotal = pedidosPagos.reduce((s, p) => s + p.total_centavos, 0);
  const agora = new Date();
  const pagosNoMes = pedidosPagos.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });
  const receitaNoMes = pagosNoMes.reduce((s, p) => s + p.total_centavos, 0);
  const ticketMedio = pedidosPagos.length > 0 ? Math.round(receitaTotal / pedidosPagos.length) : 0;

  const metricas = [
    {
      label: "receita_mes",
      valor: formatarPreco(receitaNoMes),
      nota: `${pagosNoMes.length} pedidos`,
    },
    {
      label: "receita_total",
      valor: formatarPreco(receitaTotal),
      nota: `${pedidosPagos.length} pedidos pagos`,
    },
    {
      label: "ticket_medio",
      valor: pedidosPagos.length > 0 ? formatarPreco(ticketMedio) : "NULL",
      nota: "avg order value",
    },
    { label: "a_enviar", valor: String(contagem.pago ?? 0), nota: "aguardando envio" },
  ];

  const pedidosFiltrados =
    filtro === "todos" ? pedidos : pedidos.filter((p) => p.status === filtro);

  const tabs = admin
    ? (["pedidos", "produtos", "usuarios", "auditoria"] as const)
    : (["pedidos", "produtos"] as const);

  return (
    <MxCtx.Provider value={mx}>
      <div className={mx.page}>
        {matrixMode && <MatrixRain />}

        {/* scanline overlay */}
        {matrixMode && (
          <div
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,255,65,0.015) 0px, rgba(0,255,65,0.015) 1px, transparent 1px, transparent 3px)",
            }}
          />
        )}

        <div className="relative z-20 mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <header
            className={`mb-10 flex items-start justify-between border-b pb-6 ${matrixMode ? "border-[#00ff41]/20" : "border-border"}`}
          >
            <div className={matrixMode ? "animate-matrix-flicker" : ""}>
              <p className={mx.label}>{matrixMode ? "// carolina_viapiana.sys" : "Admin"}</p>
              <h1
                className={`mt-1 text-2xl font-bold ${matrixMode ? "tracking-widest text-[#00ff41] font-mono" : "serif"}`}
              >
                {matrixMode ? (
                  <>
                    ADMIN_CONSOLE<span className="animate-matrix-blink ml-1">█</span>
                  </>
                ) : (
                  "Painel"
                )}
              </h1>
              <p className={`mt-1 text-[10px] ${mx.muted}`}>
                {matrixMode
                  ? `${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`
                  : new Date().toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className={mx.btn}>
                {matrixMode ? "< loja" : "← Loja"}
              </Link>
              <button type="button" onClick={handleLogout} className={mx.btn}>
                {matrixMode ? "logout /" : "Sair"}
              </button>
            </div>
          </header>

          {/* Tabs */}
          {staff && (
            <div
              className={`mb-8 flex flex-wrap gap-2 border-b pb-4 ${matrixMode ? "border-[#00ff41]/10" : "border-border"}`}
            >
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAba(tab)}
                  className={aba === tab ? mx.btnActive : mx.btn}
                >
                  {matrixMode
                    ? `${aba === tab ? "> " : "  "}${tab}.exe`
                    : ((
                        {
                          pedidos: "Pedidos",
                          produtos: "Produtos",
                          usuarios: "Usuários",
                          auditoria: "Auditoria",
                        } as Record<string, string>
                      )[tab] ?? tab)}
                </button>
              ))}
            </div>
          )}

          {/* ── PEDIDOS ── */}
          {aba === "pedidos" && (
            <>
              {/* metrics */}
              <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className={`border p-4 animate-pulse ${matrixMode ? "border-[#00ff41]/20" : "border-border"}`}
                      >
                        <div
                          className={`h-2 w-24 mb-3 ${matrixMode ? "bg-[#00ff41]/10" : "bg-muted"}`}
                        />
                        <div
                          className={`h-6 w-20 mb-2 ${matrixMode ? "bg-[#00ff41]/10" : "bg-muted"}`}
                        />
                        <div
                          className={`h-2 w-16 ${matrixMode ? "bg-[#00ff41]/10" : "bg-muted"}`}
                        />
                      </div>
                    ))
                  : !error
                    ? metricas.map((m) => (
                        <div
                          key={m.label}
                          className={`border p-4 transition-colors duration-200 ${matrixMode ? "border-[#00ff41]/20 hover:border-[#00ff41]/40" : "border-border hover:border-foreground/30"}`}
                        >
                          <p className={mx.label}>{m.label}</p>
                          <p
                            className={`mt-2 text-xl ${matrixMode ? "font-mono text-[#00ff41]" : "serif"}`}
                          >
                            {m.valor}
                          </p>
                          <p className={`mt-1 text-[10px] ${mx.muted}`}>{m.nota}</p>
                        </div>
                      ))
                    : null}
              </div>

              {/* filters */}
              <div className="mb-6 flex flex-wrap gap-2">
                {[
                  { value: "todos" as const, label: "ALL", count: pedidos.length },
                  ...(Object.keys(STATUS) as StatusKey[]).map((k) => ({
                    value: k,
                    label: STATUS[k].toUpperCase(),
                    count: contagem[k] ?? 0,
                  })),
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFiltro(f.value)}
                    className={filtro === f.value ? mx.btnActive : mx.btn}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {isLoading && <MxTableSkeleton cols={11} rows={6} />}
              {error && (
                <p className="text-[11px] text-red-500">
                  {matrixMode ? "// ERROR: cannot fetch pedidos" : "Erro ao carregar pedidos."}
                </p>
              )}
              {!isLoading && !error && pedidosFiltrados.length === 0 && (
                <p className={`text-[11px] ${mx.muted}`}>
                  {matrixMode ? "// RESULT: 0 rows" : "Nenhum pedido encontrado."}
                </p>
              )}

              {pedidosFiltrados.length > 0 && (
                <div
                  className={`overflow-x-auto border ${matrixMode ? "border-[#00ff41]/20" : "border-border"}`}
                >
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {[
                          "data",
                          "itens",
                          "total",
                          "frete",
                          "cliente",
                          "telefone",
                          "entrega",
                          "rastreio",
                          "obs",
                          "status",
                          "ações",
                        ].map((h) => (
                          <th key={h} className={mx.th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosFiltrados.map((pedido) => (
                        <tr key={pedido.id} className={mx.row}>
                          <td className={mx.td + " whitespace-nowrap"}>
                            {new Date(pedido.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className={mx.td}>
                            {pedido.itens.map((item) => (
                              <div key={item.id} className="whitespace-nowrap">
                                {item.quantidade}× {item.produto_nome} {item.tamanho} · {item.aroma}
                                {item.refil ? " +refil" : ""}
                              </div>
                            ))}
                          </td>
                          <td className={mx.td + " whitespace-nowrap"}>
                            {formatarPreco(pedido.total_centavos)}
                          </td>
                          <td className={mx.td + " whitespace-nowrap"}>
                            {pedido.frete_servico ? (
                              <>
                                {pedido.frete_servico}
                                <span className={`block text-[10px] ${mx.muted}`}>
                                  {pedido.frete_centavos === 0
                                    ? "GRATIS"
                                    : formatarPreco(pedido.frete_centavos)}
                                  {pedido.frete_prazo_dias != null
                                    ? ` · ${pedido.frete_prazo_dias}d`
                                    : ""}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={mx.td}>
                            {pedido.nome_cliente ?? "—"}
                            {pedido.cpf_cnpj && (
                              <span className={`block whitespace-nowrap text-[10px] ${mx.muted}`}>
                                {pedido.cpf_cnpj}
                              </span>
                            )}
                          </td>
                          <td className={mx.td + " whitespace-nowrap"}>{pedido.telefone ?? "—"}</td>
                          <td className={mx.td + " max-w-[220px]"}>
                            {enderecoResumo(pedido) ?? "—"}
                          </td>
                          <td className={mx.td}>
                            <RastreioCell
                              key={`${pedido.id}-${pedido.codigo_rastreio ?? ""}`}
                              codigo={pedido.codigo_rastreio}
                              salvando={
                                salvarRastreio.isPending &&
                                salvarRastreio.variables?.id === pedido.id
                              }
                              onSalvar={(c) => salvarRastreio.mutate({ id: pedido.id, codigo: c })}
                            />
                          </td>
                          <td className={mx.td}>{pedido.observacoes ?? "—"}</td>
                          <td className={mx.td}>
                            <Select
                              value={pedido.status}
                              onValueChange={(s) =>
                                atualizarStatus.mutate({ id: pedido.id, status: s })
                              }
                            >
                              <SelectTrigger
                                className={
                                  matrixMode
                                    ? "w-[140px] rounded-none border-[#00ff41]/30 bg-black font-mono text-[10px] text-[#00ff41] uppercase tracking-[0.1em] hover:border-[#00ff41]"
                                    : "w-[140px] rounded-none text-[10px] uppercase"
                                }
                              >
                                <SelectValue>
                                  <span
                                    className={
                                      matrixMode
                                        ? (STATUS_COLOR[pedido.status] ?? "text-[#00ff41]/60")
                                        : ""
                                    }
                                  >
                                    {statusLabel(pedido.status).toUpperCase()}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent
                                className={
                                  matrixMode
                                    ? "rounded-none border-[#00ff41]/40 bg-black font-mono"
                                    : "rounded-none"
                                }
                              >
                                {(Object.keys(STATUS) as StatusKey[]).map((key) => (
                                  <SelectItem
                                    key={key}
                                    value={key}
                                    className={
                                      matrixMode
                                        ? "rounded-none text-[10px] uppercase text-[#00ff41] focus:bg-[#00ff41]/10 focus:text-[#00ff41]"
                                        : "rounded-none text-[10px] uppercase"
                                    }
                                  >
                                    {STATUS[key].toUpperCase()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className={mx.td + " text-right"}>
                            {podeExcluir(pedido) ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    type="button"
                                    className={
                                      mx.btn +
                                      " text-red-500 border-red-500/40 hover:border-red-500 hover:bg-red-500/10 hover:text-red-500"
                                    }
                                  >
                                    {matrixMode ? "rm" : "Excluir"}
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent
                                  className={
                                    matrixMode
                                      ? "rounded-none border-[#00ff41]/40 bg-black font-mono text-[#00ff41]"
                                      : ""
                                  }
                                >
                                  <AlertDialogHeader>
                                    <AlertDialogTitle
                                      className={matrixMode ? "text-[#00ff41] font-mono" : ""}
                                    >
                                      {matrixMode ? "// CONFIRM DELETE" : "Confirmar exclusão"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription
                                      className={
                                        matrixMode
                                          ? "text-[#00ff41]/60 font-mono text-[11px]"
                                          : "text-[11px]"
                                      }
                                    >
                                      Pedido de {pedido.nome_cliente ?? "cliente"} (
                                      {formatarPreco(pedido.total_centavos)}) será removido
                                      permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel
                                      className={
                                        matrixMode
                                          ? "rounded-none border-[#00ff41]/40 bg-black font-mono text-[10px] uppercase text-[#00ff41] hover:bg-[#00ff41]/10"
                                          : "rounded-none"
                                      }
                                    >
                                      {matrixMode ? "abort" : "Cancelar"}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => excluirPedido.mutate(pedido.id)}
                                      className="rounded-none border border-red-500 bg-red-500/10 text-[10px] uppercase text-red-500 hover:bg-red-500/20"
                                    >
                                      {matrixMode ? "confirm rm" : "Excluir"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <span className={`text-[10px] ${mx.muted}`}>
                                {matrixMode ? "locked" : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── PRODUTOS ── */}
          {aba === "produtos" && staff && (
            <>
              <div className="mb-6 flex justify-end">
                <button type="button" onClick={() => setEditando("novo")} className={mx.btnFill}>
                  + novo produto
                </button>
              </div>

              {carregandoProdutos && <MxTableSkeleton cols={7} rows={5} />}
              {erroProdutos != null && (
                <p className="text-[11px] text-red-500">
                  {matrixMode ? "// ERROR: cannot fetch produtos" : "Erro ao carregar produtos."}
                </p>
              )}

              {produtos.length > 0 && (
                <div
                  className={`overflow-x-auto border ${matrixMode ? "border-[#00ff41]/20" : "border-border"}`}
                >
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["produto", "tag", "preços", "ordem", "estoque", "status", "ações"].map(
                          (h) => (
                            <th key={h} className={mx.th}>
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((produto) => (
                        <ProdutoRow
                          key={produto.id}
                          produto={produto}
                          salvandoEstoque={salvarEstoque.isPending}
                          onSalvarEstoque={(e) =>
                            salvarEstoque.mutate({ id: produto.id, estoque: e })
                          }
                          alternandoAtivo={alternarAtivo.isPending}
                          onAlternarAtivo={() =>
                            alternarAtivo.mutate({ id: produto.id, ativo: !produto.ativo })
                          }
                          onEditar={() => setEditando(produto)}
                          onFotos={() => setFotosDeId(produto.id)}
                        />
                      ))}
                    </tbody>
                  </table>
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

          {/* ── USUARIOS ── */}
          {aba === "usuarios" && admin && (
            <>
              {carregandoUsuarios && <MxTableSkeleton cols={4} rows={5} />}
              {erroUsuarios != null && (
                <p className="text-[11px] text-red-500">
                  {matrixMode ? "// ERROR: cannot fetch usuarios" : "Erro ao carregar usuários."}
                </p>
              )}

              {usuarios.length > 0 && (
                <div
                  className={`overflow-x-auto border ${matrixMode ? "border-[#00ff41]/20" : "border-border"}`}
                >
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["nome", "e-mail", "cadastro", "papel"].map((h) => (
                          <th key={h} className={mx.th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id} className={mx.row}>
                          <td className={mx.td}>{usuario.name ?? "—"}</td>
                          <td className={mx.td}>{usuario.email}</td>
                          <td className={mx.td + " whitespace-nowrap"}>
                            {usuario.created_at
                              ? new Date(usuario.created_at).toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                          <td className={mx.td}>
                            <Select
                              value={usuario.role}
                              onValueChange={(r) =>
                                alterarRole.mutate({ id: usuario.id, role: r as Role })
                              }
                            >
                              <SelectTrigger
                                className={
                                  matrixMode
                                    ? "w-[140px] rounded-none border-[#00ff41]/30 bg-black font-mono text-[10px] text-[#00ff41] uppercase tracking-[0.1em]"
                                    : "w-[140px] rounded-none text-[10px] uppercase"
                                }
                              >
                                <SelectValue>{ROLES[usuario.role]}</SelectValue>
                              </SelectTrigger>
                              <SelectContent
                                className={
                                  matrixMode
                                    ? "rounded-none border-[#00ff41]/40 bg-black font-mono"
                                    : "rounded-none"
                                }
                              >
                                {(Object.keys(ROLES) as Role[]).map((r) => (
                                  <SelectItem
                                    key={r}
                                    value={r}
                                    className={
                                      matrixMode
                                        ? "rounded-none text-[10px] uppercase text-[#00ff41] focus:bg-[#00ff41]/10"
                                        : "rounded-none text-[10px] uppercase"
                                    }
                                  >
                                    {ROLES[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── AUDITORIA ── */}
          {aba === "auditoria" && admin && <AuditoriaTab />}
        </div>
      </div>
    </MxCtx.Provider>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function MxTableSkeleton({ cols, rows }: { cols: number; rows: number }) {
  const mx = useMx();
  const isMatrix = mx === MX_MATRIX;
  const borderColor = isMatrix ? "border-[#00ff41]/20" : "border-border";
  const bg1 = isMatrix ? "bg-[#00ff41]/10" : "bg-muted";
  const bg2 = isMatrix ? "bg-[#00ff41]/5" : "bg-muted/50";
  return (
    <div className={`border ${borderColor} overflow-hidden`}>
      <div className={`border-b ${borderColor} flex gap-4 px-4 py-3`}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={`h-2 flex-1 ${bg1} animate-pulse`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex gap-4 border-b ${borderColor} px-4 py-3`}>
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={`h-3 flex-1 ${bg2} animate-pulse`}
              style={{ animationDelay: `${(i + j) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── auditoria tab ────────────────────────────────────────────────────────────

function AuditoriaTab() {
  const mx = useMx();
  const isMatrix = mx === MX_MATRIX;
  const {
    data: eventos = [],
    isLoading,
    error,
  } = useQuery<EventoAuditoria[]>({
    queryKey: ["auditoria"],
    queryFn: () => apiFetch("/admin/auditoria"),
  });

  if (isLoading) return <MxTableSkeleton cols={5} rows={8} />;
  if (error != null)
    return (
      <p className="text-[11px] text-red-500">
        {isMatrix ? "// ERROR: audit_log migration applied?" : "Erro ao carregar auditoria."}
      </p>
    );
  if (eventos.length === 0)
    return (
      <p className={`text-[11px] ${mx.muted}`}>
        {isMatrix ? "// RESULT: 0 events logged" : "Nenhum evento registrado."}
      </p>
    );

  return (
    <div className={`overflow-x-auto border ${isMatrix ? "border-[#00ff41]/20" : "border-border"}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["timestamp", "user", "action", "target", "details"].map((h) => (
              <th key={h} className={mx.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento) => (
            <tr key={evento.id} className={mx.row}>
              <td className={mx.td + " whitespace-nowrap"}>
                {new Date(evento.created_at).toLocaleString("pt-BR")}
              </td>
              <td className={mx.td}>{evento.user_email ?? "—"}</td>
              <td className={mx.td + " whitespace-nowrap font-semibold"}>
                {ACOES_AUDITORIA[evento.acao] ?? evento.acao}
              </td>
              <td className={mx.td + " whitespace-nowrap"}>
                {evento.alvo_tipo}
                {evento.alvo_id && (
                  <span className={`block text-[10px] ${mx.muted}`}>
                    {evento.alvo_id.slice(0, 8)}…
                  </span>
                )}
              </td>
              <td className={mx.td + " max-w-[320px]"}>
                {evento.detalhes ? (
                  <code className={`block break-all text-[10px] ${mx.muted}`}>
                    {JSON.stringify(evento.detalhes)}
                  </code>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── rastreio cell ────────────────────────────────────────────────────────────

function RastreioCell({
  codigo,
  salvando,
  onSalvar,
}: {
  codigo: string | null;
  salvando: boolean;
  onSalvar: (c: string) => void;
}) {
  const mx = useMx();
  const [valor, setValor] = useState(codigo ?? "");
  const alterado = valor.trim() !== (codigo ?? "");

  return (
    <div className="flex items-center gap-2">
      <MxInput
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="código…"
        className="w-[130px] text-[10px]"
      />
      {alterado && (
        <button
          type="button"
          disabled={salvando}
          onClick={() => onSalvar(valor.trim())}
          className={mx.btnFill + " py-1 px-2"}
        >
          {salvando ? "…" : "save"}
        </button>
      )}
    </div>
  );
}

// ─── produto row ──────────────────────────────────────────────────────────────

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
  onSalvarEstoque: (e: number) => void;
  alternandoAtivo: boolean;
  onAlternarAtivo: () => void;
  onEditar: () => void;
  onFotos: () => void;
}) {
  const mx = useMx();
  const isMatrix = mx === MX_MATRIX;
  const [valor, setValor] = useState(String(produto.estoque));
  useEffect(() => {
    setValor(String(produto.estoque));
  }, [produto.estoque]);
  const parsed = Number.parseInt(valor, 10);
  const valido = Number.isInteger(parsed) && parsed >= 0;
  const alterado = valido && parsed !== produto.estoque;

  return (
    <tr className={`${mx.row} ${produto.ativo ? "" : "opacity-40"}`}>
      <td className={mx.td}>{produto.nome}</td>
      <td className={`${mx.td} ${mx.muted}`}>{produto.tag ?? "—"}</td>
      <td className={mx.td}>
        {produto.tamanhos.map((t) => (
          <div key={t} className="whitespace-nowrap text-[10px]">
            {t} ·{" "}
            {produto.precos[t] !== undefined ? (
              formatarPreco(produto.precos[t])
            ) : (
              <span className="text-red-500">sem preço</span>
            )}
          </div>
        ))}
      </td>
      <td className={`${mx.td} ${mx.muted}`}>{produto.ordem}</td>
      <td className={mx.td}>
        <div className="flex items-center gap-2">
          <MxInput
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-20 text-[11px]"
          />
          <button
            type="button"
            disabled={!alterado || salvandoEstoque}
            onClick={() => onSalvarEstoque(parsed)}
            className={mx.btn + " py-1 px-2"}
          >
            {salvandoEstoque ? "…" : "save"}
          </button>
          {produto.estoque === 0 && <span className="text-[10px] text-red-500">ESGOTADO</span>}
        </div>
      </td>
      <td className={mx.td}>
        <span
          className={produto.ativo ? (isMatrix ? "text-[#00ff41]" : "text-green-600") : mx.muted}
        >
          {produto.ativo ? "● ATIVO" : "○ INATIVO"}
        </span>
      </td>
      <td className={mx.td}>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onEditar} className={mx.btn + " py-1 px-2"}>
            edit
          </button>
          <button type="button" onClick={onFotos} className={mx.btn + " py-1 px-2"}>
            imgs
          </button>
          <button
            type="button"
            disabled={alternandoAtivo}
            onClick={onAlternarAtivo}
            className={mx.btn + " py-1 px-2"}
          >
            {produto.ativo ? "deact" : "act"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── produto dialog ───────────────────────────────────────────────────────────

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
  const mx = useMx();
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [tag, setTag] = useState(produto?.tag ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [ordem, setOrdem] = useState(String(produto?.ordem ?? 0));
  const [linhas, setLinhas] = useState<LinhaPreco[]>(
    produto
      ? produto.tamanhos.map((t) => ({
          tamanho: t,
          preco: produto.precos[t] !== undefined ? precoParaInput(produto.precos[t]) : "",
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

  const setLinha = (i: number, campo: keyof LinhaPreco, v: string) =>
    setLinhas((cur) => cur.map((l, idx) => (idx === i ? { ...l, [campo]: v } : l)));

  const tamanhos = linhas.map((l) => l.tamanho.trim());
  const podeSalvar =
    nome.trim().length > 0 &&
    Number.isInteger(Number.parseInt(ordem, 10)) &&
    linhas.length > 0 &&
    linhas.every((l) => l.tamanho.trim() && parsePrecoReais(l.preco) !== null) &&
    new Set(tamanhos).size === tamanhos.length;

  const handleSalvar = () => {
    const precos: Record<string, number> = {};
    for (const l of linhas) precos[l.tamanho.trim()] = parsePrecoReais(l.preco)!;
    salvar.mutate({
      nome: nome.trim(),
      tag: tag.trim() || null,
      descricao: descricao.trim() || null,
      ordem: Number.parseInt(ordem, 10),
      tamanhos,
      precos,
    });
  };

  const isMatrix = mx === MX_MATRIX;
  const erroSalvar =
    salvar.error instanceof ApiError && salvar.error.detail
      ? salvar.error.detail
      : salvar.error
        ? isMatrix
          ? "// ERROR: save failed"
          : "Erro ao salvar."
        : null;
  const dlgContent = isMatrix
    ? "max-h-[90vh] overflow-y-auto rounded-none border-[#00ff41]/40 bg-black font-mono text-[#00ff41] sm:max-w-lg"
    : "max-h-[90vh] overflow-y-auto sm:max-w-lg";
  const dlgTitle = isMatrix ? "font-mono text-[#00ff41]" : "";
  const dlgDesc = isMatrix ? "font-mono text-[11px] text-[#00ff41]/50" : "text-[11px]";

  return (
    <Dialog open onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className={dlgContent}>
        <DialogHeader>
          <DialogTitle className={dlgTitle}>
            {produto ? `Editar: ${produto.nome}` : "Novo produto"}
          </DialogTitle>
          <DialogDescription className={dlgDesc}>
            Preços em R$ por tamanho. Produto aparece quando ativo e com preço.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className={mx.label}>nome</label>
            <MxInput value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={mx.label}>tag</label>
              <MxInput
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Mais vendido"
              />
            </div>
            <div className="space-y-1">
              <label className={mx.label}>ordem</label>
              <MxInput type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={mx.label}>descrição</label>
            <MxTextarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <label className={mx.label}>tamanhos + preços</label>
            {linhas.map((linha, i) => (
              <div key={i} className="flex items-center gap-2">
                <MxInput
                  value={linha.tamanho}
                  onChange={(e) => setLinha(i, "tamanho", e.target.value)}
                  placeholder="250ml"
                  className="w-24"
                />
                <span className={`text-[11px] ${mx.muted}`}>R$</span>
                <MxInput
                  value={linha.preco}
                  onChange={(e) => setLinha(i, "preco", e.target.value)}
                  placeholder="79,90"
                  className="w-24"
                />
                <button
                  type="button"
                  disabled={linhas.length === 1}
                  onClick={() => setLinhas((cur) => cur.filter((_, idx) => idx !== i))}
                  className={mx.btn + " py-1 px-2"}
                >
                  rm
                </button>
              </div>
            ))}
            {new Set(tamanhos).size !== tamanhos.length && (
              <p className="text-[11px] text-red-500">
                {isMatrix ? "// duplicate tamanhos" : "Tamanhos duplicados."}
              </p>
            )}
            <button
              type="button"
              onClick={() => setLinhas((cur) => [...cur, { tamanho: "", preco: "" }])}
              className={mx.btn + " py-1 px-3"}
            >
              + tamanho
            </button>
          </div>
          {erroSalvar && <p className="text-[11px] text-red-500">{erroSalvar}</p>}
        </div>
        <DialogFooter>
          <button type="button" onClick={onFechar} className={mx.btn}>
            {isMatrix ? "abort" : "Cancelar"}
          </button>
          <button
            type="button"
            disabled={!podeSalvar || salvar.isPending}
            onClick={handleSalvar}
            className={mx.btnFill}
          >
            {salvar.isPending ? (isMatrix ? "saving…" : "Salvando…") : isMatrix ? "save" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── fotos dialog ─────────────────────────────────────────────────────────────

function FotosDialog({
  produto,
  onFechar,
  onAtualizado,
}: {
  produto: Produto;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const mx = useMx();
  const isMatrix = mx === MX_MATRIX;
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
          ? isMatrix
            ? "// ERROR: save failed"
            : "Erro ao salvar."
          : null,
    )
    .find((m) => m !== null);
  const dlgContent = isMatrix
    ? "max-h-[90vh] overflow-y-auto rounded-none border-[#00ff41]/40 bg-black font-mono text-[#00ff41] sm:max-w-lg"
    : "max-h-[90vh] overflow-y-auto sm:max-w-lg";

  return (
    <Dialog open onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className={dlgContent}>
        <DialogHeader>
          <DialogTitle className={isMatrix ? "font-mono text-[#00ff41]" : ""}>
            {isMatrix ? `// imgs: ${produto.nome}` : `Imagens: ${produto.nome}`}
          </DialogTitle>
          <DialogDescription
            className={isMatrix ? "font-mono text-[11px] text-[#00ff41]/50" : "text-[11px]"}
          >
            {isMatrix
              ? "primeira imagem = principal. sem fotos enviadas, usa fotos embutidas."
              : "Primeira imagem é a principal. Sem fotos enviadas, usa fotos embutidas."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {imagens.length === 0 && (
            <p className={`text-[11px] ${mx.muted}`}>
              {isMatrix ? "// 0 imagens" : "Nenhuma imagem enviada."}
            </p>
          )}
          {imagens.map((url, i) => (
            <div
              key={url}
              className={`flex items-center gap-3 border p-2 transition-colors ${isMatrix ? "border-[#00ff41]/20 hover:border-[#00ff41]/40" : "border-border hover:border-foreground/30"}`}
            >
              <img
                src={url}
                alt={`img ${i + 1}`}
                width={64}
                height={64}
                loading="lazy"
                className={`h-12 w-12 object-cover ${isMatrix ? "bg-[#00ff41]/5" : "bg-muted"}`}
              />
              <span className={`flex-1 text-[10px] ${mx.muted}`}>
                {i === 0 ? (isMatrix ? "[PRINCIPAL]" : "Principal") : `img ${i + 1}`}
              </span>
              {i > 0 && (
                <button
                  type="button"
                  disabled={tornarPrincipal.isPending}
                  onClick={() => tornarPrincipal.mutate(url)}
                  className={mx.btn + " py-1 px-2"}
                >
                  {isMatrix ? "set main" : "Principal"}
                </button>
              )}
              <button
                type="button"
                disabled={remover.isPending}
                onClick={() => remover.mutate(url)}
                className={
                  mx.btn +
                  " py-1 px-2 text-red-500 border-red-500/40 hover:border-red-500 hover:bg-red-500/10"
                }
              >
                rm
              </button>
            </div>
          ))}
          <div className="space-y-1">
            <label className={mx.label}>upload (jpg/png/webp · max 5mb)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={enviar.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviar.mutate(f);
                e.target.value = "";
              }}
              className={
                isMatrix
                  ? "w-full bg-black text-[11px] text-[#00ff41] file:mr-3 file:border file:border-[#00ff41]/40 file:bg-black file:px-3 file:py-1 file:text-[10px] file:font-mono file:uppercase file:text-[#00ff41] file:hover:bg-[#00ff41]/10"
                  : "w-full text-[11px] text-foreground file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1 file:text-[10px] file:uppercase file:text-foreground file:hover:bg-secondary"
              }
            />
            {enviar.isPending && <p className={`text-[11px] ${mx.muted}`}>uploading…</p>}
          </div>
          {erro && <p className="text-[11px] text-red-500">{erro}</p>}
        </div>
        <DialogFooter>
          <button type="button" onClick={onFechar} className={mx.btn}>
            fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
