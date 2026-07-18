import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, BotOff, Loader2, RefreshCw, Search, Send, X } from "lucide-react";
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

interface CwAttachment {
  id: number;
  file_type: string; // audio | image | video | file ...
  data_url: string;
}

interface CwMessage {
  id: number;
  content: string | null;
  message_type: number; // 0 incoming, 1 outgoing, 2 activity
  created_at: number;
  sender?: { name?: string } | null;
  private?: boolean;
  attachments?: CwAttachment[];
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

function Avatar({ nome, url, size = 9 }: { nome: string; url?: string | null; size?: 9 | 10 }) {
  const [erro, setErro] = useState(false);
  const iniciais = nome
    .replace(/^~\s*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const cls = size === 10 ? "h-10 w-10" : "h-9 w-9";
  if (url && !erro) {
    return (
      <img
        src={url}
        alt={nome}
        onError={() => setErro(true)}
        className={`${cls} shrink-0 rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground`}
    >
      {iniciais || "?"}
    </div>
  );
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
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<CwConversation[] | null>(null);
  const [buscando, setBuscando] = useState(false);

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

  // Busca estilo WhatsApp: conteúdo de mensagens, nome e número (via API),
  // com debounce de 400ms. Busca vazia volta pra lista normal.
  useEffect(() => {
    const q = busca.trim();
    if (!q) {
      setResultadosBusca(null);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const data = await cwFetch<{
          data?: { payload?: CwConversation[] };
          payload?: CwConversation[];
        }>(`/conversations/search?q=${encodeURIComponent(q)}`);
        setResultadosBusca(data.data?.payload ?? data.payload ?? []);
      } catch {
        setResultadosBusca([]); // filtro local abaixo ainda cobre nome/número
      } finally {
        setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const listaExibida = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    const digitos = q.replace(/\D/g, "");
    const localMatch = conversas.filter((c) => {
      const nome = (c.meta?.sender?.name || "").toLowerCase();
      const phone = (c.meta?.sender?.phone_number || "").replace(/\D/g, "");
      return nome.includes(q) || (digitos.length > 0 && phone.includes(digitos));
    });
    const daApi = resultadosBusca ?? [];
    const vistos = new Set<number>();
    return [...localMatch, ...daApi].filter((c) => {
      if (vistos.has(c.id)) return false;
      vistos.add(c.id);
      return true;
    });
  }, [conversas, resultadosBusca, busca]);

  const todasConhecidas = useMemo(() => {
    const map = new Map<number, CwConversation>();
    for (const c of [...conversas, ...(resultadosBusca ?? [])]) map.set(c.id, c);
    return map;
  }, [conversas, resultadosBusca]);

  const conversaAtiva = useMemo(
    () => todasConhecidas.get(selecionada ?? -1) ?? null,
    [todasConhecidas, selecionada],
  );

  return (
    <div className="flex h-[calc(100vh-96px)] min-h-[480px] overflow-hidden rounded-lg border bg-white text-neutral-900">
      {/* Lista de conversas */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-white">
        <div className="space-y-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Conversas</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregarConversas}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative">
            {buscando ? (
              <Loader2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, número ou mensagem…"
              className="h-8 pl-8 pr-7 text-sm"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
          {!carregando && !erro && listaExibida.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {busca.trim() ? "Nada encontrado para essa busca." : "Nenhuma conversa aberta agora."}
            </p>
          )}
          {listaExibida.map((c) => (
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
        "flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-2.5 transition-colors hover:bg-neutral-100",
        ativa && "bg-neutral-100",
      )}
      onClick={onSelect}
    >
      <Avatar nome={nome} url={conversa.meta?.sender?.thumbnail} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{nome}</span>
          {typeof conversa.unread_count === "number" && conversa.unread_count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {conversa.unread_count}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-neutral-500">{preview || formatPhone(phone)}</p>
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
      const ehReacao = (c: string | null) =>
        !!c && (c.includes("[ reação ]") || c.includes("[ removeu reação ]"));
      setMensagens(
        (data.payload ?? []).filter(
          (m) =>
            m.message_type !== 2 &&
            !m.private &&
            !ehReacao(m.content) &&
            (m.content || (m.attachments && m.attachments.length > 0)),
        ),
      );
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
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <Avatar nome={nome} url={conversa.meta?.sender?.thumbnail} size={10} />
        <div>
          <div className="text-sm font-semibold">{nome}</div>
          <div className="text-xs text-neutral-500">{formatPhone(phone)}</div>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.message_type === 1 ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm",
                m.message_type === 1
                  ? "rounded-br-sm bg-[#d9fdd3] text-neutral-900"
                  : "rounded-bl-sm bg-white text-neutral-900",
              )}
            >
              {m.attachments?.map((a) =>
                a.file_type === "audio" ? (
                  <audio key={a.id} controls preload="none" className="max-w-full py-1">
                    <source src={a.data_url} />
                  </audio>
                ) : a.file_type === "image" ? (
                  <a key={a.id} href={a.data_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={a.data_url}
                      alt="Imagem enviada"
                      className="my-1 max-h-64 rounded-lg object-contain"
                    />
                  </a>
                ) : (
                  <a
                    key={a.id}
                    href={a.data_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-1 text-sm underline"
                  >
                    📎 Abrir anexo ({a.file_type})
                  </a>
                ),
              )}
              {m.attachments?.length && /^\[[^\]]+\]$/.test((m.content ?? "").trim())
                ? null
                : m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 p-3">
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
