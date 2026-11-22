#!/usr/bin/env bash
# Browser qualification of the existing La Bête page + its dated SUPRA proof panel.
# Runs on a disposable GitHub runner. Does not connect to Nicolas's Mac or SUPRA account.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if command -v google-chrome >/dev/null 2>&1; then
  CHROME="$(command -v google-chrome)"
elif command -v google-chrome-stable >/dev/null 2>&1; then
  CHROME="$(command -v google-chrome-stable)"
elif command -v chromium >/dev/null 2>&1; then
  CHROME="$(command -v chromium)"
else
  echo "FAIL: a real Chromium/Chrome browser is required"
  exit 1
fi
PORT=18765
TMP="$(mktemp -d)"
SOURCE="$ROOT/docs/data/la-bete-supra-public-proof-v1.json"
RESTORE="$TMP/la-bete-supra-public-proof-v1.json"
cp "$SOURCE" "$RESTORE"
SERVER_PID=""
cleanup() {
  cp "$RESTORE" "$SOURCE"
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
python3 -m http.server "$PORT" --directory "$ROOT/docs" --bind 127.0.0.1 >"$TMP/http.log" 2>&1 &
SERVER_PID=$!
for i in {1..50}; do
  if curl --fail --silent --output /dev/null "http://127.0.0.1:$PORT/data/la-bete-supra-public-proof-v1.json"; then break; fi
  sleep 0.2
done
URL="http://127.0.0.1:$PORT/france-debt-rate-risk-live-2026-10-02.html?house=20261005-v11"
browse() {
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --disable-background-networking --no-first-run --no-default-browser-check \
    --virtual-time-budget=8000 --dump-dom "$URL" > "$1" 2>"$TMP/chrome.log"
}
browse "$TMP/valid.html"
grep -q 'id="advisory-house-v5"' "$TMP/valid.html" || { echo "FAIL: original La Bête house is missing"; exit 1; }
grep -q 'class="houseSupraProof"' "$TMP/valid.html" || { echo "FAIL: cooperation panel not mounted"; exit 1; }
grep -q 'data-proof="dated-agent-evidence"' "$TMP/valid.html" || { echo "FAIL: valid dated proof not consumed"; exit 1; }
grep -q 'Consommation native et échanges intercomptes non prouvés' "$TMP/valid.html" || { echo "FAIL: product/account limitations not shown"; exit 1; }
echo "PASS: real browser renders dated agent proof without upgrading native or cross-account status"
rm "$SOURCE"
browse "$TMP/missing.html"
grep -q 'data-proof="unverified"' "$TMP/missing.html" || { echo "FAIL: missing public proof did not fail closed"; exit 1; }
grep -q 'Preuve publique indisponible ou invalide' "$TMP/missing.html" || { echo "FAIL: missing proof text absent"; exit 1; }
echo "PASS: real browser fails closed when the public proof is missing"
