# Replace scheduling with a poster-set "active timer"

Right now posters pick a date + urgent/window for *when the job should be done*. We'll replace that with a single choice: **how long should the listing stay live?** When the timer ends, the job automatically disappears from the feed and the map.

## How it works (user-facing)

On **Post a Job**, the "When does it need to be done?" section is replaced with **"How long should this listing stay active?"** — a row of preset buttons:

- 1 hour
- 2 hours (default)
- 4 hours
- 8 hours
- 24 hours
- Custom (1–72h slider/input)

After posting, the job appears on the feed and map with a live countdown ("Expires in 1h 47m"). When the timer hits zero, the job's status flips to `expired` and it vanishes from the public view automatically (realtime already wired up). The poster sees it move to a "Past listings" group on the Post a Job page.

If a helper requests/accepts the job before it expires, the timer stops mattering — status moves to `in_progress` and it's already gone from the feed.

## Technical changes

### 1. Database (migration)
- Add `expires_at timestamptz` to `jobs` (nullable for legacy rows).
- Add `'expired'` to the `job_status` enum.
- Update the `jobs_public` view (or RLS for the map query) to also filter `expires_at > now()` so expired rows are hidden even if the auto-expire job hasn't run yet.
- Drop the `NOT NULL` from `schedule_window` and stop relying on `scheduled_for`. We'll keep both columns in the table for now (no destructive drops) but the form and UI stop writing/reading them.
- Add a `pg_cron` job (every 5 min) that runs `UPDATE jobs SET status='expired' WHERE status='open' AND expires_at <= now()`. This guarantees the row's status is consistent for downstream queries and triggers realtime updates so all clients refresh.

### 2. PostJob.tsx
- Remove `SCHEDULE_PRESETS`, `presetToDate`, urgent/window toggle, custom date picker, and time input.
- Add a new `DURATION_PRESETS = [1, 2, 4, 8, 24]` (hours) plus a "Custom" option (number input, 1–72).
- On submit: compute `expires_at = new Date(Date.now() + hours*3600_000).toISOString()` and insert it. Stop sending `scheduled_for` and `schedule_window`.
- "My posted jobs" list: replace `formatSchedule(...)` with a live countdown component for `open` jobs, and show "Expired" for expired ones.

### 3. Feed.tsx (list + map)
- Map source already filters `status='open'`; add `.gt("expires_at", new Date().toISOString())` for safety on the initial fetch.
- List card: replace the schedule badge with a countdown badge ("Expires in 1h 47m"), color-shifted to amber when <30 min, red when <5 min.
- Realtime subscription will already trigger a refetch when the cron flips `status` → bubble disappears with no user action.

### 4. JobDetail.tsx
- Replace "Scheduled for …" line with "Listing expires in …" (or "Listing expired" / "Accepted — no longer listed").

### 5. Account.tsx
- Same swap: countdown badge instead of `formatSchedule`.

### 6. Shared helpers
- New `src/lib/expiration.ts` with:
  - `formatTimeRemaining(expiresAt: string): string` ("1h 47m", "12m", "Expired")
  - `useCountdown(expiresAt)` hook that re-renders every 30s
- Keep `src/lib/schedule.ts` for now but stop importing it (we can delete in a follow-up once nothing references it).

## What we keep vs. drop

| Thing | Status |
|---|---|
| `scheduled_for`, `schedule_window` columns | Kept in DB (nullable), no longer written/read by UI |
| `SCHEDULE_PRESETS`, urgent/window toggle, custom date picker | Removed from Post a Job form |
| `estimated_duration` field (how long the *task* takes) | **Kept** — separate concept from listing TTL |
| Cancel-job button | Kept |
| Map privacy bubbles + realtime | Kept (just gain auto-expire behavior) |

## Open question before I build

**Default and max timer values OK?** I'm proposing presets of 1h / 2h / 4h / 8h / 24h with a custom range of 1–72h, defaulting to 2h. If you'd rather have e.g. 30-min minimum or a 7-day max, say the word and I'll adjust.