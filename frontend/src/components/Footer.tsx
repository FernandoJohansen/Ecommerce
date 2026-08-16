import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-12">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="" width={36} height={36} className="invert" />
              <span className="serif text-xl">Carolina Viapiana</span>
            </div>
            <p className="mt-5 max-w-sm text-sm font-light text-background/70">
              Difusores, home sprays e refis artesanais. Aromas exclusivos que transformam ambientes
              e ficam na memória.
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-background/50">
              Navegação
            </span>
            <nav className="mt-5 flex flex-col gap-3 text-sm text-background/80">
              <Link to="/produtos" className="w-fit transition-colors hover:text-background">
                Produtos
              </Link>
              <Link to="/sobre" className="w-fit transition-colors hover:text-background">
                Sobre
              </Link>
              <Link to="/atendimento" className="w-fit transition-colors hover:text-background">
                Atendimento
              </Link>
            </nav>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-background/50">
              Contato
            </span>
            <div className="mt-5 flex flex-col gap-3 text-sm text-background/80">
              <p>
                Bonifácio Vilela, 1633
                <br />
                Ponta Grossa, PR · 84015-460
              </p>
              <a
                href="https://instagram.com/carolinaviapiana"
                target="_blank"
                rel="noreferrer"
                className="w-fit transition-colors hover:text-background"
              >
                @carolinaviapiana
              </a>
            </div>
          </div>
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-background/10 pt-8 text-xs text-background/50 md:flex-row">
          <p>© {new Date().getFullYear()} Carolina Viapiana. Todos os direitos reservados.</p>
          <p className="uppercase tracking-[0.25em]">Entregas para todo o Brasil</p>
        </div>
      </div>
    </footer>
  );
}
