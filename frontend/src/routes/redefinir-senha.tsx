import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { ApiError, apiFetch } from "@/lib/api";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

function parseRecoveryHash(): { accessToken: string | null; valid: boolean } {
  if (typeof window === "undefined") return { accessToken: null, valid: false };
  const hash = window.location.hash.slice(1); // strip leading '#'
  const params = new URLSearchParams(hash);
  const type = params.get("type");
  const accessToken = params.get("access_token");
  return { accessToken, valid: type === "recovery" && !!accessToken };
}

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenValido, setTokenValido] = useState<boolean | null>(null); // null = loading
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    const { accessToken: token, valid } = parseRecoveryHash();
    setAccessToken(token);
    setTokenValido(valid);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!accessToken) return;

    setLoading(true);
    try {
      await apiFetch("/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      setConcluido(true);
      setTimeout(() => navigate({ to: "/login" }), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Não foi possível redefinir a senha.");
      } else {
        setError("Não foi possível redefinir a senha. Tente solicitar um novo link.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 flex flex-col items-center gap-3">
          <img src={logo} alt="Carolina Viapiana" width={48} height={48} />
          <span className="serif text-2xl">Carolina Viapiana</span>
        </Link>

        <h1 className="serif mb-8 text-4xl">Nova senha</h1>

        {tokenValido === null && <p className="text-sm text-muted-foreground">Verificando link…</p>}

        {tokenValido === false && (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </p>
            <Link
              to="/esqueci-senha"
              className="block text-sm text-foreground underline underline-offset-4"
            >
              Solicitar novo link
            </Link>
          </div>
        )}

        {tokenValido === true && !concluido && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Nova senha
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-none border-0 border-b border-foreground bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Confirmar senha
              </Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-none border-0 border-b border-foreground bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        )}

        {concluido && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Senha redefinida com sucesso. Redirecionando para o login…
            </p>
            <Link
              to="/login"
              className="block text-sm text-foreground underline underline-offset-4"
            >
              Ir para o login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
