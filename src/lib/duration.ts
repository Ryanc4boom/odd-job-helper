export const DURATION_OPTIONS = [
  { value: "lt_30m", label: "Under 30 min" },
  { value: "30m_1h", label: "30 min – 1 hr" },
  { value: "1h_2h", label: "1 – 2 hrs" },
  { value: "2h_4h", label: "2 – 4 hrs" },
  { value: "4h_plus", label: "4+ hrs" },
];

export function durationLabel(value: string | null | undefined): string {
  return DURATION_OPTIONS.find((d) => d.value === value)?.label ?? "—";
}
