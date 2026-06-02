#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
else
  echo "warning: backend/.env not found — copy .env.example to .env and fill in secrets" >&2
fi

exec ./mvnw spring-boot:run "$@"
