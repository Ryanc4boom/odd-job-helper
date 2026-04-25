export type trust_grade = "A" | "B" | "C" | "D" | "F";

export type ScheduleWindow = "now" | "urgent" | "window";

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
  status: "open" | "in_progress" | "completed" | "cancelled";
  scheduled_for: string | null;
  schedule_window: ScheduleWindow;
  created_at: string;
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
