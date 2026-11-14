#!/bin/sh
set -eu
# Run from a reviewed platform checkout on an already approved VM. No cloud resources are created here.
: "${PUBLIC_HOST:?Set a DNS hostname that points to this VM}"
: "${FRONTEND_REF:?Set the reviewed full frontend commit SHA}"
case "$PUBLIC_HOST" in *[!a-zA-Z0-9.-]*|''|.*|-*) echo 'Invalid DNS hostname' >&2; exit 1;; esac
case "$FRONTEND_REF" in *[!a-f0-9]*|'') echo 'Use a lowercase Git commit SHA' >&2; exit 1;; esac
[ "${#FRONTEND_REF}" -eq 40 ] || { echo 'Use the complete commit SHA' >&2; exit 1; }
docker compose version >/dev/null
[ -f compose.yaml ] || { echo 'Run from the platform repository root' >&2; exit 1; }
if [ ! -f .env ]; then
  umask 077
  {
    printf 'APP_BASE_URL=https://%s\nPUBLIC_HOST=%s\nFRONTEND_REF=%s\n' "$PUBLIC_HOST" "$PUBLIC_HOST" "$FRONTEND_REF"
    for service in IDENTITY TRACEABILITY LOGISTICS PROCESSING JEWELRY CERTIFICATION DEVICES REPORTING; do
      printf '%s_DB_PASSWORD=%s\n' "$service" "$(openssl rand -hex 24)"
    done
    printf 'INTERNAL_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
  } > .env
else
  echo '.env already exists; retaining its data and credentials. Check APP_BASE_URL and PUBLIC_HOST before continuing.' >&2
fi
docker compose -f compose.yaml -f compose.cloud.yaml config --quiet
docker compose -f compose.yaml -f compose.cloud.yaml up -d --build
printf 'Started approved deployment. Verify https://%s/api/v1/health and https://%s/\n' "$PUBLIC_HOST" "$PUBLIC_HOST"
