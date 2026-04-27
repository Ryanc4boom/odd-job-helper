DROP VIEW IF EXISTS public.jobs_public;
CREATE VIEW public.jobs_public
WITH (security_invoker = true)
AS
  SELECT id, poster_id, doer_id, accepted_doer_id, title, description, category, budget,
         location_text, location_lat, location_lng, status,
         scheduled_for, schedule_window, created_at, updated_at,
         tools_provided, heavy_lifting, environment, estimated_duration, pro_only,
         before_photo_url, after_photo_url, started_at, finished_at,
         approved_at, disputed_at, dispute_reason
  FROM public.jobs;

GRANT SELECT ON public.jobs_public TO authenticated, anon;