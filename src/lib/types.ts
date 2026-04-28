export type trust_grade = "A" | "B" | "C" | "D" | "F";

export type ScheduleWindow = "now" | "urgent" | "window";

export type JobStatus = "open" | "in_progress" | "completed" | "cancelled" | "disputed" | "expired";

export type Environment = "indoor" | "outdoor" | "both";

export type AIVerification = {
  verdict: "completed" | "partial" | "not_completed" | "unclear";
  confidence: number;
  explanation: string;
  verified_at?: string;
  model?: string;
};

export type Job = {
  id: string;
  poster_id: string;
  doer_id: string | null;
  accepted_doer_id: string | null;
  title: string;
  description: string;
  category: "yardwork" | "moving" | "cleaning" | "delivery" | "pet_care" | "errands" | "assembly" | "other";
  budget: number;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  status: JobStatus;
  scheduled_for: string | null;
  schedule_window: ScheduleWindow;
  created_at: string;
  // Requirements checklist
  tools_provided: boolean;
  heavy_lifting: boolean;
  environment: Environment;
  estimated_duration: string | null;
  pro_only: boolean;
  // Photo workflow
  before_photo_url: string | null;
  after_photo_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  approved_at: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  ai_verification: AIVerification | null;
};

export type JobRequest = {
  id: string;
  job_id: string;
  doer_id: string;
  poster_id: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  message: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  trust_grade: trust_grade;
  jobs_completed: number;
  is_pro_helper?: boolean;
  pro_helper_since?: string | null;
};

export type Notification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, any>;
  read_at: string | null;
  created_at: string;
};

export type DoerRestriction = {
  restricted: boolean;
  until_ts: string | null;
  consecutive_count: number;
};
