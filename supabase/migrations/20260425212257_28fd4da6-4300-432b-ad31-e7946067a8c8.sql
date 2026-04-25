DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.notifications;

CREATE POLICY "Insert notifications for job participants" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Doer notifying the poster of their job
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.poster_id = recipient_id AND j.poster_id <> auth.uid()
    )
    OR
    -- Poster notifying a doer who has a request on their job
    EXISTS (
      SELECT 1 FROM public.job_requests r
      JOIN public.jobs j ON j.id = r.job_id
      WHERE r.doer_id = recipient_id AND j.poster_id = auth.uid()
    )
  );