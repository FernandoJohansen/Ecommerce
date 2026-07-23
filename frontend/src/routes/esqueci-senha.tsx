import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/esqueci-senha")({
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setEnviado(true);
    } catch {
      setError("Não foi possível enviar o e-mail. Tente novamente.");
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

        <h1 className="serif mb-4 text-4xl">Recuperar senha</h1>

        {enviado ? (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Se existe uma conta com este e-mail, você receberá as instruções em instantes.
              Verifique também a caixa de spam.
            </p>
            <Link
              to="/login"
              className="block text-center text-sm text-foreground underline underline-offset-4"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-8 text-sm text-muted-foreground">
              Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="rounded-none border-0 border-b border-foreground bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {loading ? "Enviando…" : "Enviar link"}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Lembrou a senha?{" "}
              <Link to="/login" className="text-foreground underline underline-offset-4">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
