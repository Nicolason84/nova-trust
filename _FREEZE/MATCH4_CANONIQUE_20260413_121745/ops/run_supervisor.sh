#!/usr/bin/env bash
set -eu

ROOT="$HOME/Desktop/NOVA_VX"
PY="$ROOT/ops/supervisor.py"
LOG="$ROOT/runtime/launcher.log"

mkdir -p "$ROOT/runtime"

if [ ! -f "$PY" ]; then
  echo "MISSING: $PY"
  exit 1
fi

nohup python3 "$PY" >> "$LOG" 2>&1 &
sleep 1
echo "LAUNCHED"
[ -f "$ROOT/runtime/supervisor.pid" ] && echo "SUP_PID=$(cat "$ROOT/runtime/supervisor.pid")" || true
[ -f "$ROOT/runtime/server.pid" ] && echo "SERVER_PID=$(cat "$ROOT/runtime/server.pid")" || true
echo "URL=http://127.0.0.1:18777"
