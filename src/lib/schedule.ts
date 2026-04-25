import type { ScheduleWindow } from "./types";

export type SchedulePreset =
  | { kind: "now"; label: string }
  | { kind: "in_minutes"; minutes: number; label: string }
  | { kind: "in_hours"; hours: number; label: string }
  | { kind: "tomorrow"; label: string }
  | { kind: "custom"; label: string };

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  { kind: "now", label: "Right now" },
  { kind: "in_minutes", minutes: 20, label: "In 20 minutes" },
  { kind: "in_hours", hours: 1, label: "In 1 hour" },
  { kind: "tomorrow", label: "Tomorrow" },
  { kind: "custom", label: "Custom date" },
];

export function presetToDate(preset: SchedulePreset, customDate?: Date): { date: Date | null; window: ScheduleWindow } {
  const now = new Date();
  switch (preset.kind) {
    case "now":
      return { date: now, window: "now" };
    case "in_minutes":
      return { date: new Date(now.getTime() + preset.minutes * 60_000), window: "urgent" };
    case "in_hours":
      return { date: new Date(now.getTime() + preset.hours * 60 * 60_000), window: "urgent" };
    case "tomorrow": {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      return { date: t, window: "window" };
    }
    case "custom":
      return { date: customDate ?? null, window: "window" };
  }
}

export function maxCustomDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d;
}

export function formatSchedule(scheduledFor: string | null, window: ScheduleWindow): string {
  if (!scheduledFor) return "Flexible";
  const d = new Date(scheduledFor);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (window === "now" || (diffMin >= -5 && diffMin <= 5)) return "Right now";
  if (window === "urgent" && diffMin > 0 && diffMin < 60) return `In ${diffMin} min`;
  if (window === "urgent" && diffMin >= 60 && diffMin < 180) return `In ${Math.round(diffMin / 60)} hr`;

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayStart = new Date(d); dayStart.setHours(0,0,0,0);

  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (dayStart.getTime() === today.getTime()) return `Today · ${timeStr}`;
  if (dayStart.getTime() === tomorrow.getTime()) return `Tomorrow · ${timeStr}`;
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + " · " + timeStr;
}

export function scheduleBadgeStyle(window: ScheduleWindow): string {
  if (window === "now") return "bg-primary text-primary-foreground";
  if (window === "urgent") return "bg-primary-soft text-primary border border-primary/30";
  return "bg-secondary text-secondary-foreground";
}
