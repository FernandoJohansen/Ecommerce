import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
});

type SignupResponse = {
  access_token: string | null;
  needs_confirmation: boolean;
};

const inputClass =
  "rounded-none border-0 border-b border-foreground bg-transparent px-0 shadow-none focus-visible:ring-0";

const labelClass = "text-xs uppercase tracking-[0.2em] text-muted-foreground";

function CadastroPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<SignupResponse>("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome.trim(),
          phone: celular.trim(),
          email: email.trim(),
          password: senha,
        }),
      });
      if (data.access_token) {
        setToken(data.access_token);
        navigate({ to: "/perfil" });
        return;
      }
      setAguardandoConfirmacao(true);
    } catch {
      setError("Não foi possível criar a conta. Verifique os dados ou tente outro e-mail.");
    } finally {
      setLoading(false);
    }
  };

  if (aguardandoConfirmacao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="mb-10 flex flex-col items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={48} height={48} />
            <span className="serif text-2xl">Carolina Viapiana</span>
          </Link>
          <h1 className="serif mb-4 text-3xl">Confirme seu e-mail</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, é só
            entrar com sua senha.
          </p>
          <Link
            to="/login"
            className="text-xs uppercase tracking-[0.3em] underline underline-offset-4"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 flex flex-col items-center gap-3">
          <img src={logo} alt="Carolina Viapiana" width={48} height={48} />
          <span className="serif text-2xl">Carolina Viapiana</span>
        </Link>

        <h1 className="serif mb-8 text-4xl">Criar conta</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className={labelClass}>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Celular</Label>
            <Input
              type="tel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              required
              minLength={8}
              maxLength={20}
              placeholder="(42) 99999-9999"
              autoComplete="tel"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
