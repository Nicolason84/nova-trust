import json
import os
import mimetypes
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse
from pathlib import Path
from urllib.parse import urlparse

# CONFIG RENDER / LOCAL
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "18777"))

# PATHS
ROOT = Path.home() / "Desktop" / "NOVA_VX"
APP = ROOT / "app"
STATIC = APP / "static"
RUNTIME = ROOT / "runtime"

LIVE_APP = APP / "live_state.json"
LIVE_RUNTIME = RUNTIME / "live_state.json"
HISTORY_FILE = RUNTIME / "trust_history.json"

INDEX_FILE = APP / "index.html"
TRUST_FILE = APP / "trust.html"


def read_text(path: Path, fallback: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except:
        return fallback


def read_json(path: Path, fallback=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except:
        return fallback if fallback is not None else {}


def write_json(path: Path, data):
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except:
        pass


class Handler(BaseHTTPRequestHandler):

    def _set_headers(self, status=200, content_type="text/html"):
        self.send_response(status)
        self.send_header("Content-type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            self._set_headers()
            self.wfile.write(read_text(INDEX_FILE, "INDEX NOT FOUND").encode())
            return

        if path == "/trust":
            self._set_headers()
            self.wfile.write(read_text(TRUST_FILE, "TRUST NOT FOUND").encode())
            return

        if path == "/api/trust/live":
            self._set_headers(content_type="application/json")
            data = read_json(LIVE_RUNTIME, {"status": "ok", "ts": str(datetime.utcnow())})
            self.wfile.write(json.dumps(data).encode())
            return

        # STATIC FILES
        file_path = STATIC / path.lstrip("/")
        if file_path.exists():
            mime = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
            self._set_headers(content_type=mime)
            self.wfile.write(file_path.read_bytes())
            return

        self._set_headers(404)
        self.wfile.write(b"404 NOT FOUND")


def main():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"SERVER_READY http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
