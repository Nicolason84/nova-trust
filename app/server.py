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

# PATHS (COMPATIBLE RAILWAY)
BASE = Path(__file__).resolve().parent
APP = BASE
STATIC = APP / "static"
RUNTIME = BASE.parent / "runtime"

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
        if self.path == "/" or self.path == "/index.html":
            try:
                with open("app/index.html", "rb") as f:
                    self._set_headers()
                    self.wfile.write(f.read())
            except:
                self._set_headers(404)
                self.wfile.write(b"INDEX NOT FOUND")

        elif self.path == "/trust":
            try:
                with open("app/trust.html", "rb") as f:
                    self._set_headers()
                    self.wfile.write(f.read())
            except:
                self._set_headers(404)
                self.wfile.write(b"TRUST NOT FOUND")

        else:
            self._set_headers(404)
            self.wfile.write(b"NOT FOUND")
def main():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"SERVER_READY http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
