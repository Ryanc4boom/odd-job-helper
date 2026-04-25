export type trust_grade = "A" | "B" | "C" | "D" | "F";

export type Job = {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category: "yardwork" | "moving" | "cleaning" | "delivery" | "pet_care" | "errands" | "assembly" | "other";
  budget: number;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
};
