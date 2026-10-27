#!/usr/bin/env bash
# Sends one user a nudge now, however many she has already had today.
#
#   PUSH_BROADCAST_SECRET=... scripts/send-nudge.sh <user id | email | phone> [morning|afternoon|evening]
#
# The slot defaults to morning. Trackers she has already logged today are left out, so if she has
# logged them all nothing is sent and the reply says why (SR-05).
#
# API defaults to production; override with API=http://localhost:3001.
set -euo pipefail

API="${API:-https://api.anuvawellness.com}"
: "${PUSH_BROADCAST_SECRET:?Set PUSH_BROADCAST_SECRET}"
WHO="${1:?Usage: $0 <user id | email | phone> [morning|afternoon|evening]}"
SLOT="${2:-morning}"

QUERY=$(node -e 'const q=new URLSearchParams({secret:process.argv[1],user:process.argv[2],slot:process.argv[3]});console.log(q.toString())' \
  "$PUSH_BROADCAST_SECRET" "$WHO" "$SLOT")

curl -sS -X POST "$API/nudge/dispatch/user?$QUERY"
echo
