#!/usr/bin/env bash
# Sends one Web Push notification to every active subscriber.
#
#   PUSH_BROADCAST_SECRET=... scripts/push-broadcast.sh "Message body" ["Title"] [users|family|doctors|all] [/url]
#
# API defaults to production; override with API=http://localhost:3001.
set -euo pipefail

API="${API:-https://api.anuvawellness.com}"
: "${PUSH_BROADCAST_SECRET:?Set PUSH_BROADCAST_SECRET}"
BODY="${1:?Usage: $0 \"Message body\" [\"Title\"] [audience] [url]}"
TITLE="${2:-Anuva}"
AUDIENCE="${3:-users}"
URL_PATH="${4:-/home}"

PAYLOAD=$(node -e 'console.log(JSON.stringify({title:process.argv[1],body:process.argv[2],audience:process.argv[3],url:process.argv[4]}))' \
  "$TITLE" "$BODY" "$AUDIENCE" "$URL_PATH")

curl -sS -X POST "$API/push/web/broadcast?secret=$PUSH_BROADCAST_SECRET" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD"
echo
