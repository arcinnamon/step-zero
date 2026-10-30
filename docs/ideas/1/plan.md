# Plan: update language (issue #1)

## Goal

The home page greets visitors with a "Hola" heading. The change is one hardcoded word with correct language markup.

## Out of scope

- Translation, i18n libraries, locale detection, or language switching.
- Changing the placeholder paragraph or the page-wide `lang`.
- Editing `app/index.html`.

## Data model

None.

## Pages and routes

- `/`: public. Renders an h1 "Hola" (with `lang="es"`) above the existing placeholder paragraph.

## Tasks

- [x] T1: In `app/page.tsx`, change the h1 to `<h1 lang="es">Hola</h1>`, leaving the paragraph unchanged. Verify: `npm run typecheck` and `npm run lint` pass.
- [x] T2: Update `tests/e2e/home.spec.ts` to assert `getByRole("heading", { level: 1, name: "Hola" })` is visible and has attribute `lang="es"`. Verify: `npm run test:e2e` passes, and fails if the h1 text is reverted.

## Risks

- The repo has no component-test tooling (no new dependencies allowed), so the check is a Playwright test, which is slower than a unit test.
