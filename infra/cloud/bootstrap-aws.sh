#!/bin/sh
set -eu
: "${APP_BASE_URL:?Set the HTTPS CloudFront public URL}"
: "${FRONTEND_REF:?Set the reviewed 40-character frontend SHA}"
: "${ORIGIN_SECRET:?Retrieve the generated Secrets Manager origin secret without printing it}"
case "$APP_BASE_URL" in https://*.cloudfront.net) ;; *) echo 'Use the approved CloudFront HTTPS URL' >&2; exit 1;; esac
case "$FRONTEND_REF" in *[!a-f0-9]*|'') echo 'Invalid frontend SHA' >&2; exit 1;; esac
[ "${#FRONTEND_REF}" -eq 40 ] || exit 1
[ -f compose.yaml ] || { echo 'Run from the reviewed platform checkout' >&2; exit 1; }
if [ ! -f .env ]; then
  umask 077
  {
    printf 'APP_BASE_URL=%s\nFRONTEND_REF=%s\nORIGIN_SECRET=%s\n' "$APP_BASE_URL" "$FRONTEND_REF" "$ORIGIN_SECRET"
    for service in IDENTITY TRACEABILITY LOGISTICS PROCESSING JEWELRY CERTIFICATION DEVICES REPORTING; do
      printf '%s_DB_PASSWORD=%s\n' "$service" "$(openssl rand -hex 24)"
    done
    printf 'INTERNAL_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
  } > .env
else
  echo 'Existing .env retained. Verify public URL and reviewed frontend revision before updating.' >&2
fi
docker compose -f compose.yaml -f compose.aws.yaml config --quiet
docker compose -f compose.yaml -f compose.aws.yaml up -d --build
printf 'Verify the approved deployment at %s\n' "$APP_BASE_URL"
