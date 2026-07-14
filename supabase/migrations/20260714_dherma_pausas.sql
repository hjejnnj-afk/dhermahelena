-- ============================================================
-- Rodar no projeto hrkmgnrwjlgkdolajxnp (o Supabase "externo" da
-- Dherma, o mesmo que dherma_agendamentos/dherma_leads/dherma_clientes
-- e que o n8n escreve via credencial DHERMA-POSTGRESS).
-- NÃO rodar no projeto xayfrtztkbpykukscvjj (esse é só auth do CRM).
-- ============================================================

create table if not exists public.dherma_pausas (
  sender        text primary key,
  pausado_ate   timestamptz,          -- null = pausa indefinida (sem prazo)
  pausado_por   text,
  motivo        text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.dherma_pausas is
  'Estado de pausa do atendimento automático da Helena por conversa (sender). pausado_ate = NULL representa pausa indefinida.';

create index if not exists idx_dherma_pausas_ativo
  on public.dherma_pausas (sender)
  where pausado_ate is not null;

create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dherma_pausas_atualizado_em on public.dherma_pausas;
create trigger trg_dherma_pausas_atualizado_em
  before update on public.dherma_pausas
  for each row execute function public.set_atualizado_em();

-- Realtime, pro badge no dashboard atualizar sem polling
alter publication supabase_realtime add table public.dherma_pausas;

-- ============================================================
-- RLS: o cliente do dashboard (dhermaSupabase, em dherma-api.ts)
-- usa só a chave anon, sem sessão de login — o mesmo padrão já
-- usado por dherma_agendamentos/dherma_clientes nesse projeto.
-- Então a policy de leitura é pra `anon`, não `authenticated`.
-- ============================================================
alter table public.dherma_pausas enable row level security;

grant select on public.dherma_pausas to anon;

create policy "dherma_pausas_select_anon"
  on public.dherma_pausas
  for select
  to anon
  using (true);

-- Escrita só via service_role (n8n) — que já ignora RLS por padrão,
-- então não precisa de policy de insert/update/delete pra anon.
