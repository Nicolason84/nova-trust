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
        path = urlparse(self.path).path
        query = urlparse(self.path).query

        if path in ["/", "/index.html"]:
            try:
                with open("app/index.html", "rb") as f:
                    self._set_headers()
                    self.wfile.write(f.read())
            except Exception as e:
                print("INDEX ERROR:", e, flush=True)
                self._set_headers(404)
                self.wfile.write(b"INDEX NOT FOUND")

        elif path == "/trust":
            try:
                with open("app/trust.html", "rb") as f:
                    self._set_headers()
                    self.wfile.write(f.read())
            except Exception as e:
                print("TRUST ERROR:", e, flush=True)
                self._set_headers(404)
                self.wfile.write(b"TRUST NOT FOUND")

        elif path == "/api/trust/live":
            data = {
                "status": "ok",
                "app": "TRUST+",
                "cash": 0,
                "payments": 0,
                "business_score": 0,
                "analysis_score": 0,
                "fusion_score": 0,
                "verdict": "WAIT",
                "history": [],
                "rationale": []
            }
            self._set_headers(200, "application/json")
            self.wfile.write(json.dumps(data).encode())

        elif path == "/api/trust/analyze":
            q = ""
            if "q=" in query:
                q = query.split("q=", 1)[1]
            q = urllib.parse.unquote_plus(q)

            score = 80 if q.startswith("https://") else 30
            verdict = "SAFE" if score > 70 else "RISKY"

            data = {
                "status": "ok",
                "app": "TRUST+",
                "cash": 0,
                "payments": 0,
                "business_score": 0,
                "analysis_score": score,
                "fusion_score": score,
                "fusion_verdict": verdict,
                "verdict": verdict,
                "rationale": ["Analyse simple active"],
                "history": []
            }
            self._set_headers(200, "application/json")
            self.wfile.write(json.dumps(data).encode())

        else:
            self._set_headers(404)
            self.wfile.write(b"NOT FOUND")



def main():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"SERVER_READY http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
