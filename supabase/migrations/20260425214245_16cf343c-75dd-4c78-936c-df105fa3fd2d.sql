ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_id text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_age_range_check
  CHECK (age_range IS NULL OR age_range IN ('13-17','18-24','25-34','35-44','45-54','55-64','65+','prefer_not_to_say'));