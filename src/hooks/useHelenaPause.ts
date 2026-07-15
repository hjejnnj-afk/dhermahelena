import { useCallback, useEffect, useRef, useState } from "react";
import { dhermaSupabase } from "@/lib/dherma-api"; // projeto hrkmgnrwjlgkdolajxnp — mesmo client de agendamentos/clientes
import type { DhermaPausa, HelenaStatusInfo } from "@/types/helenaPausa";

// Configurar no .env / env vars da Vercel:
// VITE_N8N_WEBHOOK_BASE=https://n8n-n8n.syaw15.easypanel.host/webhook
// VITE_N8N_WEBHOOK_SECRET=<o secret gerado pros workflows pausar-helena/retomar-helena>
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE as string;
const N8N_WEBHOOK_SECRET = import.meta.env.VITE_N8N_WEBHOOK_SECRET as string;

function computeStatus(row: DhermaPausa | undefined, now: Date): HelenaStatusInfo {
  if (!row || !row.atualizado_em) {
    return { status: "ativa", pausado_ate: null, pausado_por: null, segundosRestantes: null };
  }

  if (row.pausado_ate === null) {
    return {
      status: "pausada_indefinida",
      pausado_ate: null,
      pausado_por: row.pausado_por,
      segundosRestantes: null,
    };
  }

  const ate = new Date(row.pausado_ate);
  const segundosRestantes = Math.max(0, Math.floor((ate.getTime() - now.getTime()) / 1000));

  if (segundosRestantes <= 0) {
    return { status: "ativa", pausado_ate: null, pausado_por: null, segundosRestantes: null };
  }

  return {
    status: "pausada_temporaria",
    pausado_ate: ate,
    pausado_por: row.pausado_por,
    segundosRestantes,
  };
}

/**
 * Assina em tempo real toda a tabela dherma_pausas (projeto hrkmgnrwjlgkdolajxnp)
 * e mantém um mapa sender -> registro. Usar UMA instância no componente pai
 * da lista de conversas — não instanciar dentro de cada card.
 */
export function useHelenaPausasMap() {
  const [pausas, setPausas] = useState<Record<string, DhermaPausa>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function carregarInicial() {
      const { data, error } = await dhermaSupabase.from("dherma_pausas").select("*");
      if (!mounted) return;
      if (!error && data) {
        const map: Record<string, DhermaPausa> = {};
        for (const row of data as DhermaPausa[]) map[row.sender] = row;
        setPausas(map);
      }
      setLoading(false);
    }
    carregarInicial();

    const channel = dhermaSupabase
      .channel("dherma_pausas_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dherma_pausas" },
        (payload) => {
          setPausas((prev) => {
            const next = { ...prev };
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<DhermaPausa>;
              if (oldRow.sender) delete next[oldRow.sender];
            } else {
              const row = payload.new as DhermaPausa;
              next[row.sender] = row;
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      dhermaSupabase.removeChannel(channel);
    };
  }, []);

  return { pausas, loading };
}

export function useHelenaStatus(pausas: Record<string, DhermaPausa>, sender: string) {
  const [now, setNow] = useState(() => new Date());
  const row = pausas[sender];

  useEffect(() => {
    if (!row || row.pausado_ate === null) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [row]);

  return computeStatus(row, now);
}

interface UsePausarHelenaResult {
  pausar: (sender: string, minutos: number | null) => Promise<void>;
  retomar: (sender: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function usePausarHelena(nomeUsuarioLogado: string): UsePausarHelenaResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const chamarWebhook = useCallback(async (path: string, body: Record<string, unknown>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${N8N_WEBHOOK_BASE}/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": N8N_WEBHOOK_SECRET,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Falha ao chamar ${path}: ${res.status}`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pausar = useCallback(
    async (sender: string, minutos: number | null) => {
      await chamarWebhook("pausar-helena", { sender, minutos, pausado_por: nomeUsuarioLogado });
    },
    [chamarWebhook, nomeUsuarioLogado],
  );

  const retomar = useCallback(
    async (sender: string) => {
      await chamarWebhook("retomar-helena", { sender });
    },
    [chamarWebhook],
  );

  return { pausar, retomar, isLoading, error };
}
