import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/products/difusor_vidro3.jpeg";
import heroWebp from "@/assets/products/difusor_vidro3.webp";
import heroAvif from "@/assets/products/difusor_vidro3.avif";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

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

const navCards = [
  {
    to: "/produtos" as const,
    num: "01",
    title: "Produtos",
    desc: "Explore toda a linha de aromas",
  },
  {
    to: "/sobre" as const,
    num: "02",
    title: "Sobre",
    desc: "A história por trás da marca",
  },
  {
    to: "/atendimento" as const,
    num: "03",
    title: "Atendimento",
    desc: "Monte e envie seu pedido",
  },
];

function Index() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="relative min-h-screen w-full overflow-hidden bg-foreground text-background">
        <picture>
          <source srcSet={heroAvif} type="image/avif" />
          <source srcSet={heroWebp} type="image/webp" />
          <img
            src={hero}
            alt="Difusor de aromas Carolina Viapiana"
            width={1280}
            height={1600}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        </picture>
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
            <Link
              to="/atendimento"
              className="border border-background bg-background px-8 py-4 text-xs uppercase tracking-[0.3em] text-foreground transition-colors duration-300 hover:bg-transparent hover:text-background"
            >
              Fazer um pedido
            </Link>
            <Link
              to="/produtos"
              className="border border-background/60 px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors duration-300 hover:border-background hover:bg-background hover:text-foreground"
            >
              Ver produtos
            </Link>
          </div>
        </div>
      </section>

      {/* Nav cards */}
      <section className="bg-background">
        <div className="mx-auto grid max-w-7xl md:grid-cols-3">
          {navCards.map((card, i) => (
            <Link
              key={card.to}
              to={card.to}
              className="group relative border-b border-r border-border p-10 transition-colors duration-300 hover:bg-foreground md:border-b-0 last:border-r-0"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="serif text-sm tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-background/50">
                {card.num}
              </span>
              <h2 className="serif mt-4 text-3xl transition-colors duration-300 group-hover:text-background">
                {card.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-background/70">
                {card.desc}
              </p>
              <span className="mt-8 inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-all duration-300 group-hover:text-background/70">
                Explorar
                <span className="h-px w-6 bg-current transition-all duration-300 group-hover:w-10" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
