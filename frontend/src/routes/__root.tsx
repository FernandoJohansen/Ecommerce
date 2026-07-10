import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Erro 404</span>
        <h1 className="serif mt-4 text-6xl">Página não encontrada</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center justify-center border border-foreground bg-foreground px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors hover:bg-transparent hover:text-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Erro</span>
        <h1 className="serif mt-4 text-4xl">Algo deu errado</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Tivemos um problema ao carregar esta página. Tente novamente ou volte ao início.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center border border-foreground bg-foreground px-8 py-4 text-xs uppercase tracking-[0.3em] text-background transition-colors hover:bg-transparent hover:text-foreground"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center border border-foreground px-8 py-4 text-xs uppercase tracking-[0.3em] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Carolina Viapiana — Perfumando Ambientes" },
      {
        name: "description",
        content:
          "Difusores artesanais, home sprays e refis. Aromas exclusivos para perfumar seu ambiente. Ponta Grossa-PR.",
      },
      { property: "og:title", content: "Carolina Viapiana" },
      {
        property: "og:description",
        content:
          "Difusores artesanais, home sprays e refis. Aromas exclusivos para perfumar seu ambiente.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
