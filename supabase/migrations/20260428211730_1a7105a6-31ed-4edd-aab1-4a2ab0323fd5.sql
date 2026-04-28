
-- 1. Add expires_at column
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_jobs_status_expires_at
  ON public.jobs (status, expires_at);

-- 2. Drop NOT NULL constraints on legacy schedule fields
ALTER TABLE public.jobs
  ALTER COLUMN schedule_window DROP NOT NULL,
  ALTER COLUMN schedule_window DROP DEFAULT;

-- 3. Recreate the public view to include expires_at and hide expired jobs
DROP VIEW IF EXISTS public.jobs_public;

CREATE VIEW public.jobs_public
WITH (security_invoker = true) AS
SELECT
  id,
  poster_id,
  doer_id,
  accepted_doer_id,
  title,
  description,
  category,
  budget,
  location_text,
  location_lat,
  location_lng,
  status,
  scheduled_for,
  schedule_window,
  expires_at,
  created_at,
  updated_at,
  tools_provided,
  heavy_lifting,
  environment,
  estimated_duration,
  pro_only,
  before_photo_url,
  after_photo_url,
  started_at,
  finished_at,
  approved_at,
  disputed_at,
  dispute_reason
FROM public.jobs
WHERE status <> 'expired'::job_status
  AND (expires_at IS NULL OR expires_at > now());

GRANT SELECT ON public.jobs_public TO authenticated;

-- 4. Auto-expire function (SECURITY DEFINER so cron with low privs can call it)
CREATE OR REPLACE FUNCTION public.expire_stale_jobs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.jobs
     SET status = 'expired'::job_status,
         updated_at = now()
   WHERE status = 'open'::job_status
     AND expires_at IS NOT NULL
     AND expires_at <= now();
$$;

REVOKE ALL ON FUNCTION public.expire_stale_jobs() FROM PUBLIC, anon, authenticated;

-- 5. Schedule it via pg_cron (every 5 minutes). Safe to re-run.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'expire-stale-jobs';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
  PERFORM cron.schedule(
    'expire-stale-jobs',
    '*/5 * * * *',
    $cron$ SELECT public.expire_stale_jobs(); $cron$
  );
END $$;
