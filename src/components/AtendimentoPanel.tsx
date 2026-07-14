import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHelenaPausasMap, useHelenaStatus } from "@/hooks/useHelenaPause";
import { HelenaStatusBadge } from "@/components/HelenaStatusBadge";
import { formatPhone } from "@/lib/format";

// Iframe direto no domínio nativo do Chatwoot (sem proxy/subpath).
// Requer o middleware no Traefik/EasyPanel removendo X-Frame-Options
// e liberando frame-ancestors pro domínio do dashboard.
const CHATWOOT_URL = "https://chatwoot-chatwoot.syaw15.easypanel.host/app";

interface AtendimentoPanelProps {
  usuarioAtual: string;
}

export function AtendimentoPanel({ usuarioAtual }: AtendimentoPanelProps) {
  const { pausas, loading } = useHelenaPausasMap();

  const pausasAtivas = useMemo(
    () =>
      Object.values(pausas).filter(
        (p) => p.pausado_ate === null || new Date(p.pausado_ate).getTime() > Date.now(),
      ),
    [pausas],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Quando um atendente responde pelo Chatwoot, a Helena pausa automaticamente naquela
          conversa — o estado aparece no painel ao lado em tempo real.
        </p>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
          <a href={CHATWOOT_URL} target="_blank" rel="noopener noreferrer">
            Abrir em nova aba
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      <div className="flex h-[calc(100vh-260px)] min-h-[480px] gap-4">
        <div className="flex-1 overflow-hidden rounded-lg border bg-card">
          <iframe
            src={CHATWOOT_URL}
            title="Atendimento — Chatwoot"
            className="h-full w-full border-0"
            allow="clipboard-write; microphone; camera; notifications"
          />
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto rounded-lg border bg-card p-3">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Pausas ativas {loading ? "" : `(${pausasAtivas.length})`}
          </h3>

          {!loading && pausasAtivas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma conversa pausada agora — a Helena está respondendo normalmente em todas.
            </p>
          )}

          <div className="space-y-2">
            {pausasAtivas.map((p) => (
              <PausaRow
                key={p.sender}
                sender={p.sender}
                pausas={pausas}
                usuarioAtual={usuarioAtual}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PausaRow({
  sender,
  pausas,
  usuarioAtual,
}: {
  sender: string;
  pausas: ReturnType<typeof useHelenaPausasMap>["pausas"];
  usuarioAtual: string;
}) {
  const status = useHelenaStatus(pausas, sender);
  void status;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
      <span className="truncate tabular-nums">{formatPhone(sender)}</span>
      <HelenaStatusBadge sender={sender} usuarioAtual={usuarioAtual} />
    </div>
  );
}
