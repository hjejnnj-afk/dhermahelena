import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, BotOff, Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useHelenaPausasMap, usePausarHelena } from "@/hooks/useHelenaPause";
import { normalizeSenderBR, senderVariants } from "@/lib/waSender";
import { formatPhone } from "@/lib/format";

// Proxy same-origin configurado no vercel.json:
// /cw-api/* -> https://chatwoot-chatwoot.syaw15.easypanel.host/api/v1/*
const CW_BASE = "/cw-api";
const CW_TOKEN = import.meta.env.VITE_CHATWOOT_TOKEN as string;
const CW_ACCOUNT = (import.meta.env.VITE_CHATWOOT_ACCOUNT_ID as string) || "2";

interface CwSender {
  name?: string;
  phone_number?: string | null;
  thumbnail?: string;
}

interface CwConversation {
  id: number;
  meta?: { sender?: CwSender };
  messages?: CwMessage[];
  last_non_activity_message?: { content?: string | null } | null;
  timestamp?: number;
  unread_count?: number;
}

interface CwMessage {
  id: number;
  content: string | null;
  message_type: number; // 0 incoming, 1 outgoing, 2 activity
  created_at: number;
  sender?: { name?: string } | null;
  private?: boolean;
}

async function cwFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CW_BASE}/accounts/${CW_ACCOUNT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      api_access_token: CW_TOKEN,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Chatwoot API ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}

const PAUSA_OPCOES = [
  { label: "15 minutos", minutos: 15 },
  { label: "30 minutos", minutos: 30 },
  { label: "1 hora", minutos: 60 },
  { label: "Até reativar", minutos: null as number | null },
];

interface ChatPanelProps {
  usuarioAtual: string;
}

export function ChatPanel({ usuarioAtual }: ChatPanelProps) {
  const { pausas } = useHelenaPausasMap();
  const [conversas, setConversas] = useState<CwConversation[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<number | null>(null);

  const carregarConversas = useCallback(async () => {
    try {
      const data = await cwFetch<{ data: { payload: CwConversation[] } }>(
        "/conversations?status=open&sort_by=last_activity_at",
      );
      setConversas(data.data?.payload ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar conversas");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarConversas();
    const t = setInterval(carregarConversas, 8000);
    return () => clearInterval(t);
  }, [carregarConversas]);

  const conversaAtiva = useMemo(
    () => conversas.find((c) => c.id === selecionada) ?? null,
    [conversas, selecionada],
  );

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[480px] overflow-hidden rounded-lg border bg-card">
      {/* Lista de conversas */}
      <aside className="flex w-80 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="text-sm font-semibold">Conversas</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregarConversas}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}
          {!carregando && erro && (
            <p className="p-4 text-sm text-destructive">
              {erro}. Verifique as variáveis VITE_CHATWOOT_* na Vercel e o proxy /cw-api.
            </p>
          )}
          {!carregando && !erro && conversas.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa aberta agora.</p>
          )}
          {conversas.map((c) => (
            <ConversaRow
              key={c.id}
              conversa={c}
              ativa={c.id === selecionada}
              onSelect={() => setSelecionada(c.id)}
              usuarioAtual={usuarioAtual}
              pausas={pausas}
            />
          ))}
        </div>
      </aside>

      {/* Painel de mensagens */}
      <section className="flex flex-1 flex-col">
        {conversaAtiva ? (
          <MensagensView key={conversaAtiva.id} conversa={conversaAtiva} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa ao lado para ler e responder.
          </div>
        )}
      </section>
    </div>
  );
}

function ConversaRow({
  conversa,
  ativa,
  onSelect,
  usuarioAtual,
  pausas,
}: {
  conversa: CwConversation;
  ativa: boolean;
  onSelect: () => void;
  usuarioAtual: string;
  pausas: ReturnType<typeof useHelenaPausasMap>["pausas"];
}) {
  const nome = conversa.meta?.sender?.name || "Contato";
  const phone = conversa.meta?.sender?.phone_number || "";
  const preview = conversa.last_non_activity_message?.content || "";

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-2 border-b px-3 py-2.5 transition-colors hover:bg-muted/60",
        ativa && "bg-muted",
      )}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{nome}</span>
          {typeof conversa.unread_count === "number" && conversa.unread_count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {conversa.unread_count}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{preview || formatPhone(phone)}</p>
      </div>

      <PausarButton phone={phone} usuarioAtual={usuarioAtual} pausas={pausas} />
    </div>
  );
}

function PausarButton({
  phone,
  usuarioAtual,
  pausas,
}: {
  phone: string;
  usuarioAtual: string;
  pausas: ReturnType<typeof useHelenaPausasMap>["pausas"];
}) {
  const { pausar, retomar, isLoading } = usePausarHelena(usuarioAtual);
  const [open, setOpen] = useState(false);

  const sender = normalizeSenderBR(phone || "");
  const variantes = useMemo(() => (sender ? senderVariants(sender) : []), [sender]);

  const pausada = variantes.some((v) => {
    const row = pausas[v];
    if (!row) return false;
    return row.pausado_ate === null || new Date(row.pausado_ate).getTime() > Date.now();
  });

  if (!sender) return null;

  async function handlePausar(minutos: number | null) {
    setOpen(false);
    for (const v of variantes) {
      try {
        await pausar(v, minutos);
      } catch {
        /* erro exposto pelo hook */
      }
    }
  }

  async function handleRetomar() {
    setOpen(false);
    for (const v of variantes) {
      try {
        await retomar(v);
      } catch {
        /* erro exposto pelo hook */
      }
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={isLoading}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
            pausada
              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            isLoading && "opacity-60",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : pausada ? (
            <BotOff className="h-3 w-3" />
          ) : (
            <Bot className="h-3 w-3" />
          )}
          {pausada ? "Pausada" : "Pausar"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {pausada ? "Helena pausada nesta conversa" : "Pausar Helena nesta conversa"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pausada && (
          <>
            <DropdownMenuItem onSelect={handleRetomar} className="gap-2">
              <Bot className="h-4 w-4 text-emerald-600" /> Reativar agora
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {PAUSA_OPCOES.map((o) => (
          <DropdownMenuItem
            key={o.label}
            onSelect={() => handlePausar(o.minutos)}
            className="gap-2"
          >
            <BotOff className="h-4 w-4 text-amber-600" /> {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MensagensView({ conversa }: { conversa: CwConversation }) {
  const [mensagens, setMensagens] = useState<CwMessage[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await cwFetch<{ payload: CwMessage[] }>(
        `/conversations/${conversa.id}/messages`,
      );
      setMensagens((data.payload ?? []).filter((m) => m.message_type !== 2 && !m.private));
    } catch {
      /* mantém as mensagens atuais em caso de falha momentânea */
    }
  }, [conversa.id]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  async function enviar() {
    const content = texto.trim();
    if (!content || enviando) return;
    setEnviando(true);
    try {
      await cwFetch(`/conversations/${conversa.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, message_type: "outgoing" }),
      });
      setTexto("");
      await carregar();
    } catch {
      /* mantém o texto no campo pra tentar de novo */
    } finally {
      setEnviando(false);
    }
  }

  const nome = conversa.meta?.sender?.name || "Contato";
  const phone = conversa.meta?.sender?.phone_number || "";

  return (
    <>
      <div className="border-b px-4 py-2.5">
        <div className="text-sm font-semibold">{nome}</div>
        <div className="text-xs text-muted-foreground">{formatPhone(phone)}</div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.message_type === 1 ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                m.message_type === 1
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        <Input
          placeholder="Escreva uma resposta… (a Helena pausa automaticamente ao enviar)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <Button onClick={enviar} disabled={enviando || !texto.trim()} size="icon">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </>
  );
}
