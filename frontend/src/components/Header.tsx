import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { isAuthenticated, isStaff } from "@/lib/auth";

function AuthLinks() {
  const [logado, setLogado] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    setLogado(isAuthenticated());
    setAdmin(isStaff());
  }, []);

  if (!logado) {
    return (
      <Link to="/login" className="hover:text-background">
        Entrar
      </Link>
    );
  }

  return (
    <>
      {admin && (
        <Link to="/admin" className="hover:text-background">
          Admin
        </Link>
      )}
      <Link to="/pedidos" className="hover:text-background">
        Pedidos
      </Link>
      <Link to="/carrinho" className="hover:text-background">
        Carrinho
      </Link>
      <Link to="/perfil" className="hover:text-background">
        Meu perfil
      </Link>
    </>
  );
}

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuAberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAberto]);

  const dark = !isHome || scrolled;

  return (
    <>
      <header
        className={`fixed top-0 z-30 w-full transition-all duration-500 ${
          dark
            ? "border-b border-background/10 bg-foreground/90 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 md:px-12 ${
            dark ? "py-4" : "py-6"
          }`}
        >
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} className="invert" />
            <span className="serif text-lg tracking-wide text-background">Carolina Viapiana</span>
          </Link>
          <nav className="hidden gap-10 text-xs uppercase tracking-[0.25em] text-background/80 md:flex">
            <Link to="/produtos" className="transition-colors hover:text-background">
              Produtos
            </Link>
            <Link to="/sobre" className="transition-colors hover:text-background">
              Sobre
            </Link>
            <Link to="/atendimento" className="transition-colors hover:text-background">
              Atendimento
            </Link>
            <AuthLinks />
          </nav>
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="flex flex-col gap-1.5 p-2 md:hidden"
          >
            <span className="block h-px w-6 bg-background" />
            <span className="block h-px w-6 bg-background" />
          </button>
        </div>
      </header>

      {menuAberto && (
        <div className="fixed inset-0 z-40 flex flex-col bg-foreground text-background md:hidden">
          <div className="flex items-center justify-between px-6 py-6">
            <span className="serif text-lg tracking-wide">Carolina Viapiana</span>
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="p-2 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-2 px-6">
            {[
              { to: "/produtos" as const, label: "Produtos" },
              { to: "/sobre" as const, label: "Sobre" },
              { to: "/atendimento" as const, label: "Atendimento" },
            ].map((item, i) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuAberto(false)}
                className="animate-fade-up border-b border-background/10 py-5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="serif text-4xl">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-8 px-6 pb-10 text-xs uppercase tracking-[0.25em] text-background/70">
            <AuthLinks />
          </div>
        </div>
      )}
    </>
  );
}
