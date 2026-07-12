#!/usr/bin/env bash
#
# Diff guard helper for the code-audit-cleanup skill.
# Reports diff size and flags contract-surface or generated files in the diff.
# Run from the repo root.
#
# Usage:
#   bash scripts/diff-guard.sh           # diff against HEAD
#   bash scripts/diff-guard.sh main      # diff against another base
#   bash scripts/diff-guard.sh HEAD~3    # diff against an arbitrary ref

set -u

BASE="${1:-HEAD}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: not a git repository" >&2
  exit 1
fi

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  echo "error: base ref '$BASE' does not exist" >&2
  exit 1
fi

echo "=== diff stats vs $BASE ==="
git diff --stat "$BASE"
echo

echo "=== files changed ==="
git diff --name-only "$BASE"
echo

N_FILES="$(git diff --name-only "$BASE" | grep -c . || true)"
N_LINES="$(git diff --numstat "$BASE" | awk '$1 != "-" && $2 != "-" { add+=$1; del+=$2 } END { print add+del+0 }')"

echo "=== summary ==="
echo "files changed: $N_FILES"
echo "lines changed: $N_LINES"
echo

echo "=== contract-surface files in diff ==="
git diff --name-only "$BASE" | grep -Ei \
  '(^|/)(index|api|routes?|router|controller|handler|schema|serializer|dto|contract|types?|models?|entities|public|exports?)([._/-]|$)|(^|/)(openapi|swagger|asyncapi)|(^|/)__init__\.py$|\.proto$|\.graphql$|\.gql$|\.thrift$|\.sql$|(^|/)migrations?(/|$)' \
  || echo 'no obvious contract-surface files in diff'
echo

echo "=== generated or vendored files in diff ==="
git diff --name-only "$BASE" | grep -Ei \
  '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|Cargo\.lock|poetry\.lock|Pipfile\.lock|Gemfile\.lock|composer\.lock|go\.sum)$|(^|/)(node_modules|vendor|third_party|external|\.venv|venv|dist|build|out|\.next|\.nuxt|target|bin|obj)(/|$)|\.pb\.(go|cc|h)$|_pb2\.py$|\.generated\.' \
  || echo 'no obvious generated or vendored files in diff'
echo

echo "=== threshold check ==="
if [ "$N_FILES" -gt 5 ]; then
  echo "WARNING: $N_FILES files changed (threshold: 5)"
fi
if [ "$N_LINES" -gt 200 ]; then
  echo "WARNING: $N_LINES lines changed (threshold: 200)"
fi
if [ "$N_FILES" -le 5 ] && [ "$N_LINES" -le 200 ]; then
  echo "ok: diff within default thresholds (<=5 files, <=200 lines)"
fi
