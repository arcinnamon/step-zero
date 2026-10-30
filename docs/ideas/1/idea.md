# Idea: update language (issue #1)

## Request

As a visitor I want the page to say "Hola" so that it greets me.

## Decisions from review

- Change only the h1 in `app/page.tsx` to "Hola". `app/index.html` is not served by the App Router; leave it alone.
- Hardcode the text. No i18n library, locale detection, or new dependencies.
- Put `lang="es"` on the h1 only, so screen readers pronounce it correctly. The rest of the page stays English.
- Keep the placeholder paragraph under the greeting, unchanged.
- Add one test that the home page shows a heading "Hola".
- No data, auth, or schema changes.
