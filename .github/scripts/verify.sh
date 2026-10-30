#!/usr/bin/env bash
# Runs every check CI runs and writes a markdown table of results.
# Usage: bash .github/scripts/verify.sh [output.md]
set -uo pipefail
OUT="${1:-.pipeline/out/checks.md}"
LOGS="$(dirname "$OUT")/logs"
mkdir -p "$LOGS"

# Placeholders so builds work without real Supabase credentials.
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-placeholder}"
export NEXT_TELEMETRY_DISABLED=1

fail=0
printf '| Check | Result |\n|---|---|\n' > "$OUT"
check() {
  local name="$1"; shift
  if "$@" > "$LOGS/$name.log" 2>&1; then
    echo "| $name | pass |" >> "$OUT"
  else
    echo "| $name | FAIL |" >> "$OUT"
    echo "---- $name (last 40 lines) ----"; tail -n 40 "$LOGS/$name.log"
    fail=1
  fi
}
check lint npm run lint
check typecheck npm run typecheck
check unit npm run test
check build npm run build
cat "$OUT"
exit $fail
