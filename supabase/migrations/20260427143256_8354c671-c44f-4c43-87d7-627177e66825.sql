-- 1. Extend job_status enum with 'disputed'
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'disputed';

-- 2. New columns on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS tools_provided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS heavy_lifting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'indoor' CHECK (environment IN ('indoor','outdoor','both')),
  ADD COLUMN IF NOT EXISTS estimated_duration text,
  ADD COLUMN IF NOT EXISTS pro_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS before_photo_url text,
  ADD COLUMN IF NOT EXISTS after_photo_url text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS ai_verification jsonb;

-- 3. Profiles gain pro_helper flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_pro_helper boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_helper_since timestamptz;

-- 4. Cancellation tracking
CREATE TABLE IF NOT EXISTS public.cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doer_id uuid NOT NULL,
  job_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cancellations_doer_created ON public.cancellations (doer_id, created_at DESC);

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doer views own cancellations" ON public.cancellations;
CREATE POLICY "Doer views own cancellations"
  ON public.cancellations FOR SELECT
  TO authenticated
  USING (auth.uid() = doer_id);

DROP POLICY IF EXISTS "Doer inserts own cancellation" ON public.cancellations;
CREATE POLICY "Doer inserts own cancellation"
  ON public.cancellations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = doer_id);

-- 5. Function: how long is the doer restricted? (NULL = not restricted)
CREATE OR REPLACE FUNCTION public.get_doer_restriction(_doer_id uuid)
RETURNS TABLE (restricted boolean, until_ts timestamptz, consecutive_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  last_complete timestamptz;
  recent_cancels timestamptz[];
  c_count int := 0;
  last_cancel timestamptz;
BEGIN
  -- find most recent successful completion for this doer (resets the streak)
  SELECT MAX(approved_at) INTO last_complete
  FROM public.jobs
  WHERE doer_id = _doer_id AND status = 'completed';

  -- count cancellations strictly after the last completion (or all if none)
  SELECT array_agg(created_at ORDER BY created_at DESC)
    INTO recent_cancels
  FROM public.cancellations
  WHERE doer_id = _doer_id
    AND (last_complete IS NULL OR created_at > last_complete);

  c_count := COALESCE(array_length(recent_cancels, 1), 0);
  last_cancel := CASE WHEN c_count > 0 THEN recent_cancels[1] ELSE NULL END;

  IF c_count >= 3 AND last_cancel IS NOT NULL AND (last_cancel + interval '48 hours') > now() THEN
    RETURN QUERY SELECT true, last_cancel + interval '48 hours', c_count;
  ELSE
    RETURN QUERY SELECT false, NULL::timestamptz, c_count;
  END IF;
END;
$$;

-- 6. Function: recompute pro-helper status for a worker
CREATE OR REPLACE FUNCTION public.recompute_pro_helper(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  jobs_done int;
  avg_score numeric;
  is_currently_pro boolean;
BEGIN
  SELECT jobs_completed, is_pro_helper INTO jobs_done, is_currently_pro
  FROM public.profiles WHERE id = _user_id;

  SELECT AVG(score) INTO avg_score
  FROM public.ratings WHERE ratee_id = _user_id;

  IF NOT is_currently_pro THEN
    -- Award threshold
    IF jobs_done >= 5 AND COALESCE(avg_score, 0) >= 4.5 THEN
      UPDATE public.profiles
        SET is_pro_helper = true, pro_helper_since = now()
        WHERE id = _user_id;
    END IF;
  ELSE
    -- Revoke threshold
    IF avg_score IS NOT NULL AND avg_score < 4.3 THEN
      UPDATE public.profiles
        SET is_pro_helper = false, pro_helper_since = NULL
        WHERE id = _user_id;
    END IF;
  END IF;
END;
$$;

-- 7. Trigger on ratings to recompute pro status
CREATE OR REPLACE FUNCTION public.tg_recompute_pro_after_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_pro_helper(NEW.ratee_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recompute_pro_after_rating ON public.ratings;
CREATE TRIGGER trg_recompute_pro_after_rating
  AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_pro_after_rating();

-- 8. Recreate jobs_public view to include new public-safe fields
DROP VIEW IF EXISTS public.jobs_public;
CREATE VIEW public.jobs_public AS
  SELECT id, poster_id, doer_id, accepted_doer_id, title, description, category, budget,
         location_text, location_lat, location_lng, status,
         scheduled_for, schedule_window, created_at, updated_at,
         tools_provided, heavy_lifting, environment, estimated_duration, pro_only,
         before_photo_url, after_photo_url, started_at, finished_at,
         approved_at, disputed_at, dispute_reason
  FROM public.jobs;

GRANT SELECT ON public.jobs_public TO authenticated, anon;

-- 9. Storage bucket for job photos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {job_id}/{before|after}-{timestamp}.jpg
-- Allow poster or accepted doer of that job to read/write
DROP POLICY IF EXISTS "Job participants read photos" ON storage.objects;
CREATE POLICY "Job participants read photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND (j.poster_id = auth.uid() OR j.accepted_doer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Accepted doer uploads photos" ON storage.objects;
CREATE POLICY "Accepted doer uploads photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND j.accepted_doer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Accepted doer updates photos" ON storage.objects;
CREATE POLICY "Accepted doer updates photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND j.accepted_doer_id = auth.uid()
    )
  );