CREATE INDEX mutation_idempotency_resource_owner_idx
  ON public.mutation_idempotency (user_id, resource_id);
