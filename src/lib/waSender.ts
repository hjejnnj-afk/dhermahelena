/**
 * Normalização de números de WhatsApp BR.
 *
 * O WhatsApp registra números brasileiros antigos SEM o nono dígito no ID
 * interno da conversa (ex.: 559891103125, 12 dígitos), enquanto pessoas
 * digitam com o 9 (5598991103125, 13 dígitos). Toda ação de pausa precisa
 * cobrir as duas variantes pra garantir o match com o sender que o fluxo
 * n8n realmente consulta.
 */

/** Retorna null se inválido; senão o número normalizado com DDI 55. */
export function normalizeSenderBR(raw: string): string | null {
  let sender = raw.replace(/\D/g, "");
  if (!sender) return null;
  if (sender.length === 10 || sender.length === 11) sender = `55${sender}`;
  if (sender.length < 12 || sender.length > 13) return null;
  return sender;
}

/** Variantes (com e sem o nono dígito) de um sender já normalizado. */
export function senderVariants(sender: string): string[] {
  const v = new Set<string>([sender]);
  if (sender.length === 13 && sender[4] === "9") {
    v.add(sender.slice(0, 4) + sender.slice(5));
  } else if (sender.length === 12) {
    v.add(`${sender.slice(0, 4)}9${sender.slice(4)}`);
  }
  return [...v];
}
