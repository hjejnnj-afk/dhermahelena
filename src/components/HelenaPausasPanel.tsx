import { useMemo, useState } from "react";
import { BotOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHelenaPausasMap, usePausarHelena } from "@/hooks/useHelenaPause";
import { HelenaStatusBadge } from "@/components/HelenaStatusBadge";
import { formatPhone } from "@/lib/format";
import { normalizeSenderBR, senderVariants } from "@/lib/waSender";

const DURACOES = [
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "indef", label: "Até reativar manualmente" },
] as const;

interface HelenaPausasPanelProps {
  usuarioAtual: string;
}

export function HelenaPausasPanel({ usuarioAtual }: HelenaPausasPanelProps) {
  const { pausas, loading } = useHelenaPausasMap();
  const { pausar, isLoading, error } = usePausarHelena(usuarioAtual);

  const [telefone, setTelefone] = useState("");
  const [duracao, setDuracao] = useState<string>("15");
  const [feedback, setFeedback] = useState<string | null>(null);

  const pausasAtivas = useMemo(
    () =>
      Object.values(pausas).filter(
        (p) => p.pausado_ate === null || new Date(p.pausado_ate).getTime() > Date.now(),
      ),
    [pausas],
  );

  async function handlePausar() {
    setFeedback(null);
    const sender = normalizeSenderBR(telefone);
    if (!sender) {
      setFeedback("Número inválido — use o formato DDD + número (ex.: 98 99110-3125).");
      return;
    }

    // Pausa as duas variantes (com e sem o nono dígito) — ver src/lib/waSender.ts
    const variantes = senderVariants(sender);

    const minutos = duracao === "indef" ? null : Number(duracao);
    try {
      for (const v of variantes) {
        await pausar(v, minutos);
      }
      setFeedback(`Helena pausada para ${formatPhone(sender)}.`);
      setTelefone("");
    } catch {
      // erro detalhado já vem no `error` do hook
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BotOff className="h-4 w-4 text-amber-600" />
            Pausar Helena para um contato
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A Helena para de responder esse número pelo tempo escolhido — a conversa fica com a
            equipe. Também é pausado automaticamente quando alguém responde pelo Chatwoot.
          </p>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="WhatsApp com DDD — ex.: 98 99110-3125"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
          />
          <Select value={duracao} onValueChange={setDuracao}>
            <SelectTrigger>
              <SelectValue placeholder="Duração" />
            </SelectTrigger>
            <SelectContent>
              {DURACOES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handlePausar} disabled={isLoading} className="w-full gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Pausar Helena
          </Button>
        </div>

        {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}
        {error && <p className="text-sm text-destructive">Erro: {error}</p>}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Pausas ativas {loading ? "" : `(${pausasAtivas.length})`}
        </h3>

        {!loading && pausasAtivas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conversa pausada agora — a Helena está respondendo normalmente em todas.
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pausasAtivas.map((p) => (
            <div
              key={p.sender}
              className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="truncate tabular-nums">{formatPhone(p.sender)}</span>
              <HelenaStatusBadge sender={p.sender} usuarioAtual={usuarioAtual} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
