import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { isAuthenticated, isStaff } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { formatarPreco, menorPreco, type ProdutoApi } from "@/lib/precos";
import hero from "@/assets/products/difusor_vidro3.jpeg";
import { imagensDoProduto } from "@/lib/produto-imagens";
import { normalizarBusca, slugify } from "@/lib/utils";
import { AtendimentoForm } from "@/components/AtendimentoForm";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Carolina Viapiana — Perfumando Ambientes" },
      {
        name: "description",
        content:
          "Difusores de vidro e PET, home sprays, kits lavabo, aromatizadores para carro e refis. Aromas exclusivos para perfumar seu ambiente. Loja física em Ponta Grossa-PR.",
      },
    ],
  }),
});

type Categoria = { nome: string; total_produtos: number };

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

function Header() {
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

  return (
    <>
      <header
        className={`fixed top-0 z-30 w-full transition-all duration-500 ${
          scrolled
            ? "border-b border-background/10 bg-foreground/90 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 md:px-12 ${
            scrolled ? "py-4" : "py-6"
          }`}
        >
          <a href="#topo" className="flex items-center gap-3">
            <img src={logo} alt="Carolina Viapiana" width={40} height={40} className="invert" />
            <span className="serif text-lg tracking-wide text-background">Carolina Viapiana</span>
          </a>
          <nav className="hidden gap-10 text-xs uppercase tracking-[0.25em] text-background/80 md:flex">
            <a href="#produtos" className="transition-colors hover:text-background">
              Produtos
            </a>
            <a href="#sobre" className="transition-colors hover:text-background">
              Sobre
            </a>
            <a href="#atendimento" className="transition-colors hover:text-background">
              Atendimento
            </a>
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
              { href: "#produtos", label: "Produtos" },
              { href: "#sobre", label: "Sobre" },
              { href: "#atendimento", label: "Atendimento" },
            ].map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuAberto(false)}
                className="animate-fade-up border-b border-background/10 py-5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="serif text-4xl">{item.label}</span>
              </a>
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

function Hero() {
  return (
    <section
      id="topo"
      className="relative min-h-screen w-full overflow-hidden bg-foreground text-background"
    >
      <img
        src={hero}
        alt="Difusor de aromas Carolina Viapiana"
        width={1280}
        height={1600}
        className="absolute inset-0 h-full w-full object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/30 to-foreground" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-6 pb-24 pt-40 md:px-12">
        <span
          className="animate-fade-up mb-6 text-xs uppercase tracking-[0.4em] text-background/70"
          style={{ animationDelay: "100ms" }}
        >
          Perfumando ambientes desde sempre
        </span>
        <h1
          className="serif animate-fade-up text-5xl leading-[1.05] md:text-7xl lg:text-8xl"
          style={{ animationDelay: "250ms" }}
        >
          A assinatura
          <br />
          olfativa da
          <br />
          <em className="font-light italic">sua casa.</em>
        </h1>
        <p
          className="animate-fade-up mt-8 max-w-md text-base font-light text-background/80"
          style={{ animationDelay: "450ms" }}
        >
          Difusores, home sprays e refis criados artesanalmente em Ponta Grossa-PR. Aromas que
          transformam o ar e contam histórias.
        </p>
        <div
          className="animate-fade-up mt-10 flex flex-wrap gap-4"
          style={{ animationDelay: "600ms" }}
        >
          <a
            href="#atendimento"
            className="border border-background bg-background px-8 py-4 text-xs uppercase tracking-[0.3em] text-foreground transition-colors duration-300 hover:bg-transparent hover:text-background"
          >
            Fazer um pedido
          </a>
          <a
            href="#produtos"
            className="border border-background/60 px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors duration-300 hover:border-background hover:bg-background hover:text-foreground"
          >
            Ver produtos
          </a>
        </div>
      </div>
      <a
        href="#produtos"
        aria-label="Rolar para produtos"
        className="animate-fade-up absolute bottom-24 right-6 z-10 hidden flex-col items-center gap-3 md:flex md:right-12"
        style={{ animationDelay: "900ms" }}
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-background/60 [writing-mode:vertical-rl]">
          Scroll
        </span>
        <span className="h-16 w-px bg-background/40" />
      </a>
    </section>
  );
}

function Produtos() {
  const { data: catalogo = [] } = useQuery<ProdutoApi[]>({
    queryKey: ["produtos"],
    queryFn: () => apiFetch("/produtos"),
  });
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => apiFetch("/categorias"),
  });

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const termo = normalizarBusca(busca.trim());
  const produtos = catalogo.filter(
    (p) =>
      (categoria === null || p.tag === categoria) &&
      (termo === "" || normalizarBusca(`${p.nome} ${p.descricao ?? ""}`).includes(termo)),
  );

  return (
    <section id="produtos" className="bg-background py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <Reveal className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              Coleção
            </span>
            <h2 className="serif mt-3 text-5xl md:text-6xl">Linha completa de aromas</h2>
          </div>
          <p className="max-w-md text-muted-foreground">
            Toda a coleção, pensada para diferentes ambientes e ocasiões. Busque pelo nome ou
            navegue pelas categorias.
          </p>
        </Reveal>

        <Reveal className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[{ nome: "Todos", total_produtos: catalogo.length }, ...categorias].map((c) => {
              const valor = c.nome === "Todos" ? null : c.nome;
              const ativo = categoria === valor;
              return (
                <button
                  key={c.nome}
                  onClick={() => setCategoria(valor)}
                  className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                    ativo
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {c.nome}
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto…"
            aria-label="Buscar produto"
            className="w-full border-0 border-b border-foreground bg-transparent px-0 py-2 text-base outline-none placeholder:text-muted-foreground md:max-w-xs"
          />
        </Reveal>

        {produtos.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            Nenhum produto encontrado{busca.trim() ? ` para “${busca.trim()}”` : ""}.
          </p>
        )}

        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {produtos.map((p, i) => {
            const fotos = imagensDoProduto(p);
            const precoInicial = menorPreco(p.precos);
            return (
              <Reveal key={p.id} delay={i * 100} className="bg-background">
                <article className="group flex h-full flex-col p-6">
                  <Link to="/produto/$slug" params={{ slug: slugify(p.nome) }}>
                    <div className="relative overflow-hidden bg-secondary">
                      {fotos[0] ? (
                        <img
                          src={fotos[0]}
                          alt={p.nome}
                          width={800}
                          height={1000}
                          loading="lazy"
                          className="h-80 w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-80 w-full items-center justify-center">
                          <span className="serif text-6xl text-foreground/20">
                            {p.nome.charAt(0)}
                          </span>
                        </div>
                      )}
                      {fotos[1] && (
                        <img
                          src={fotos[1]}
                          alt=""
                          width={800}
                          height={1000}
                          loading="lazy"
                          aria-hidden
                          className="absolute inset-0 h-80 w-full bg-secondary object-contain opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
                        />
                      )}
                      <span className="serif absolute left-4 top-3 text-sm tracking-widest text-foreground/60">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col pt-6">
                    {p.tag && (
                      <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        {p.tag}
                      </span>
                    )}
                    <h3 className="serif mt-2 text-2xl">{p.nome}</h3>
                    {p.descricao && (
                      <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.descricao}</p>
                    )}
                    {precoInicial !== null && (
                      <p className="mt-4 text-sm">
                        <span className="text-muted-foreground">a partir de </span>
                        {formatarPreco(precoInicial)}
                      </p>
                    )}
                    <Link
                      to="/produto/$slug"
                      params={{ slug: slugify(p.nome) }}
                      className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors group-hover:text-foreground"
                    >
                      Ver produto
                      <span className="h-px w-6 bg-current transition-all duration-300 group-hover:w-10" />
                    </Link>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Sobre() {
  return (
    <section id="sobre" className="bg-foreground py-28 text-background">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-2 md:px-12">
        <Reveal>
          <span className="text-xs uppercase tracking-[0.4em] text-background/60">Sobre nós</span>
          <h2 className="serif mt-3 text-5xl md:text-6xl">
            Aroma é memória.
            <br />
            <em className="italic">É afeto.</em>
          </h2>
        </Reveal>
        <Reveal delay={150} className="space-y-6 text-background/80">
          <p>
            Há anos perfumando lares, escritórios, lojas e momentos. A Carolina Viapiana nasceu da
            paixão por criar atmosferas que ficam na lembrança de quem entra e de quem vive cada
            ambiente.
          </p>
          <p>
            Trabalhamos com matéria-prima de alta qualidade, fixação prolongada e fragrâncias
            autorais. Da loja física em Ponta Grossa para todo o Brasil.
          </p>
          <div className="grid grid-cols-3 gap-6 pt-6">
            <div className="border-t border-background/20 pt-4">
              <div className="serif text-4xl">+10</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-background/60">
                Anos de mercado
              </div>
            </div>
            <div className="border-t border-background/20 pt-4">
              <div className="serif text-4xl">30+</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-background/60">
                Aromas exclusivos
              </div>
            </div>
            <div className="border-t border-background/20 pt-4">
              <div className="serif text-4xl">BR</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-background/60">
                Entregas em todo país
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Atendimento() {
  return (
    <section id="atendimento" className="bg-background py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <Reveal className="mb-16 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Atendimento
          </span>
          <h2 className="serif mt-3 text-5xl md:text-6xl">Monte seu pedido</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Escolha o produto, o tamanho, o aroma e nós cuidamos do resto. Seu pedido será enviado
            direto para o WhatsApp da loja.
          </p>
        </Reveal>
        <Reveal delay={150} className="border border-foreground/10 bg-secondary/40 p-8 md:p-14">
          <AtendimentoForm />
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
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
              <a href="#produtos" className="w-fit transition-colors hover:text-background">
                Produtos
              </a>
              <a href="#sobre" className="w-fit transition-colors hover:text-background">
                Sobre
              </a>
              <a href="#atendimento" className="w-fit transition-colors hover:text-background">
                Atendimento
              </a>
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

function Index() {
  return (
    <main>
      <Header />
      <Hero />
      <Produtos />
      <Sobre />
      <Atendimento />
      <Footer />
    </main>
  );
}
