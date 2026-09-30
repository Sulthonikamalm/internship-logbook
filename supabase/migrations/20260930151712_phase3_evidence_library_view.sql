CREATE VIEW public.evidence_library WITH (security_invoker = true) AS
SELECT e.id, e.user_id, e.type, e.title, e.note, e.status,
  e.captured_at, e.created_at, e.updated_at, e.deleted_at,
  p.mime_type, p.size_bytes, p.width, p.height,
  l.url,
  (SELECT count(*)::integer FROM public.activity_evidences ae
   WHERE ae.evidence_id = e.id) AS assignment_count
FROM public.evidences e
LEFT JOIN public.photo_evidences p ON p.evidence_id = e.id
LEFT JOIN public.link_evidences l ON l.evidence_id = e.id;

REVOKE ALL ON public.evidence_library FROM PUBLIC, anon;
GRANT SELECT ON public.evidence_library TO authenticated;
