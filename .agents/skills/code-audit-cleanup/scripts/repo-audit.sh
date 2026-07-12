#!/usr/bin/env bash
#
# Repo audit helper for the code-audit-cleanup skill.
# Discovers tooling config, nearby tests, and likely contract-surface files.
# Run from the repo root (or from the scoped package in a monorepo).
#
# Usage:
#   bash scripts/repo-audit.sh

set -u

echo "=== working directory ==="
pwd
echo

echo "=== git status (short) ==="
git status --short 2>/dev/null || echo "not a git repo or git unavailable"
echo

echo "=== style and tooling signals ==="
find . -maxdepth 4 -type f \
  \( -name '.editorconfig' -o -name '.prettierrc*' -o -name 'eslint.config.*' -o -name 'biome.json' \
  -o -name 'pyproject.toml' -o -name 'ruff.toml' -o -name 'tsconfig.json' -o -name 'package.json' \
  -o -name 'rustfmt.toml' -o -name '.golangci.yml' -o -name 'Cargo.toml' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/build/*' \
  -not -path '*/.venv/*' -not -path '*/venv/*' -not -path '*/target/*' \
  2>/dev/null | sort
echo

echo "=== nearby tests (capped at 200) ==="
find . -type f \
  \( -path '*/tests/*' -o -path '*/__tests__/*' -o -name '*.spec.*' -o -name '*.test.*' \
  -o -name 'test_*.py' -o -name '*_test.py' -o -name '*_test.go' -o -name '*Test.java' \
  -o -name '*Tests.kt' -o -name '*.test.ts' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' \
  -not -path '*/.venv/*' -not -path '*/venv/*' -not -path '*/target/*' \
  2>/dev/null | sort | head -n 200
echo

echo "=== likely contract-surface files (capped at 200) ==="
find . -maxdepth 6 -type f \
  \( -name 'index.*' -o -name '__init__.py' -o -name '*route*.*' -o -name '*router*.*' \
  -o -name '*controller*.*' -o -name '*handler*.*' -o -name '*schema*.*' -o -name '*serializer*.*' \
  -o -name '*dto*.*' -o -name '*.proto' -o -name '*.graphql' -o -name '*.gql' \
  -o -name '*.thrift' -o -path '*/migrations/*' -o -name 'openapi.*' -o -name 'swagger.*' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' \
  -not -path '*/.venv/*' -not -path '*/venv/*' -not -path '*/target/*' \
  2>/dev/null | sort | head -n 200
