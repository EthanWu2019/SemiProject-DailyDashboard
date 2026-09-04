# SemiProject-DailyDashboard

A Next.js dashboard for habit-tracking: each morning the page asks
what you're working on, holds a streak counter, and rolls penalties
into the next day's expected outcome if you miss a check-in.

> Originally written as a private substitute for off-the-shelf
> habit apps: those wanted a subscription before they'd let me
> track simple check-ins; this is one file per route, a SQLite
> database, and a Supabase auth layer.

## Build

```bash
npm install
# Configure Supabase — set these in `.env.local`:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...
npx prisma generate  # uses @supabase/supabase-js under the hood
npm run dev
```

## Run

```
npm run dev
# open http://localhost:3000
```

The page is fully server-rendered with `actions` queries; opening it
shows today's tasks, the previous day's settle result, and the
running streak per habit. Light/dark modes are on the same
toggle, no theme provider plumbing required.

## Status

- [x] Daily task pool + chain-of-tasks logic
- [x] Streak / penalty / settle flow
- [x] Supabase auth (sign-up, sign-in, password reset)
- [ ] Export-import of habit definitions

## License

Mit
