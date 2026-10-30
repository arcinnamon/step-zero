# Project conventions

Every agent in the pipeline reads this before changing anything. Humans too.

## Stack

- Next.js (App Router, TypeScript, React Server Components), hosted on Vercel
- Supabase for Postgres and Auth, through `@supabase/ssr` and `@supabase/supabase-js`
- Vitest for unit tests, Playwright for end-to-end tests

## Layout

- `app/`: routes. `app/auth/callback/route.ts` handles Supabase auth redirects.
- `components/`: shared UI components.
- `lib/`: logic. `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server), `lib/supabase/proxy.ts` (session refresh).
- `proxy.ts`: Next.js 16's replacement for middleware. Session refresh only.
- `supabase/migrations/`: SQL migrations, applied to staging then production by the pipeline.
- `tests/unit/`, `tests/e2e/`: tests.
- `docs/ideas/<issue>/`: approved idea and plan for each issue.

## Rules

- App Router only. No `pages/` directory.
- Server Components by default. Add `"use client"` only for state, effects, or browser APIs, and keep client components small and close to the leaves.
- All data access goes through `lib/supabase`. On the server, `await createClient()` from `lib/supabase/server` per request.
- Mutations happen in Server Actions or route handlers. Each one checks the user with `supabase.auth.getUser()` before touching data. `proxy.ts` is not an authorization layer.
- Every table enables row-level security and gets explicit policies in the same migration that creates it.
- Migrations are append-only. Never edit a migration that exists on the default branch. Make schema changes backward-compatible (add, backfill, then remove later), because migrations run before new code deploys.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may be public. Never put a secret behind a `NEXT_PUBLIC_` name. Never use the Supabase secret or service-role key in app code.
- Validate input at boundaries: forms, route handlers, Server Actions, URL parameters.
- Redirect targets from user input go through `safeRedirectPath` in `lib/redirect.ts`.
- Don't change versions of existing dependencies. Add a new dependency only when the plan names it.
- Every plan task gets at least one test that would fail if the feature broke. Don't skip, delete, or weaken tests, and don't disable lint rules.
- Accessible by default: semantic HTML, labelled inputs, visible focus, sufficient contrast, works at phone widths.
- Copy is plain and specific. Buttons say what they do ("Save plant", not "Submit"). Errors say what happened and how to fix it.

## Off-limits to agents

`.github/`, `.claude/`, `CLAUDE.md`, `_pipeline/`, `vercel.json`, and `supabase/config.toml`. The pipeline undoes changes to the first three automatically.

## Commands

- `npm run dev`: local dev server
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
- `npm run test:e2e`: Playwright (builds and starts the app unless `BASE_URL` is set)
- `bash .github/scripts/verify.sh`: everything CI checks, with a results table
