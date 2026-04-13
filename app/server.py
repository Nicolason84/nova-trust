override bash -lc 'python3 -c '"'"'
from pathlib import Path
import re, subprocess

root = Path.home() / "Desktop" / "NOVA_VX"
server = root / "app" / "server.py"
code = server.read_text(encoding="utf-8")

pattern = r"class Handler\(BaseHTTPRequestHandler\):.*?def main\(\):"
replacement = """class Handler(BaseHTTPRequestHandler):

    def _set_headers(self, status=200, content_type=\"text/html\"):
        self.send_response(status)
        self.send_header(\"Content-type\", content_type)
        self.send_header(\"Access-Control-Allow-Origin\", \"*\")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == \"/\" or path == \"/index.html\":
            self._set_headers()
            self.wfile.write(read_text(INDEX_FILE, \"INDEX NOT FOUND\").encode())
            return

        if path == \"/trust\":
            self._set_headers()
            self.wfile.write(read_text(TRUST_FILE, \"TRUST NOT FOUND\").encode())
            return

        if path == \"/api/trust/live\":
            self._set_headers(content_type=\"application/json\")
            data = read_json(LIVE_RUNTIME, {\"status\": \"ok\", \"ts\": str(datetime.utcnow())})
            self.wfile.write(json.dumps(data).encode())
            return

        file_path = STATIC / path.lstrip(\"/\")
        if file_path.exists() and file_path.is_file():
            mime = mimetypes.guess_type(str(file_path))[0] or \"application/octet-stream\"
            self._set_headers(content_type=mime)
            self.wfile.write(file_path.read_bytes())
            return

        self._set_headers(404)
        self.wfile.write(b\"404 NOT FOUND\")

def main():
"""
new_code, n = re.subn(pattern, replacement, code, flags=re.S)
assert n == 1, f\"PATCH_FAILED n={n}\"
server.write_text(new_code, encoding=\"utf-8\")
print(\"PATCH_OK\")
subprocess.run([\"python3\", \"-m\", \"py_compile\", str(server)], check=True)
print(\"PY_COMPILE_OK\")
subprocess.run([\"git\", \"-C\", str(root), \"add\", \"app/server.py\"], check=True)
subprocess.run([\"git\", \"-C\", str(root), \"commit\", \"-m\", \"restore do_GET handler\"], check=True)
subprocess.run([\"git\", \"-C\", str(root), \"push\"], check=True)
print(\"PUSH_OK\")
'"'"''
