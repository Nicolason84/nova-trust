import json
import mimetypes
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path.home() / "Desktop" / "NOVA_VX"
APP = ROOT / "app"
STATIC = APP / "static"
RUNTIME = ROOT / "runtime"
LIVE_APP = APP / "live_state.json"
LIVE_RUNTIME = RUNTIME / "live_state.json"
HISTORY_FILE = RUNTIME / "trust_history.json"

HOST = "127.0.0.1"
PORT = 18777

INDEX_FILE = APP / "index.html"
TRUST_FILE = APP / "trust.html"

def read_text(path: Path, fallback: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return fallback

def build_live_state():
    for candidate in (LIVE_APP, LIVE_RUNTIME):
        try:
            if candidate.exists():
                return json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "ok": True,
        "app": "NOVA VX",
        "mode": "local",
        "trust_route": "/trust",
        "ts": datetime.now().isoformat(timespec="seconds"),
        "supervisor_pid_file": str(RUNTIME / "supervisor.pid"),
        "server_pid_file": str(RUNTIME / "server.pid"),
    }

def analyze_input(payload: str):
    text = (payload or "").strip()
    low = text.lower()
    reasons = []
    score = 50
    verdict = "WAIT"

    if not text:
        return {
            "ok": True,
            "input": text,
            "verdict": "EMPTY",
            "score": 0,
            "reasons": ["Aucune entrée fournie."],
        }

    risky_terms = ["urgent", "password", "bank", "crypto", "wallet", "reset", "gift", "free money", "wire", "iban", "login", "verify account"]
    safe_terms = ["wikipedia.org", "github.com", "openai.com", "service-public.fr", "gouv.fr"]

    if text.startswith("http://"):
        score -= 25
        reasons.append("Lien non sécurisé en HTTP.")
    if text.startswith("https://"):
        score += 10
        reasons.append("Lien en HTTPS.")

    if any(term in low for term in risky_terms):
        score -= 20
        reasons.append("Présence de termes à risque ou de pression.")

    if "bit.ly" in low or "tinyurl" in low or "t.co/" in low:
        score -= 15
        reasons.append("URL raccourcie détectée.")

    if "@" in text and ("login" in low or "password" in low):
        score -= 15
        reasons.append("Demande potentielle d’identifiants.")

    if any(term in low for term in safe_terms):
        score += 20
        reasons.append("Domaine de confiance reconnu.")

    if len(text) > 180:
        score -= 5
        reasons.append("Entrée dense : prudence avant décision rapide.")

    score = max(0, min(100, score))

    if score >= 80:
        verdict = "SAFE"
    elif score >= 60:
        verdict = "ACT"
    elif score >= 35:
        verdict = "WAIT"
    else:
        verdict = "RISKY"

    if not reasons:
        reasons.append("Aucun signal fort détecté.")

    return {
        "ok": True,
        "input": text,
        "verdict": verdict,
        "score": score,
        "reasons": reasons,
    }

def fuse_decision(payload: str):
    analysis = analyze_input(payload)
    live = build_live_state()

    analysis_score = int(analysis.get("score", 0) or 0)
    business_score = int(live.get("score", 0) or 0)
    lead_status = str(live.get("best_lead_status", "") or "").upper()
    lead_action = str(live.get("best_lead_action", "") or "")

    fusion_score = round((analysis_score * 0.7) + (business_score * 0.3))
    rationale = []

    if analysis.get("verdict") == "RISKY":
        fusion_verdict = "RISKY"
        rationale.append("L’analyse opérateur détecte un risque prioritaire.")
    elif analysis.get("verdict") == "SAFE" and lead_status == "HOT":
        fusion_verdict = "ACT"
        fusion_score = max(fusion_score, 85)
        rationale.append("Analyse sûre + lead business HOT.")
    elif analysis_score >= 60 and business_score >= 10:
        fusion_verdict = "ACT"
        rationale.append("Analyse suffisamment bonne et contexte business actif.")
    elif analysis_score >= 80:
        fusion_verdict = "SAFE"
        rationale.append("Analyse très favorable.")
    elif fusion_score >= 55:
        fusion_verdict = "WAIT"
        rationale.append("Signaux mixtes : attendre ou vérifier davantage.")
    else:
        fusion_verdict = "RISKY"
        rationale.append("Fusion insuffisante pour agir avec confiance.")

    if lead_action:
        rationale.append(f"Action business suggérée : {lead_action}.")

    result = {
        "ok": True,
        "input": payload,
        "analysis_verdict": analysis.get("verdict"),
        "analysis_score": analysis_score,
        "business_score": business_score,
        "fusion_score": fusion_score,
        "fusion_verdict": fusion_verdict,
        "lead_status": lead_status,
        "lead_action": lead_action,
        "analysis_reasons": analysis.get("reasons", []),
        "rationale": rationale,
        "live": live,
    }
    history_entry = {
        "input": payload,
        "fusion_verdict": fusion_verdict,
        "fusion_score": fusion_score,
        "analysis_score": analysis_score,
        "business_score": business_score,
        "ts": datetime.now().isoformat(timespec="seconds"),
    }
    result["history"] = push_history(history_entry)
    return result

def read_history():
    try:
        if HISTORY_FILE.exists():
            data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data[:5]
    except Exception:
        pass
    return []


def write_history(items):
    HISTORY_FILE.write_text(json.dumps(items[:5], ensure_ascii=False, indent=2), encoding="utf-8")


def push_history(entry):
    items = read_history()
    filtered = []
    for x in items:
        if x.get("input") != entry.get("input"):
            filtered.append(x)
    items = [entry] + filtered
    write_history(items[:5])
    return items[:5]

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send_text(self, code: int, body: str, content_type: str = "text/html; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, payload: dict, code: int = 200):
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, path: Path):
        if not path.exists() or not path.is_file():
            self._send_text(404, "Not Found", "text/plain; charset=utf-8")
            return
        ctype, _ = mimetypes.guess_type(str(path))
        if not ctype:
            ctype = "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            self._send_text(200, read_text(INDEX_FILE, "<h1>NOVA VX</h1>"))
            return

        if path == "/trust":
            self._send_text(200, read_text(TRUST_FILE, "<h1>TRUST</h1>"))
            return

        if path == "/api/state":
            self._send_json(build_live_state())
            return

        if path == "/api/trust/live":
            self._send_json(build_live_state())
            return

        if path == "/api/trust/analyze":
            payload = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
            self._send_json(analyze_input(payload))
            return

        if path == "/api/trust/fuse":
            payload = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
            self._send_json(fuse_decision(payload))
            return

        if path == "/api/trust/history":
            self._send_json({"ok": True, "items": read_history()})
            return

        if path.startswith("/static/"):
            rel = path[len("/static/"):]
            target = (STATIC / rel).resolve()
            try:
                target.relative_to(STATIC.resolve())
            except Exception:
                self._send_text(403, "Forbidden", "text/plain; charset=utf-8")
                return
            self._send_file(target)
            return

        self._send_text(404, "Not Found", "text/plain; charset=utf-8")

def main():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"SERVER_READY http://{HOST}:{PORT}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()
