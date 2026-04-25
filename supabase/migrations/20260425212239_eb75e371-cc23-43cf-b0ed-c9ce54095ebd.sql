-- 1. Extend jobs with scheduling + exact address fields
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_window text NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS address_exact text,
  ADD COLUMN IF NOT EXISTS exact_lat double precision,
  ADD COLUMN IF NOT EXISTS exact_lng double precision,
  ADD COLUMN IF NOT EXISTS accepted_doer_id uuid;

-- schedule_window: 'now' | 'urgent' | 'window'
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_schedule_window_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_schedule_window_check
  CHECK (schedule_window IN ('now','urgent','window'));

-- 2. Job requests
CREATE TABLE IF NOT EXISTS public.job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  doer_id uuid NOT NULL,
  poster_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, doer_id)
);
ALTER TABLE public.job_requests
  DROP CONSTRAINT IF EXISTS job_requests_status_check;
ALTER TABLE public.job_requests
  ADD CONSTRAINT job_requests_status_check
  CHECK (status IN ('pending','accepted','declined','withdrawn'));

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doer can view own requests" ON public.job_requests;
CREATE POLICY "Doer can view own requests" ON public.job_requests
  FOR SELECT TO authenticated USING (auth.uid() = doer_id);

DROP POLICY IF EXISTS "Poster can view requests on own jobs" ON public.job_requests;
CREATE POLICY "Poster can view requests on own jobs" ON public.job_requests
  FOR SELECT TO authenticated USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Doer creates own request" ON public.job_requests;
CREATE POLICY "Doer creates own request" ON public.job_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = doer_id
    AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.poster_id = poster_id AND j.status = 'open')
  );

DROP POLICY IF EXISTS "Poster updates requests on own jobs" ON public.job_requests;
CREATE POLICY "Poster updates requests on own jobs" ON public.job_requests
  FOR UPDATE TO authenticated USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Doer withdraws own request" ON public.job_requests;
CREATE POLICY "Doer withdraws own request" ON public.job_requests
  FOR UPDATE TO authenticated USING (auth.uid() = doer_id);

CREATE TRIGGER tg_job_requests_updated_at
  BEFORE UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications (recipient_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_requests;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.job_requests REPLICA IDENTITY FULL;

-- 4. Privacy: lock down exact address columns on jobs
-- Strategy: the existing "Jobs viewable by authenticated" SELECT policy (USING true) keeps
-- broad read access, but we expose only the *fuzzed* coordinates publicly. Exact address &
-- exact coords are returned via a SECURITY DEFINER function gated to poster + accepted doer.

CREATE OR REPLACE FUNCTION public.get_job_exact_location(_job_id uuid)
RETURNS TABLE (address_exact text, exact_lat double precision, exact_lng double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.address_exact, j.exact_lat, j.exact_lng
  FROM public.jobs j
  LEFT JOIN public.job_requests r
    ON r.job_id = j.id AND r.doer_id = auth.uid() AND r.status = 'accepted'
  WHERE j.id = _job_id
    AND (j.poster_id = auth.uid() OR r.id IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.get_job_exact_location(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_job_exact_location(uuid) TO authenticated;

-- Public view that hides exact address columns; clients should query this for browsing
CREATE OR REPLACE VIEW public.jobs_public
WITH (security_invoker = on) AS
SELECT
  id, poster_id, doer_id, accepted_doer_id, title, description, category, budget,
  location_text, location_lat, location_lng,
  status, scheduled_for, schedule_window, created_at, updated_at
FROM public.jobs;

GRANT SELECT ON public.jobs_public TO authenticated;