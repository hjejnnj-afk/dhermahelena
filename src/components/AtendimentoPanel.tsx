import { useMemo } from "react";
import { useHelenaPausasMap, useHelenaStatus } from "@/hooks/useHelenaPause";
import { HelenaStatusBadge } from "@/components/HelenaStatusBadge";
import { formatPhone } from "@/lib/format"; // ver nota no rodapé deste arquivo se não existir ainda

const CHATWOOT_EMBED_URL = "/atendimento-app"; // mesmo domínio, via rewrite do vercel.json — necessário pro iframe não ser bloqueado por X-Frame-Options

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
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] gap-4">
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

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <iframe
          src={CHATWOOT_EMBED_URL}
          title="Atendimento — Chatwoot"
          className="h-full w-full border-0"
          allow="clipboard-write; microphone; camera"
        />
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
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
      <span className="truncate tabular-nums">{formatPhone(sender)}</span>
      <HelenaStatusBadge sender={sender} usuarioAtual={usuarioAtual} />
    </div>
  );
}

/**
 * NOTA IMPORTANTE (não apagar até resolver):
 *
 * 1. `formatPhone` — o Dashboard.tsx já tem uma função local `formatPhone`
 *    dentro do próprio arquivo, não exportada de um `@/lib/format`. Ou:
 *    (a) extrai ela pra `src/lib/format.ts` e exporta, reaproveitando nos
 *        dois lugares, ou
 *    (b) cola a função direto aqui em cima, duplicando por enquanto.
 *    Fiz a escolha (a) no projeto final que vou te devolver — se você for
 *    aplicar este arquivo manualmente em outro contexto, lembra desse passo.
 *
 * 2. `CHATWOOT_EMBED_URL = "/atendimento-app"` depende do rewrite do
 *    vercel.json apontando pro seu Chatwoot. EU NÃO CONSEGUI TESTAR ISSO
 *    AO VIVO (não tenho acesso ao seu deploy). Risco conhecido: o Chatwoot
 *    (Rails) referencia os próprios assets (JS/CSS) com caminho absoluto
 *    a partir da raiz do domínio dele — ao servir sob um subpath como
 *    `/atendimento-app`, é possível que esses assets quebrem (404), mesmo
 *    com o rewrite funcionando pra o HTML inicial. Se isso acontecer,
 *    veja a seção "iframe em branco / assets 404" no README que vou anexar.
 */
