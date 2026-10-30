"""Offline contract/security checks. No HTTP request, account or external write."""

from datetime import datetime, timedelta, timezone
from email.message import Message
from http.client import IncompleteRead
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import URLError
from urllib.request import Request
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import taurino_refresh as feed

NOW = datetime(2026, 10, 30, 12, tzinfo=timezone.utc)
DATE = "Sun, 25 Oct 2026 22:48:04 GMT"
RTVE, MAESTRANZA, ZAFRA = feed.SOURCES


def entry(title, url, date=DATE):
    return (f"<item><title>{escape(title)}</title><link>{escape(url)}</link>"
            f"<pubDate>{escape(date)}</pubDate><description>PRIVATE_DESCRIPTION_MARKER</description>"
            '<enclosure url="https://audio.example.test/DO_NOT_COPY.mp3" type="audio/mpeg"/></item>')


def rss(*entries):
    return ('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>'
            + "".join(entries) + "</channel></rss>").encode()


def standard_fixture(source):
    url = {RTVE.id: "https://www.rtve.es/play/audios/clarin/fixture/123/",
           MAESTRANZA.id: "https://www.realmaestranza.com/fixture/",
           ZAFRA.id: "https://zafra.es/fixture/"}[source.id]
    return rss(entry("Temporada taurina en Perú", url))


class Response(io.BytesIO):
    status = 200

    def __init__(self, data, url=RTVE.url, content_type="application/rss+xml", **headers):
        super().__init__(data)
        self.url = url
        self.headers = Message()
        self.headers["Content-Type"] = content_type
        for name, value in headers.items():
            self.headers[name] = value

    def geturl(self):
        return self.url


class TaurinoRefreshTests(unittest.TestCase):
    def test_podcast_has_editorial_label_topics_and_no_republished_material(self):
        title = "MARCADOR_INEDITO: temporada, ganaderías y Perú; análisis muy extenso"
        item = feed.parse_feed(RTVE, rss(entry(title, "https://www.rtve.es/play/audios/clarin/test/123/?utm_source=x#p")), NOW)[0]
        self.assertEqual(item["label"], "Clarín · 25 octubre")
        self.assertEqual(item["date"], "2026-10-25T22:48:04Z")
        self.assertEqual(item["topics"], ["Perú", "Ganaderías", "Temporada"])
        self.assertEqual(item["url"], "https://www.rtve.es/play/audios/clarin/test/123/")
        self.assertEqual(set(item), {"id", "sourceId", "kind", "date", "url", "label", "topics"})
        encoded = json.dumps(item)
        for forbidden in (title, "MARCADOR_INEDITO", "PRIVATE_DESCRIPTION_MARKER", "DO_NOT_COPY", "enclosure"):
            self.assertNotIn(forbidden, encoded)

    def test_institution_labels_and_zafra_whole_word_filter(self):
        page = "https://www.realmaestranza.com/premio/"
        item = feed.parse_feed(MAESTRANZA, rss(entry("Premio de literatura taurina", page)), NOW)[0]
        self.assertEqual(item["label"], "Literatura taurina · Sevilla")
        entries = [entry(t, f"https://zafra.es/article-{i}/") for i, t in enumerate([
            "Torneo de ajedrez", "Toro Consulting abre una oficina", "Los futuros negocios",
            "Toros360 abre oficina", "Empresa_taurina presenta sus cuentas",
            "Feria taurina de San Miguel", "Corrida de toros", "Jornada sobre tauromaquia"])]
        items = feed.parse_feed(ZAFRA, rss(*entries), NOW)
        self.assertEqual(len(items), 3)
        self.assertTrue(all("Tauromaquia" in i["topics"] for i in items))
        self.assertTrue(all(i["label"] == "Actualidad taurina · Zafra" for i in items))
        self.assertEqual(feed.parse_feed(ZAFRA, rss(entries[0]), NOW), [])

    def test_deduplication_invalid_links_and_inconsistent_future_dates(self):
        valid = "https://www.rtve.es/play/audios/clarin/test/123/"
        candidates = [entry("Temporada", valid), entry("Temporada", valid + "?utm_source=x"),
                      entry("Temporada", valid + "future/", "Thu, 30 Oct 2099 12:00:00 GMT"),
                      entry("Temporada", valid + "missing/", "")]
        unsafe = ["http://www.rtve.es/play/audios/clarin/test/123/",
                  "https://www.rtve.es.evil.test/play/audios/clarin/test/123/",
                  "https://visitor@www.rtve.es/play/audios/clarin/test/123/",
                  "https://www.rtve.es/play/audios/another-show/123/",
                  "https://www.rtve.es/play/audios/clarin/%2e%2e/other/",
                  "https://www.rtve.es:8443/play/audios/clarin/test/123/"]
        candidates.extend(entry("Temporada", url) for url in unsafe)
        items = feed.parse_feed(RTVE, rss(*candidates), NOW)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["url"], valid)
        self.assertEqual(len(items[0]["id"]), 64)
        with self.assertRaisesRegex(feed.FeedError, "NO_VALID_ITEMS"):
            feed.parse_feed(RTVE, rss(candidates[2]), NOW)

    def test_xml_rejects_dtd_entities_encoding_size_and_depth(self):
        attacks = [
            (b'<!DOCTYPE rss [<!ENTITY x "payload">]><rss><channel>&x;</channel></rss>', "DTD_REJECTED"),
            (b'<!DOCTYPE rss SYSTEM "file:///etc/passwd"><rss><channel/></rss>', "DTD_REJECTED"),
            ('<?xml version="1.0" encoding="UTF-16"?><rss><channel/></rss>'.encode("utf-16"), "UNSUPPORTED_XML_ENCODING"),
            (b" " * (feed.MAX_XML_BYTES + 1), "XML_TOO_LARGE"),
            (b"<rss><channel>" + b"<x>" * 40 + b"</x>" * 40 + b"</channel></rss>", "XML_COMPLEXITY_LIMIT"),
            (b"<html><body>not RSS</body></html>", "UNEXPECTED_XML_SCHEMA"),
        ]
        for raw, code in attacks:
            with self.subTest(code=code), self.assertRaisesRegex(feed.FeedError, code):
                feed.parse_feed(RTVE, raw, NOW)

    def test_redirects_are_checked_before_following_and_counted(self):
        req = Request(RTVE.url)
        unsafe = ["http://api.rtve.es/api/programas/1907/audios.rss",
                  "https://evil.test/feed/", "https://127.0.0.1/feed/",
                  "https://api.rtve.es/api/programas/9999/audios.rss",
                  "https://api.rtve.es/api/programas/1907/audios.rss?next=elsewhere"]
        for url in unsafe:
            handler = feed.SafeRedirectHandler(RTVE)
            with self.subTest(url=url), self.assertRaises(feed.FeedError):
                handler.redirect_request(req, None, 302, "Found", {}, url)
            self.assertEqual(handler.redirects, 0)
        handler = feed.SafeRedirectHandler(RTVE)
        target = "https://www.rtve.es/api/programas/1907/audios.rss"
        self.assertEqual(handler.redirect_request(req, None, 302, "Found", {}, target).full_url, target)
        handler.redirect_request(req, None, 302, "Found", {}, target)
        with self.assertRaisesRegex(feed.FeedError, "TOO_MANY_REDIRECTS"):
            handler.redirect_request(req, None, 302, "Found", {}, target)

    def test_http_limits_fixed_get_and_timeouts(self):
        raw = standard_fixture(RTVE)
        with patch.object(feed, "build_opener") as builder:
            builder.return_value.open.return_value = Response(raw)
            self.assertEqual(feed.fetch_feed(RTVE), raw)
            call = builder.return_value.open.call_args
            self.assertEqual(call.args[0].full_url, RTVE.url)
            self.assertEqual(call.args[0].method, "GET")
            self.assertIsNone(call.args[0].data)
            self.assertEqual(call.kwargs["timeout"], feed.SOCKET_TIMEOUT_SECONDS)
        cases = [
            (Response(raw, **{"Content-Length": str(feed.MAX_XML_BYTES + 1)}), "XML_TOO_LARGE"),
            (Response(raw, **{"Content-Encoding": "gzip"}), "COMPRESSED_RESPONSE_REJECTED"),
            (Response(raw, content_type="text/html"), "UNEXPECTED_CONTENT_TYPE"),
            (Response(raw, url="https://evil.test/feed/"), "UNSAFE_URL"),
        ]
        for response, code in cases:
            with self.subTest(code=code), patch.object(feed, "build_opener") as builder:
                builder.return_value.open.return_value = response
                with self.assertRaisesRegex(feed.FeedError, code):
                    feed.fetch_feed(RTVE)
        with patch.object(feed, "build_opener") as builder:
            builder.return_value.open.side_effect = URLError(TimeoutError())
            with self.assertRaisesRegex(feed.FeedError, "TIMEOUT"):
                feed.fetch_feed(RTVE)
        with patch.object(feed, "build_opener") as builder:
            builder.return_value.open.side_effect = IncompleteRead(b"PRIVATE_PROVIDER_FRAGMENT")
            with self.assertRaisesRegex(feed.FeedError, "INVALID_HTTP_RESPONSE"):
                feed.fetch_feed(RTVE)
        with patch.object(feed, "build_opener") as builder, patch.object(feed.time, "monotonic", side_effect=[0, 26]):
            builder.return_value.open.return_value = Response(raw)
            with self.assertRaisesRegex(feed.FeedError, "FETCH_DEADLINE"):
                feed.fetch_feed(RTVE)

    def test_failure_keeps_items_and_last_success_without_redating_publications(self):
        previous = feed.refresh_all(now=NOW, fetcher=standard_fixture)
        def broken(source):
            raise feed.FeedError("HTTP_503")
        current = feed.refresh_all(previous, now=NOW + timedelta(days=1), fetcher=broken)
        self.assertEqual(current["items"], previous["items"])
        self.assertNotEqual(current["generatedAtUtc"], previous["generatedAtUtc"])
        for state in current["sources"]:
            self.assertEqual(state["status"], "stale")
            self.assertEqual(state["lastSuccessAt"], previous["generatedAtUtc"])
            self.assertEqual(state["errorCode"], "HTTP_503")
        first_failure = feed.refresh_all(now=NOW, fetcher=broken)
        self.assertEqual(first_failure["items"], [])
        self.assertTrue(all(s["status"] == "failed" and s["lastSuccessAt"] is None for s in first_failure["sources"]))
        self.assertFalse(current["coverage"]["includesCorridaSummaries"])

    def test_previous_validation_sanitization_and_atomic_write(self):
        previous = feed.refresh_all(now=NOW, fetcher=standard_fixture)
        previous["items"][0]["description"] = "DO_NOT_REPUBLISH"
        previous["items"][0]["label"] = "UNCONTROLLED_PREVIOUS_LABEL"
        previous["items"].append({"sourceId": "visitor-input", "url": "http://localhost/secret"})
        def broken(source):
            raise feed.FeedError("TIMEOUT")
        sanitized = feed.refresh_all(previous, now=NOW, fetcher=broken)
        self.assertNotIn("DO_NOT_REPUBLISH", json.dumps(sanitized))
        self.assertNotIn("UNCONTROLLED_PREVIOUS_LABEL", json.dumps(sanitized))
        self.assertEqual(len(sanitized["items"]), 3)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "taurino-feed.json"
            feed.write_snapshot(path, sanitized)
            self.assertEqual(feed.load_previous(path), sanitized)
            old_bytes = path.read_bytes()
            with patch.object(feed.os, "replace", side_effect=OSError("simulated write failure")):
                with self.assertRaises(OSError):
                    feed.write_snapshot(path, {"replacement": True})
            self.assertEqual(path.read_bytes(), old_bytes)
            self.assertEqual(list(Path(directory).iterdir()), [path])
            path.write_text("{invalid", encoding="utf-8")
            with self.assertRaisesRegex(feed.FeedError, "PREVIOUS_INVALID"):
                feed.load_previous(path)


if __name__ == "__main__":
    unittest.main()
