import { useState } from "react";
import { Bot, BotOff, ChevronDown, Loader2, Play } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PAUSA_OPCOES } from "@/types/helenaPausa";
import { useHelenaPausasMap, useHelenaStatus, usePausarHelena } from "@/hooks/useHelenaPause";

function formatarRestante(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const min = minutos % 60;
  return min > 0 ? `${horas}h${min}min` : `${horas}h`;
}

interface HelenaStatusBadgeProps {
  sender: string;
  /** Nome de quem está logado no dashboard, usado para registrar quem pausou. */
  usuarioAtual: string;
}

export function HelenaStatusBadge({ sender, usuarioAtual }: HelenaStatusBadgeProps) {
  const { pausas } = useHelenaPausasMap();
  const status = useHelenaStatus(pausas, sender);
  const { pausar, retomar, isLoading } = usePausarHelena(usuarioAtual);
  const [open, setOpen] = useState(false);

  const ativa = status.status === "ativa";

  async function handlePausar(minutos: number | null) {
    setOpen(false);
    try {
      await pausar(sender, minutos);
    } catch {
      // erro já fica exposto via `error` do hook; aqui evitamos travar a UI
    }
  }

  async function handleRetomar() {
    setOpen(false);
    try {
      await retomar(sender);
    } catch {
      // idem
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            ativa
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400"
              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400",
            isLoading && "opacity-60",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : ativa ? (
            <Bot className="h-3.5 w-3.5" />
          ) : (
            <BotOff className="h-3.5 w-3.5" />
          )}

          {ativa && "Helena respondendo"}
          {status.status === "pausada_temporaria" && status.segundosRestantes !== null && (
            <>Pausado — {formatarRestante(status.segundosRestantes)}</>
          )}
          {status.status === "pausada_indefinida" && <>Pausado</>}

          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {ativa
            ? "Assumir esta conversa manualmente"
            : `Pausado por ${status.pausado_por ?? "equipe"}`}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!ativa && (
          <>
            <DropdownMenuItem onSelect={handleRetomar} className="gap-2">
              <Play className="h-4 w-4 text-emerald-600" />
              Reativar agora
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {PAUSA_OPCOES.map((opcao) => (
          <DropdownMenuItem
            key={opcao.label}
            onSelect={() => handlePausar(opcao.minutos)}
            className="gap-2"
          >
            <BotOff className="h-4 w-4 text-amber-600" />
            {opcao.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
