# Fix: Map bubbles not appearing after posting a job

## Problem
`Feed.tsx` queries `jobs_public` with a malformed PostgREST filter:

```ts
.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
```

The ISO timestamp contains colons, which collide with PostgREST's `or()` parser, so the query returns 0 rows and the map stays empty.

The `jobs_public` view already filters expired jobs server-side (`WHERE status <> 'expired' AND (expires_at IS NULL OR expires_at > now())`), so this client-side filter is also redundant.

## Change
In `src/pages/Feed.tsx` (around line 50–58), remove the `.or(...)` line from the `jobs_public` query. The remaining `.eq("status", "open")` plus the view's built-in expiration filter is sufficient.

### Before
```ts
.from("jobs_public" as any)
.select("*")
.eq("status", "open")
.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
.order("created_at", { ascending: false });
```

### After
```ts
.from("jobs_public" as any)
.select("*")
.eq("status", "open")
.order("created_at", { ascending: false });
```

## Expected result
- Open jobs are returned again.
- Green privacy bubbles render on the map at the fuzzed `(location_lng, location_lat)` coordinates.
- Realtime subscription continues to add/remove bubbles as jobs are posted or expire.
- No other files need to change.
