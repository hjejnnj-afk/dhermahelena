import { createClient } from "@supabase/supabase-js";

const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_DHERMA_SUPABASE_URL;
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_DHERMA_SUPABASE_PUBLISHABLE_KEY;

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Dherma Supabase env vars: set VITE_DHERMA_SUPABASE_URL and VITE_DHERMA_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const dhermaSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export type Agendamento = {
  id: string;
  cod_consulta: string | null;
  cod_cli: string | null;
  sender: string | null;
  patient_name: string | null;
  servico: string | null;
  cod_categoria: string | null;
  data: string | null;
  horario: string | null;
  prof_nome: string | null;
  cod_prof: string | null;
  status: string | null;
  confirmacao_d1_enviada: boolean | null;
  criado_em: string;
  atualizado_em: string;
};

export type Cliente = {
  id: string;
  sender: string | null;
  cod_cli: string | null;
  patient_name: string | null;
  cpf: string | null;
  criado_em: string;
  atualizado_em: string;
};

export async function fetchAgendamentos(): Promise<Agendamento[]> {
  const { data, error } = await dhermaSupabase
    .from("dherma_agendamentos")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as Agendamento[];
}

export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await dhermaSupabase
    .from("dherma_clientes")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as Cliente[];
}
