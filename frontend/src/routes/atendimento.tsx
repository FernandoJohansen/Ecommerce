import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoForm } from "@/components/AtendimentoForm";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/atendimento")({
  component: AtendimentoPage,
  head: () => ({
    meta: [
      { title: "Atendimento — Carolina Viapiana" },
      {
        name: "description",
        content:
          "Monte seu pedido e envie direto para o WhatsApp da loja. Escolha o produto, o tamanho e o aroma.",
      },
    ],
  }),
});

function AtendimentoPage() {
  return (
    <main>
      <Header />
      <div className="pt-24">
        <section className="bg-background py-20">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <Reveal className="mb-16">
              <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Atendimento
              </span>
              <h1 className="serif mt-3 text-5xl md:text-6xl">Monte seu pedido</h1>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Escolha o produto, o tamanho, o aroma e nós cuidamos do resto. Seu pedido será
                enviado direto para o WhatsApp da loja.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <AtendimentoForm />
            </Reveal>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
