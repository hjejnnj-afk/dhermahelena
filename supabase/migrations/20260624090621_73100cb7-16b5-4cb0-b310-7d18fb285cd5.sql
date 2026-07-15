DROP POLICY IF EXISTS "Public read agendamentos" ON public.dherma_agendamentos;
DROP POLICY IF EXISTS "Public read clientes" ON public.dherma_clientes;

REVOKE SELECT ON public.dherma_agendamentos FROM anon;
REVOKE SELECT ON public.dherma_clientes FROM anon;

GRANT SELECT ON public.dherma_agendamentos TO authenticated;
GRANT SELECT ON public.dherma_clientes TO authenticated;

CREATE POLICY "Authenticated read agendamentos"
  ON public.dherma_agendamentos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read clientes"
  ON public.dherma_clientes
  FOR SELECT TO authenticated
  USING (true);