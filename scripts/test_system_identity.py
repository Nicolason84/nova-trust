"""Runtime and projection checks for La Bête's canonical artistic identity."""
from pathlib import Path
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import threading
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
class SystemIdentityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = ROOT / "app" / "server.py"
        spec = importlib.util.spec_from_file_location("supra_identity_server", source)
        cls.server_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.server_module)
        os.chdir(ROOT)
        cls.http = cls.server_module.HTTPServer(("127.0.0.1", 0), cls.server_module.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:%d" % cls.http.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=3) as response:
            return response.status, response.headers.get_content_type(), response.read()

    def test_api_serves_the_single_canonical_identity(self):
        canonical = json.loads((ROOT / "app/system_identity.json").read_text())
        status, content_type, body = self.get("/api/system/identity")
        self.assertEqual((status, content_type), (200, "application/json"))
        self.assertEqual(json.loads(body), canonical)
        self.assertFalse(canonical["music"]["bundled_audio"])
        self.assertEqual(canonical["music"]["playback"], "click_to_load")

    def test_static_projection_matches_source_and_manifest(self):
        source = json.loads((ROOT / "app/system_identity.json").read_text())
        projected = json.loads((ROOT / "docs/system_identity.json").read_text())
        manifest = json.loads((ROOT / "docs/manifest.webmanifest").read_text())
        self.assertEqual(source, projected)
        self.assertEqual(source["artistic_identity"]["name"], "Réparer le chaos")
        self.assertEqual(source["artistic_identity"]["image_asset"], "assets/supra-noir-humanoid-butterfly.webp")
        self.assertTrue((ROOT / "docs" / source["artistic_identity"]["image_asset"]).is_file())
        self.assertTrue(any(x["src"].endswith(source["artistic_identity"]["icon_asset"]) for x in manifest["icons"]))
        page = (ROOT / "docs/france-debt-rate-risk-live-2026-10-02.html").read_text()
        self.assertIn('data-identity-url="system_identity.json"', page)
        self.assertIn('data-track-play', page)
        self.assertIn('data-identity-art', page)
        self.assertIn('assets/supra-noir-humanoid-butterfly.webp', page)
        result = subprocess.run(
            ["python3", str(ROOT / "scripts/sync_system_identity.py"), "--check"],
            cwd=ROOT, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_application_routes_share_the_same_art_and_music_hooks(self):
        for path in ("/", "/trust"):
            status, _, body = self.get(path)
            self.assertEqual(status, 200)
            html = body.decode("utf-8")
            self.assertIn("data-identity-url", html)
            self.assertIn("data-identity-art", html)
            self.assertIn("data-track-play", html)
        for path, expected_type in (
            ("/assets/supra-human-butterfly.svg", "image/svg+xml"),
            ("/assets/supra-noir-humanoid-butterfly.webp", "image/webp"),
            ("/assets/system-identity.css", "text/css"),
            ("/assets/system-identity.js", "application/javascript"),
        ):
            status, actual_type, body = self.get(path)
            self.assertEqual((status, actual_type), (200, expected_type))
            self.assertGreater(len(body), 40, (path, repr(body)))
            if path.endswith(".webp"):
                self.assertEqual(body[:4], b"RIFF")
                self.assertEqual(body[8:12], b"WEBP")

    @unittest.skipUnless(shutil.which("node"), "Node.js is not installed")
    def test_shared_player_and_trust_scripts_parse(self):
        script = ROOT / "docs/assets/system-identity.js"
        result = subprocess.run([shutil.which("node"), "--check", str(script)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        html = (ROOT / "app/trust.html").read_text()
        inline = html.split("<script>", 1)[1].split("</script>", 1)[0]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
            f.write(inline)
            temp = f.name
        try:
            result = subprocess.run([shutil.which("node"), "--check", temp], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        finally:
            Path(temp).unlink(missing_ok=True)

if __name__ == "__main__":
    unittest.main()
