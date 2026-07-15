import { ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHATWOOT_URL = "https://chatwoot-chatwoot.syaw15.easypanel.host/app";

interface AtendimentoPanelProps {
  usuarioAtual: string;
}

export function AtendimentoPanel({ usuarioAtual }: AtendimentoPanelProps) {
  void usuarioAtual;
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8 text-center">
      <MessageSquare className="h-10 w-10 text-muted-foreground" />
      <div>
        <h3 className="text-lg font-semibold">Central de Atendimento</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          As conversas do WhatsApp da Dherma são atendidas pelo Chatwoot. Quando um atendente
          responde por lá, a Helena pausa automaticamente naquela conversa — acompanhe e gerencie as
          pausas na aba <strong>Pausas Helena</strong>.
        </p>
      </div>
      <Button asChild size="lg" className="gap-2">
        <a href={CHATWOOT_URL} target="_blank" rel="noopener noreferrer">
          Abrir atendimento
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
