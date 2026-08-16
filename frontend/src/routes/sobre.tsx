import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/sobre")({
  component: SobrePage,
  head: () => ({
    meta: [
      { title: "Sobre — Carolina Viapiana" },
      {
        name: "description",
        content:
          "Há anos perfumando lares, escritórios e momentos. Conheça a história da Carolina Viapiana e nossa paixão por criar atmosferas únicas.",
      },
    ],
  }),
});

function SobrePage() {
  return (
    <main>
      <Header />
      <div className="pt-24">
        <section className="bg-foreground py-28 text-background">
          <div className="mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-2 md:px-12">
            <Reveal>
              <span className="text-xs uppercase tracking-[0.4em] text-background/60">
                Sobre nós
              </span>
              <h1 className="serif mt-3 text-5xl md:text-6xl">
                Aroma é memória.
                <br />
                <em className="italic">É afeto.</em>
              </h1>
            </Reveal>
            <Reveal delay={150} className="space-y-6 text-background/80">
              <p>
                Há anos perfumando lares, escritórios, lojas e momentos. A Carolina Viapiana nasceu
                da paixão por criar atmosferas que ficam na lembrança de quem entra e de quem vive
                cada ambiente.
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
      </div>
      <Footer />
    </main>
  );
}
