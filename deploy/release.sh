#!/usr/bin/env bash
# Run from the repository root on the authorised VPS. No other containers or nginx sites are modified.
set -euo pipefail
: "${APP_ORIGIN:?Set APP_ORIGIN to the exact HTTPS review or production origin}"
IMAGE="${IMAGE:-pappy-earning-hub:mission-01}"
NAME=pappy-earning-hub
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DATA=/var/lib/pappy-earning-hub
install -d -m 700 -o 1000 -g 1000 "$DATA"
docker build -t "$IMAGE" .
if docker container inspect "$NAME" >/dev/null 2>&1; then
  docker exec "$NAME" npm run backup
  docker stop "$NAME"
  docker rename "$NAME" "${NAME}-rollback-${STAMP}"
  echo "Previous container preserved: ${NAME}-rollback-${STAMP}"
fi
docker run -d --name "$NAME" --restart unless-stopped \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --pids-limit 128 --memory 512m --cpus 1 \
  --log-opt max-size=10m --log-opt max-file=3 \
  -p 127.0.0.1:3107:3107 \
  -e APP_ORIGIN="$APP_ORIGIN" -e COOKIE_SECURE=true \
  -v "$DATA:/app/data" "$IMAGE"
echo 'Started isolated pre-launch app. Verify /api/health and container health before accepting the release.'
