import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default async ({ command, mode }: { command: string; mode: string }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ];

  if (command === "build") {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));

    // Issue 21: fail the build when MercadoPago card payment is implicitly
    // enabled (key present in env) but the public key is missing.
    const mpEnabled = loadedEnv.VITE_MERCADO_PAGO_ENABLED === "true";
    const mpPublicKey = loadedEnv.VITE_MERCADO_PAGO_PUBLIC_KEY;
    if (mpEnabled && !mpPublicKey) {
      throw new Error(
        "Build error: VITE_MERCADO_PAGO_ENABLED=true but VITE_MERCADO_PAGO_PUBLIC_KEY is not set. " +
          "Card payment would silently show as unavailable. Set the key or disable MercadoPago.",
      );
    }
  }

  return {
    plugins,
    define: envDefine,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": process.env.API_PROXY_TARGET ?? "http://localhost:8000",
      },
    },
  };
};
