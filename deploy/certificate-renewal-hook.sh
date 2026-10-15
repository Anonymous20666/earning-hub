#!/bin/sh
set -eu
if [ "${RENEWED_LINEAGE:-}" = "/etc/letsencrypt/live/pappy-earnig-hub.duckdns.org" ]; then
    /usr/sbin/nginx -t
    /usr/sbin/nginx -s reload
fi
