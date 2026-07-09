import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pedidos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
