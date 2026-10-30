#!/usr/bin/env bash
# Commits agent output to the idea branch. Protected paths are always reset
# to the default branch first, so agents can't change their own rules.
set -euo pipefail
msg="$1"
: "${BRANCH:?}" "${DEFAULT_BRANCH:?}" "${GH_TOKEN:?}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

mkdir -p .pipeline/out
reverted=""
for p in .github .claude CLAUDE.md; do
  changed=""
  git diff --quiet "origin/${DEFAULT_BRANCH}" -- "$p" 2>/dev/null || changed=1
  [ -n "$(git ls-files --others --exclude-standard -- "$p")" ] && changed=1
  if [ -n "$changed" ]; then
    reverted="${reverted:+$reverted, }$p"
    git restore --source="origin/${DEFAULT_BRANCH}" --staged --worktree -- "$p" 2>/dev/null || true
    git clean -fdq -- "$p" 2>/dev/null || true
  fi
done
if [ -n "$reverted" ]; then echo "$reverted" > .pipeline/out/reverted.txt; else rm -f .pipeline/out/reverted.txt; fi

# .pipeline/ and _pipeline/ are excluded via .gitignore. Naming them in
# pathspecs makes git add fail because they're ignored.
git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -q -m "$msg"
fi
git push -q "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/${BRANCH}"
