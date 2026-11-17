#!/usr/bin/env bash
# Hard-deletes one patient account by user id, using scripts/delete-user.sql. Cannot be undone.
#
#   scripts/delete-user.sh <userId>            shows who it is, asks before deleting
#   scripts/delete-user.sh <userId> --yes      no question (for when you are sure)
#
# DATABASE_URL comes from the environment, falling back to the repo-root .env.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
user_id="${1:-}"
if [[ -z "$user_id" || "$user_id" == --* ]]; then
  echo "Usage: scripts/delete-user.sh <userId> [--yes]" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -f "$root/.env" ]]; then
  DATABASE_URL="$(grep -E '^\s*(export\s+)?DATABASE_URL=' "$root/.env" | tail -1 | sed -E 's/^\s*(export\s+)?DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//')"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set (and not found in .env)." >&2
  exit 1
fi
# Prisma's ?schema= parameter is not something psql understands.
db_url="$(printf '%s' "$DATABASE_URL" | sed -E 's/[?&]schema=[^&]*//')"
host="$(printf '%s' "$db_url" | sed -E 's#^[a-z]+://[^@]*@##; s#\?.*$##')"

echo "Database: $host"
found="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -v user_id="$user_id" <<'SQL'
SELECT id || '  ' || coalesce(name, '(no name)') || '  ' || phone || '  joined ' || to_char("createdAt", 'YYYY-MM-DD')
  FROM "User" WHERE id = :'user_id';
SQL
)"
if [[ -z "$found" ]]; then
  echo "No user with id $user_id. Nothing deleted." >&2
  exit 1
fi
echo "User:     $found"

if [[ "${2:-}" != "--yes" ]]; then
  read -r -p "Delete this user and ALL their data? Type DELETE to confirm: " answer
  if [[ "$answer" != "DELETE" ]]; then
    echo "Cancelled. Nothing deleted."
    exit 1
  fi
fi

psql "$db_url" -X -q -v user_id="$user_id" -f "$root/scripts/delete-user.sql"
echo "Deleted user $user_id."
