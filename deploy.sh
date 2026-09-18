#!/bin/bash
# Build and publish Planly to Cloudflare Pages.
# Project name comes from wrangler.toml (or PLANLY_PROJECT).
set -e
cd "$(dirname "$0")"

PROJECT="${PLANLY_PROJECT:-planly}"
./build.sh

npx --yes wrangler@latest pages deploy dist \
  --project-name="$PROJECT" --branch=main --commit-dirty=true

echo "Deployed project '$PROJECT'."
