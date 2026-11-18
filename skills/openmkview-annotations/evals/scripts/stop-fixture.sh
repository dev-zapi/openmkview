#!/usr/bin/env bash
#
# Stop an instance started by boot-fixture.sh.
#
# Usage: stop-fixture.sh ROOT
#        stop-fixture.sh ROOT --keep   # stop the server but keep the files
#
set -euo pipefail

ROOT="${1:?usage: stop-fixture.sh ROOT [--keep]}"
KEEP="${2:-}"

if [[ -f "$ROOT/pid" ]]; then
  PID="$(cat "$ROOT/pid")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -f "$ROOT/pid"
fi

if [[ "$KEEP" != "--keep" ]]; then
  rm -rf "$ROOT"
fi

echo "stopped $ROOT"
