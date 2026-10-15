#!/usr/bin/env bash
# Run from the repository root on the authorised VPS. No other containers or nginx sites are modified.
set -euo pipefail
: "${APP_ORIGIN:?Set APP_ORIGIN to the exact HTTPS review or production origin}"
IMAGE="${IMAGE:-pappy-earning-hub:mission-01}"
NAME=pappy-earning-hub
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DATA=/var/lib/pappy-earning-hub
install -d -m 700 -o 1000 -g 1000 "$DATA"
# Secrets stay outside Git, the image, and the SQLite/data volume. Never rotate these
# on ordinary releases: losing either key breaks encrypted sessions/phone history.
CONFIG=/etc/pappy-earning-hub
install -d -m 700 "$CONFIG"
if [[ "${WHATSAPP_ENABLED:-false}" == true && ! -f "$CONFIG/whatsapp.env" ]]; then
  umask 077
  printf 'WA_ENCRYPTION_KEY=%s\nWA_IDENTITY_KEY=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > "$CONFIG/whatsapp.env"
fi
WA_ENV=()
if [[ -f "$CONFIG/whatsapp.env" ]]; then chmod 600 "$CONFIG/whatsapp.env"; WA_ENV=(--env-file "$CONFIG/whatsapp.env"); fi
docker build -t "$IMAGE" .
rollback() {
  set +e
  if docker container inspect "${NAME}-rollback-${STAMP}" >/dev/null 2>&1; then
    docker stop "$NAME" >/dev/null 2>&1
    docker rm "$NAME" >/dev/null 2>&1
    docker rename "${NAME}-rollback-${STAMP}" "$NAME"
    docker start "$NAME" >/dev/null
    echo 'Previous application container restored.' >&2
  fi
}
trap 'rollback; exit 1' ERR
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
  "${WA_ENV[@]}" -e WHATSAPP_ENABLED="${WHATSAPP_ENABLED:-false}" \
  -e APP_ORIGIN="$APP_ORIGIN" -e COOKIE_SECURE=true \
  -e TRUST_PROXY_HOPS="${TRUST_PROXY_HOPS:-0}" \
  -v "$DATA:/app/data" "$IMAGE"
for attempt in $(seq 1 45); do
  if curl --fail --silent http://127.0.0.1:3107/api/health >/dev/null; then
    echo 'Application health passed. Paid dispatch and payouts are not enabled by this release script.'
    exit 0
  fi
  sleep 1
done
echo 'New container failed health; restoring preserved container.' >&2
rollback
exit 1
