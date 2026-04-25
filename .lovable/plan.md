# Fix sign-in crash

The app isn't truly crashing — two separate issues make it look that way.

## What's actually happening

1. **Google button fails with 400 "provider not enabled"** (confirmed in auth logs). Lovable Cloud's Google provider hasn't been turned on yet, so clicking "Continue with Google" throws and the toast looks like a crash.
2. **Email/password sign-in in the preview iframe** can fail with "Failed to fetch" because the preview proxy intercepts Supabase auth POSTs. This works fine on the published URL but looks broken in preview.
3. **Console ref warning** ("Function components cannot be given refs") comes from `<Button asChild><Link/></Button>` in `Header.tsx`. Harmless, but noisy.

## Fixes

1. **Enable managed Google OAuth** via Cloud auth config so `signInWithOAuth({ provider: "google" })` works with no extra setup from you.
2. **Improve `Auth.tsx` error UX**: catch the preview "Failed to fetch" case and show a clear toast suggesting the published URL; keep sign-in button enabled on error; stop spinner reliably.
3. **Fix the ref warning in `Header.tsx`**: replace `<Button asChild><Link/></Button>` with a `Link` styled via `buttonVariants(...)` so no ref is forwarded into a plain function component.
4. **Quick verification**: check Cloud status, then confirm email and Google sign-in both succeed.

## Notes

- Email confirmation stays required (we will not auto-confirm).
- No DB or schema changes needed.
- After this, if Google still 400s, it means the managed credential rollout hasn't propagated — I'll surface a button to open Cloud auth settings.
