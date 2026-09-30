-- Trigger functions are internal infrastructure, not public RPC endpoints.
ALTER FUNCTION public.set_updated_at() SET search_path = '';
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Constrain Data API policies to signed-in users and evaluate uid once per query.
ALTER POLICY "Users can read own profile" ON public.profiles
  TO authenticated
  USING (id = (SELECT auth.uid()));

ALTER POLICY "Users can update own profile" ON public.profiles
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

ALTER POLICY "Users can read own audit logs" ON public.audit_logs
  TO authenticated
  USING (actor_user_id = (SELECT auth.uid()));
