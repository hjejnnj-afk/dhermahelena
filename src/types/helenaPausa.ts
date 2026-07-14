export interface DhermaPausa {
  sender: string;
  pausado_ate: string | null; // ISO timestamp; null = pausa indefinida quando existe registro
  pausado_por: string | null;
  motivo: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type HelenaStatus = "ativa" | "pausada_temporaria" | "pausada_indefinida";

export interface HelenaStatusInfo {
  status: HelenaStatus;
  pausado_ate: Date | null;
  pausado_por: string | null;
  segundosRestantes: number | null; // null quando indefinida ou ativa
}

/** Duração das opções rápidas de pausa, em minutos. `null` = indefinida. */
export const PAUSA_OPCOES: { label: string; minutos: number | null }[] = [
  { label: "Pausar por 15 min", minutos: 15 },
  { label: "Pausar por 30 min", minutos: 30 },
  { label: "Pausar por 1 hora", minutos: 60 },
  { label: "Pausar até reativar manualmente", minutos: null },
];
