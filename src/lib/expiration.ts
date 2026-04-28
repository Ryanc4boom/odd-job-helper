import { useEffect, useState } from "react";

/**
 * Format the time remaining until a job listing expires.
 *  - "1d 4h" when >= 24h
 *  - "3h 12m" when >= 1h
 *  - "12m" when >= 1m
 *  - "<1m" when about to expire
 *  - "Expired" when past
 */
export function formatTimeRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "No timer";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";

  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "<1m";

  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;

  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Returns "ok" | "soon" (<30m) | "urgent" (<5m) | "expired". */
export function expirationLevel(expiresAt: string | null | undefined): "none" | "ok" | "soon" | "urgent" | "expired" {
  if (!expiresAt) return "none";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  if (ms < 5 * 60_000) return "urgent";
  if (ms < 30 * 60_000) return "soon";
  return "ok";
}

/**
 * Re-render every 30s while a job's listing timer is active.
 * Returns a tuple of [label, level] you can use directly in JSX.
 */
export function useCountdown(expiresAt: string | null | undefined): { label: string; level: ReturnType<typeof expirationLevel> } {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return { label: formatTimeRemaining(expiresAt), level: expirationLevel(expiresAt) };
}

/** Tailwind classes for the countdown badge. Uses semantic tokens so it stays on-theme. */
export function countdownBadgeClass(level: ReturnType<typeof expirationLevel>): string {
  switch (level) {
    case "urgent":
      return "bg-destructive/15 text-destructive border border-destructive/30";
    case "soon":
      return "bg-accent-soft text-accent-foreground border border-accent/40";
    case "expired":
      return "bg-muted text-muted-foreground border border-border";
    case "none":
      return "bg-muted text-muted-foreground border border-border";
    default:
      return "bg-primary-soft text-primary border border-primary/30";
  }
}

export const DURATION_PRESETS_HOURS: number[] = [1, 2, 4, 8, 24];
export const MIN_CUSTOM_HOURS = 1;
export const MAX_CUSTOM_HOURS = 72;
export const DEFAULT_DURATION_HOURS = 2;
