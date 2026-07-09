import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { isAuthenticated, logout } from "@/lib/auth";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
});

type Perfil = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

function iniciais(perfil: Perfil): string {
  const base = perfil.name?.trim() || perfil.email;
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function PerfilPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    setChecked(true);
  }, [navigate]);

  const {
    data: perfil,
    isLoading,
    error,
  } = useQuery<Perfil>({
    queryKey: ["perfil"],
    queryFn: () => apiFetch("/auth/me"),
    enabled: checked,
  });

  const salvarNome = useMutation({
    mutationFn: (name: string) =>
      apiFetch<Perfil>("/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: (atualizado) => {
      queryClient.setQueryData(["perfil"], atualizado);
      setEditando(false);
    },
  });

  const enviarFoto = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<Perfil>("/auth/me/avatar", { method: "POST", body: formData });
    },
    onSuccess: (atualizado) => {
      queryClient.setQueryData(["perfil"], atualizado);
    },
  });

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) enviarFoto.mutate(file);
    e.target.value = "";
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    salvarNome.mutate(nome.trim());
  };

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} />
            <span className="serif text-xl">Meu perfil</span>
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
              <Link to="/carrinho">Carrinho</Link>
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

        {isLoading && <p className="text-sm text-muted-foreground">Carregando perfil…</p>}

        {error && <p className="text-sm text-destructive">Não foi possível carregar o perfil.</p>}

        {perfil && (
          <div className="border border-border p-8 sm:p-12">
            <div className="mb-10 flex items-center gap-6">
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviarFoto.isPending}
                  aria-label="Alterar foto de perfil"
                  className="group relative flex size-20 items-center justify-center overflow-hidden border border-foreground disabled:opacity-50"
                >
                  {perfil.avatar_url ? (
                    <img
                      src={perfil.avatar_url}
                      alt="Foto de perfil"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="serif text-2xl">{iniciais(perfil)}</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1 text-center text-[9px] uppercase tracking-widest text-background opacity-0 transition-opacity group-hover:opacity-100">
                    {enviarFoto.isPending ? "Enviando…" : "Alterar"}
                  </span>
                </button>
              </div>
              <div className="min-w-0">
                <h1 className="serif truncate text-3xl">{perfil.name ?? "Sem nome"}</h1>
                <p className="truncate text-sm text-muted-foreground">{perfil.email}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviarFoto.isPending}
                  className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {enviarFoto.isPending ? "Enviando foto…" : "Alterar foto"}
                </button>
                {enviarFoto.isError && (
                  <p className="mt-1 text-xs text-destructive">
                    Não foi possível enviar a foto (JPG, PNG ou WebP, até 2MB).
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Nome
                </Label>
                {editando ? (
                  <form onSubmit={handleSalvar} className="flex items-end gap-4">
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      autoFocus
                      required
                      maxLength={120}
                      className="rounded-none border-0 border-b border-foreground bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      disabled={salvarNome.isPending}
                      className="rounded-none bg-foreground text-xs uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {salvarNome.isPending ? "Salvando…" : "Salvar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditando(false)}
                      className="rounded-none border-foreground text-xs uppercase tracking-[0.2em]"
                    >
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                    <span className="text-sm">{perfil.name ?? "—"}</span>
                    <button
                      onClick={() => {
                        setNome(perfil.name ?? "");
                        setEditando(true);
                      }}
                      className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Editar
                    </button>
                  </div>
                )}
                {salvarNome.isError && (
                  <p className="text-sm text-destructive">Não foi possível salvar o nome.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Celular
                </Label>
                <div className="border-b border-border pb-2">
                  <span className="text-sm">{perfil.phone ?? "—"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  E-mail
                </Label>
                <div className="border-b border-border pb-2">
                  <span className="text-sm">{perfil.email}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
