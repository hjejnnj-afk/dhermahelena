
CREATE TABLE public.dherma_agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_consulta TEXT,
  cod_cli TEXT,
  sender TEXT,
  patient_name TEXT,
  servico TEXT,
  cod_categoria TEXT,
  data TEXT,
  horario TEXT,
  prof_nome TEXT,
  cod_prof TEXT,
  status TEXT,
  confirmacao_d1_enviada BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dherma_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender TEXT,
  cod_cli TEXT,
  patient_name TEXT,
  cpf TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agendamentos_criado_em ON public.dherma_agendamentos(criado_em DESC);
CREATE INDEX idx_agendamentos_status ON public.dherma_agendamentos(status);
CREATE INDEX idx_agendamentos_prof ON public.dherma_agendamentos(prof_nome);
CREATE INDEX idx_clientes_criado_em ON public.dherma_clientes(criado_em DESC);

GRANT SELECT ON public.dherma_agendamentos TO anon, authenticated;
GRANT ALL ON public.dherma_agendamentos TO service_role;
GRANT SELECT ON public.dherma_clientes TO anon, authenticated;
GRANT ALL ON public.dherma_clientes TO service_role;

ALTER TABLE public.dherma_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dherma_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read agendamentos" ON public.dherma_agendamentos FOR SELECT USING (true);
CREATE POLICY "Public read clientes" ON public.dherma_clientes FOR SELECT USING (true);
