ALTER TABLE public.activities
  ADD CONSTRAINT activities_user_id_id_key UNIQUE (user_id, id);

ALTER TABLE public.mutation_idempotency
  ADD CONSTRAINT mutation_idempotency_resource_owner_fk
  FOREIGN KEY (user_id, resource_id)
  REFERENCES public.activities (user_id, id)
  DEFERRABLE INITIALLY DEFERRED;
