import { createFileRoute } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import hero from "@/assets/hero-diffuser.jpg";
import pGlass from "@/assets/product-glass.jpg";
import pPet from "@/assets/product-pet.jpg";
import pSpray from "@/assets/product-spray.jpg";
import pRefill from "@/assets/product-refill.jpg";
import { AtendimentoForm } from "@/components/AtendimentoForm";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Carolina Viapiana — Perfumando Ambientes" },
      {
        name: "description",
        content:
          "Difusores de vidro, difusores PET, home sprays e refis. Aromas exclusivos para perfumar seu ambiente. Loja física em Ponta Grossa-PR.",
      },
    ],
  }),
});

const products = [
  {
    img: pGlass,
    nome: "Difusor de Vidro",
    desc: "Disponível em 250ml e 500ml. Frasco em vidro com fitas e varetas pretas.",
    tag: "Linha Premium",
  },
  {
    img: pPet,
    nome: "Difusor PET",
    desc: "Tamanho único 250ml. Praticidade em embalagem leve e resistente.",
    tag: "Tamanho único",
  },
  {
    img: pSpray,
    nome: "Home Spray",
    desc: "Borrife e perfume o ambiente em segundos. Fixação prolongada.",
    tag: "Aplicação rápida",
  },
  {
    img: pRefill,
    nome: "Refis",
    desc: "Renove o aroma do seu difusor com nossos refis em diversos volumes.",
    tag: "Recarregue & economize",
  },
];

function Header() {
  return (
    <header className="absolute top-0 z-20 w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-12">
        <a href="#topo" className="flex items-center gap-3">
          <img
            src={logo}
            alt="Carolina Viapiana"
            width={40}
            height={40}
            className="invert"
          />
          <span className="serif text-lg text-background tracking-wide">
            Carolina Viapiana
          </span>
        </a>
        <nav className="hidden gap-10 text-xs uppercase tracking-[0.25em] text-background/80 md:flex">
          <a href="#produtos" className="hover:text-background">
            Produtos
          </a>
          <a href="#sobre" className="hover:text-background">
            Sobre
          </a>
          <a href="#atendimento" className="hover:text-background">
            Atendimento
          </a>
        </nav>
      </div>
    </header>
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
        <span className="mb-6 text-xs uppercase tracking-[0.4em] text-background/70">
          Perfumando ambientes desde sempre
        </span>
        <h1 className="serif text-5xl leading-[1.05] md:text-7xl lg:text-8xl">
          A assinatura
          <br />
          olfativa da
          <br />
          <em className="font-light italic">sua casa.</em>
        </h1>
        <p className="mt-8 max-w-md text-base font-light text-background/80">
          Difusores, home sprays e refis criados artesanalmente em Ponta
          Grossa-PR. Aromas que transformam o ar e contam histórias.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#atendimento"
            className="border border-background bg-background px-8 py-4 text-xs uppercase tracking-[0.3em] text-foreground transition hover:bg-transparent hover:text-background"
          >
            Fazer um pedido
          </a>
          <a
            href="#produtos"
            className="border border-background/60 px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition hover:border-background"
          >
            Ver produtos
          </a>
        </div>
      </div>
    </section>
  );
}

function Produtos() {
  return (
    <section id="produtos" className="bg-background py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              Coleção
            </span>
            <h2 className="serif mt-3 text-5xl md:text-6xl">
              Linha completa de aromas
            </h2>
          </div>
          <p className="max-w-md text-muted-foreground">
            Quatro categorias pensadas para diferentes ambientes e ocasiões.
            Escolha o formato e descubra todos os aromas disponíveis no
            atendimento.
          </p>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <article key={p.nome} className="group bg-background p-6">
              <div className="overflow-hidden bg-secondary">
                <img
                  src={p.img}
                  alt={p.nome}
                  width={800}
                  height={1000}
                  loading="lazy"
                  className="h-80 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="pt-6">
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {p.tag}
                </span>
                <h3 className="serif mt-2 text-2xl">{p.nome}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sobre() {
  return (
    <section id="sobre" className="bg-foreground py-28 text-background">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-2 md:px-12">
        <div>
          <span className="text-xs uppercase tracking-[0.4em] text-background/60">
            Sobre nós
          </span>
          <h2 className="serif mt-3 text-5xl md:text-6xl">
            Aroma é memória.
            <br />
            <em className="italic">É afeto.</em>
          </h2>
        </div>
        <div className="space-y-6 text-background/80">
          <p>
            Há anos perfumando lares, escritórios, lojas e momentos. A Carolina
            Viapiana nasceu da paixão por criar atmosferas que ficam na
            lembrança de quem entra e de quem vive cada ambiente.
          </p>
          <p>
            Trabalhamos com matéria-prima de alta qualidade, fixação prolongada
            e fragrâncias autorais. Da loja física em Ponta Grossa para todo o
            Brasil.
          </p>
          <div className="grid grid-cols-3 gap-6 pt-6">
            <div>
              <div className="serif text-4xl">+10</div>
              <div className="text-xs uppercase tracking-widest text-background/60">
                Anos de mercado
              </div>
            </div>
            <div>
              <div className="serif text-4xl">30+</div>
              <div className="text-xs uppercase tracking-widest text-background/60">
                Aromas exclusivos
              </div>
            </div>
            <div>
              <div className="serif text-4xl">BR</div>
              <div className="text-xs uppercase tracking-widest text-background/60">
                Entregas em todo país
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Atendimento() {
  return (
    <section id="atendimento" className="bg-background py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <div className="mb-16 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Atendimento
          </span>
          <h2 className="serif mt-3 text-5xl md:text-6xl">
            Monte seu pedido
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Escolha o produto, o tamanho, o aroma e nós cuidamos do resto. Seu
            pedido será enviado direto para o WhatsApp da loja.
          </p>
        </div>
        <div className="border border-foreground/10 bg-secondary/40 p-8 md:p-14">
          <AtendimentoForm />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 text-sm text-muted-foreground md:flex-row md:px-12">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" width={32} height={32} />
          <span className="serif text-base text-foreground">
            Carolina Viapiana
          </span>
        </div>
        <div className="text-center md:text-right">
          <p>Bonifácio Vilela, 1633 — Ponta Grossa, PR · 84015-460</p>
          <p className="mt-1">
            @carolinaviapiana · Entregas para todo o Brasil
          </p>
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
