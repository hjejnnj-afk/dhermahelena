import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dherma Prime — Painel Analítico" },
      {
        name: "description",
        content:
          "Painel analítico em tempo real da Dherma Clínica de Estética: agendamentos, clientes e performance da Helena Bot.",
      },
    ],
  }),
  component: Dashboard,
});
