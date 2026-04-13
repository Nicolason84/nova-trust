#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/NOVA_VX"

if [ -f "$ROOT/runtime/server.pid" ]; then
  kill "$(cat "$ROOT/runtime/server.pid")" 2>/dev/null || true
fi

if [ -f "$ROOT/runtime/supervisor.pid" ]; then
  kill "$(cat "$ROOT/runtime/supervisor.pid")" 2>/dev/null || true
fi

sleep 1
rm -f "$ROOT/runtime/server.pid" "$ROOT/runtime/supervisor.pid"
"$ROOT/ops/run_supervisor.sh"
sleep 2

echo "SUP=$(cat "$ROOT/runtime/supervisor.pid" 2>/dev/null || echo ABSENT)"
echo "SRV=$(cat "$ROOT/runtime/server.pid" 2>/dev/null || echo ABSENT)"
lsof -nP -iTCP:18777 -sTCP:LISTEN || echo "PORT FREE"
tail -n 12 "$ROOT/runtime/supervisor.log" 2>/dev/null || true
