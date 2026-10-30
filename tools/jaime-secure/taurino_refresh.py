#!/usr/bin/env python3
"""Refresh public taurino links from three fixed official RSS feeds.

No headline, description, audio URL, cookie, credential or visitor input is
republished. Python 3.11+; standard library only. See TAURINO_REFRESH.md.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
from http.client import HTTPException
import json
import os
from pathlib import Path
import re
import socket
import ssl
import sys
import tempfile
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo


UTC = timezone.utc
MADRID = ZoneInfo("Europe/Madrid")
MAX_XML_BYTES = 2 * 1024 * 1024
MAX_PREVIOUS_BYTES = 256 * 1024
MAX_XML_NODES = 20_000
MAX_XML_DEPTH = 32
MAX_FEED_ITEMS = 100
MAX_ITEMS_PER_SOURCE = 20
SOCKET_TIMEOUT_SECONDS = 10
FETCH_DEADLINE_SECONDS = 25
MAX_REDIRECTS = 2
FUTURE_TOLERANCE = timedelta(minutes=5)
MONTHS_ES = ("enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    url: str
    kind: str
    feed_hosts: frozenset[str]
    item_hosts: frozenset[str]
    item_prefix: str = "/"


SOURCES = (
    Source("rtve-clarin", "Clarín · RTVE", "https://api.rtve.es/api/programas/1907/audios.rss",
           "podcast", frozenset({"api.rtve.es", "www.rtve.es"}),
           frozenset({"www.rtve.es", "rtve.es"}), "/play/audios/clarin/"),
    Source("real-maestranza", "Real Maestranza de Sevilla", "https://www.realmaestranza.com/feed/",
           "institutional", frozenset({"www.realmaestranza.com", "realmaestranza.com"}),
           frozenset({"www.realmaestranza.com", "realmaestranza.com"})),
    Source("zafra", "Ayuntamiento de Zafra", "https://zafra.es/feed/",
           "institutional", frozenset({"zafra.es", "www.zafra.es"}),
           frozenset({"zafra.es", "www.zafra.es"})),
)
SOURCE_BY_ID = {source.id: source for source in SOURCES}
TAURINO_WORDS = frozenset({"taurino", "taurina", "taurinos", "taurinas",
                           "tauromaquia", "toros", "corrida", "corridas"})
TOPIC_WORDS = (
    ("Perú", {"peru", "acho"}),
    ("México", {"mexico"}),
    ("Ecuador", {"ecuador", "latacunga", "quito"}),
    ("Francia", {"francia", "arles", "nimes"}),
    ("Madrid", {"madrid"}),
    ("Sevilla", {"sevilla", "maestranza"}),
    ("Extremadura", {"extremadura", "zafra", "caceres", "badajoz", "olivenza", "merida"}),
    ("Ganaderías", {"ganaderia", "ganaderias", "ganadero", "ganaderos", "encaste", "encastes",
                    "victorino", "victorinos", "jandilla", "miura", "garcigrande"}),
    ("Temporada", {"temporada", "temporadas", "escalafon", "escalafones"}),
    ("Ferias", {"feria", "ferias"}),
    ("Indultos", {"indulto", "indultos", "indulta", "indultan", "indultado", "indultados"}),
    ("Escuelas", {"escuela", "escuelas", "novillero", "novilleros", "novillada", "novilladas"}),
    ("Entrevistas", {"entrevista", "entrevistas"}),
    ("Debate", {"tertulia", "tertulias", "debate"}),
    ("Literatura", {"literatura", "literario", "literaria", "libro", "libros", "novela"}),
    ("Patrimonio", {"patrimonio", "chiqueros", "museo", "archivo", "exposicion", "expositivas"}),
    ("Cultura", {"cultura", "cultural", "conferencia", "conferencias", "arte", "artes", "pintura"}),
    ("Tauromaquia", TAURINO_WORDS),
)
ALLOWED_TOPICS = frozenset(name for name, _ in TOPIC_WORDS) | {"Actualidad taurina"}


class FeedError(Exception):
    """Only a fixed, non-sensitive code is exposed to the output or logs."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def iso_utc(value: datetime) -> str:
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_date(value: str, now: datetime) -> datetime:
    if not isinstance(value, str) or not value or len(value) > 100:
        raise FeedError("INVALID_DATE")
    try:
        parsed = (datetime.fromisoformat(value.replace("Z", "+00:00"))
                  if re.match(r"^\d{4}-\d\d-\d\dT", value)
                  else parsedate_to_datetime(value))
        if parsed.tzinfo is None:
            raise ValueError("timezone required")
        parsed = parsed.astimezone(UTC)
    except (ValueError, TypeError, OverflowError):
        raise FeedError("INVALID_DATE") from None
    if parsed > now + FUTURE_TOLERANCE:
        raise FeedError("FUTURE_DATE")
    return parsed


def checked_url(value: str, allowed_hosts: frozenset[str]) -> str:
    if not isinstance(value, str) or len(value) > 2048 or not value:
        raise FeedError("UNSAFE_URL")
    if any(ord(c) < 33 or ord(c) == 127 for c in value) or "\\" in value:
        raise FeedError("UNSAFE_URL")
    try:
        parts = urlsplit(value)
        if (parts.scheme != "https" or parts.hostname not in allowed_hosts
                or parts.username is not None or parts.password is not None
                or parts.port not in (None, 443)):
            raise ValueError("URL outside allowlist")
        decoded_path = unquote(parts.path)
        if (any(ord(c) < 32 or ord(c) == 127 for c in decoded_path)
                or "\\" in decoded_path or any(p in {".", ".."} for p in decoded_path.split("/"))):
            raise ValueError("ambiguous path")
    except (ValueError, UnicodeError):
        raise FeedError("UNSAFE_URL") from None
    return urlunsplit(("https", parts.hostname, parts.path or "/", parts.query, ""))


def checked_feed_url(source: Source, value: str) -> str:
    clean = checked_url(value, source.feed_hosts)
    parts = urlsplit(clean)
    if parts.path != urlsplit(source.url).path or parts.query:
        raise FeedError("UNSAFE_REDIRECT")
    return clean


def checked_item_url(source: Source, value: str) -> str:
    clean = checked_url(value, source.item_hosts)
    parts = urlsplit(clean)
    if not parts.path.startswith(source.item_prefix) or parts.path == source.item_prefix:
        raise FeedError("UNSAFE_ITEM_URL")
    # Remove tracking queries/fragments; only the official article/programme page is linked.
    host = {"rtve.es": "www.rtve.es", "realmaestranza.com": "www.realmaestranza.com",
            "www.zafra.es": "zafra.es"}.get(parts.hostname, parts.hostname)
    return urlunsplit(("https", host, parts.path, "", ""))


class SafeRedirectHandler(HTTPRedirectHandler):
    max_redirections = MAX_REDIRECTS
    max_repeats = 1

    def __init__(self, source: Source):
        super().__init__()
        self.source = source
        self.redirects = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if self.redirects >= MAX_REDIRECTS:
            raise FeedError("TOO_MANY_REDIRECTS")
        target = checked_feed_url(self.source, urljoin(req.full_url, newurl))
        self.redirects += 1
        return super().redirect_request(req, fp, code, msg, headers, target)


def fetch_feed(source: Source) -> bytes:
    """Only fixed source objects are accepted; no caller-provided URL is fetched."""
    if SOURCE_BY_ID.get(source.id) != source:
        raise FeedError("UNKNOWN_SOURCE")
    url = checked_feed_url(source, source.url)
    # Keep urllib's managed-environment proxy settings. Destination and redirect
    # allowlists plus normal HTTPS certificate checks still apply.
    opener = build_opener(SafeRedirectHandler(source))
    request = Request(url, method="GET", headers={
        "User-Agent": "ojo-jaime-public-taurino-feed/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml",
        "Accept-Encoding": "identity",
    })
    deadline = time.monotonic() + FETCH_DEADLINE_SECONDS
    try:
        with opener.open(request, timeout=SOCKET_TIMEOUT_SECONDS) as response:
            checked_feed_url(source, response.geturl())
            if response.status != 200:
                raise FeedError(f"HTTP_{response.status}")
            if response.headers.get("Content-Encoding", "identity").lower() not in ("", "identity"):
                raise FeedError("COMPRESSED_RESPONSE_REJECTED")
            mime = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if mime not in {"application/rss+xml", "application/xml", "text/xml"}:
                raise FeedError("UNEXPECTED_CONTENT_TYPE")
            size = response.headers.get("Content-Length", "")
            if size.isdigit() and int(size) > MAX_XML_BYTES:
                raise FeedError("XML_TOO_LARGE")
            body = bytearray()
            while True:
                if time.monotonic() > deadline:
                    raise FeedError("FETCH_DEADLINE")
                # read1 returns after one underlying read, so a slow trickle cannot
                # postpone the deadline check until the complete document arrives.
                chunk = response.read1(min(65536, MAX_XML_BYTES + 1 - len(body)))
                if not chunk:
                    break
                body.extend(chunk)
                if len(body) > MAX_XML_BYTES:
                    raise FeedError("XML_TOO_LARGE")
            if time.monotonic() > deadline:
                raise FeedError("FETCH_DEADLINE")
            return bytes(body)
    except HTTPError as exc:
        code = exc.code
        exc.close()
        raise FeedError(f"HTTP_{code}") from None
    except (TimeoutError, socket.timeout):
        raise FeedError("TIMEOUT") from None
    except ssl.SSLError:
        raise FeedError("TLS_ERROR") from None
    except URLError as exc:
        code = "TIMEOUT" if isinstance(exc.reason, (TimeoutError, socket.timeout)) else "NETWORK_ERROR"
        raise FeedError(code) from None
    except HTTPException:
        raise FeedError("INVALID_HTTP_RESPONSE") from None
    except OSError:
        raise FeedError("NETWORK_ERROR") from None


class BoundedTreeBuilder(ET.TreeBuilder):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.nodes = 0

    def start(self, tag, attrs):
        self.depth += 1
        self.nodes += 1
        if self.depth > MAX_XML_DEPTH or self.nodes > MAX_XML_NODES:
            raise FeedError("XML_COMPLEXITY_LIMIT")
        return super().start(tag, attrs)

    def end(self, tag):
        result = super().end(tag)
        self.depth -= 1
        return result

    def doctype(self, name, pubid, system):
        raise FeedError("DTD_REJECTED")


def title_words(title: str) -> set[str]:
    plain = "".join(c for c in unicodedata.normalize("NFKD", title.casefold())
                    if not unicodedata.combining(c))
    return set(re.findall(r"\b[a-z]+\b", plain))


def topics_for(words: set[str], source: Source) -> list[str]:
    topics = [name for name, vocabulary in TOPIC_WORDS if words.intersection(vocabulary)]
    if source.kind == "podcast" and not topics:
        topics = ["Actualidad taurina"]
    return topics


def editorial_label(source: Source, date: datetime, topics: list[str]) -> str:
    local = date.astimezone(MADRID)
    day = f"{local.day} {MONTHS_ES[local.month - 1]}"
    if source.kind == "podcast":
        return f"Clarín · {day}"
    if source.id == "zafra":
        return "Actualidad taurina · Zafra"
    if "Literatura" in topics:
        return "Literatura taurina · Sevilla" if "Tauromaquia" in topics else "Literatura · Sevilla"
    if "Patrimonio" in topics:
        return "Patrimonio · Sevilla"
    if "Cultura" in topics:
        return "Cultura · Sevilla"
    return f"Real Maestranza · {day}"


def make_item(source: Source, date: datetime, url: str, topics: list[str]) -> dict:
    return {"id": hashlib.sha256((source.id + "\0" + url).encode()).hexdigest(),
            "sourceId": source.id, "kind": source.kind, "date": iso_utc(date),
            "url": url, "label": editorial_label(source, date, topics), "topics": topics}


def parse_feed(source: Source, raw: bytes, now: datetime) -> list[dict]:
    if len(raw) > MAX_XML_BYTES:
        raise FeedError("XML_TOO_LARGE")
    try:
        text = raw.decode("utf-8-sig", errors="strict")
    except UnicodeError:
        raise FeedError("UNSUPPORTED_XML_ENCODING") from None
    if "\0" in text:
        raise FeedError("UNSUPPORTED_XML_ENCODING")
    declaration = re.match(r"\s*<\?xml\b[^?]*\?>", text, re.I)
    encoding = re.search(r"encoding\s*=\s*['\"]([^'\"]+)['\"]", declaration[0], re.I) if declaration else None
    if encoding and encoding[1].casefold() not in {"utf-8", "utf8", "us-ascii"}:
        raise FeedError("UNSUPPORTED_XML_ENCODING")
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)\b", text, re.I):
        raise FeedError("DTD_REJECTED")
    try:
        root = ET.fromstring(text, parser=ET.XMLParser(target=BoundedTreeBuilder()))
    except ET.ParseError:
        raise FeedError("INVALID_XML") from None
    channels = root.findall("channel")
    if root.tag != "rss" or len(channels) != 1:
        raise FeedError("UNEXPECTED_XML_SCHEMA")
    entries = channels[0].findall("item")
    if len(entries) > MAX_FEED_ITEMS:
        raise FeedError("TOO_MANY_FEED_ITEMS")
    by_url = {}
    valid_metadata = 0
    for entry in entries:
        # Only these three fields are read. Descriptions and enclosures are discarded.
        title = entry.findtext("title", default="").strip()
        if not title or len(title) > 2048:
            continue
        try:
            date = parse_date(entry.findtext("pubDate", default="").strip(), now)
            url = checked_item_url(source, entry.findtext("link", default="").strip())
        except FeedError:
            continue
        valid_metadata += 1
        words = title_words(title)
        if source.id == "zafra" and not words.intersection(TAURINO_WORDS):
            continue
        item = make_item(source, date, url, topics_for(words, source))
        if url not in by_url or item["date"] > by_url[url]["date"]:
            by_url[url] = item
    if entries and not valid_metadata:
        raise FeedError("NO_VALID_ITEMS")
    return sorted(by_url.values(), key=lambda item: (item["date"], item["id"]), reverse=True)[:MAX_ITEMS_PER_SOURCE]


def load_previous(path: Path) -> dict:
    if not path.exists():
        return {}
    if path.is_symlink() or path.stat().st_size > MAX_PREVIOUS_BYTES:
        raise FeedError("PREVIOUS_INVALID")
    try:
        previous = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise FeedError("PREVIOUS_INVALID") from None
    if (not isinstance(previous, dict) or previous.get("schemaVersion") != 1
            or not isinstance(previous.get("items"), list)
            or not isinstance(previous.get("sources"), list)):
        raise FeedError("PREVIOUS_INVALID")
    return previous


def previous_items(previous: dict, source: Source, now: datetime) -> list[dict]:
    kept = {}
    for item in previous.get("items", []):
        if not isinstance(item, dict) or item.get("sourceId") != source.id:
            continue
        try:
            date = parse_date(item.get("date", ""), now)
            url = checked_item_url(source, item.get("url", ""))
        except FeedError:
            continue
        raw_topics = item.get("topics", [])
        if not isinstance(raw_topics, list):
            continue
        topics = list(dict.fromkeys(t for t in raw_topics if isinstance(t, str) and t in ALLOWED_TOPICS))
        if source.id == "zafra" and "Tauromaquia" not in topics:
            continue
        clean = make_item(source, date, url, topics)
        if url not in kept or clean["date"] > kept[url]["date"]:
            kept[url] = clean
    return sorted(kept.values(), key=lambda item: (item["date"], item["id"]), reverse=True)[:MAX_ITEMS_PER_SOURCE]


def refresh_all(previous: dict | None = None, *, now: datetime | None = None, fetcher=fetch_feed) -> dict:
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise FeedError("CLOCK_REQUIRES_TIMEZONE")
    now = now.astimezone(UTC)
    previous = previous or {}
    old_sources = {s["id"]: s for s in previous.get("sources", [])
                   if isinstance(s, dict) and s.get("id") in SOURCE_BY_ID}
    states, items = [], []
    for source in SOURCES:
        old_items = previous_items(previous, source, now)
        last_success = old_sources.get(source.id, {}).get("lastSuccessAt")
        try:
            last_success = iso_utc(parse_date(last_success, now)) if last_success else None
        except FeedError:
            last_success = None
        try:
            current = parse_feed(source, fetcher(source), now)
            state, error, last_success = "ok", None, iso_utc(now)
        except FeedError as exc:
            current, error = old_items, exc.code
            state = "stale" if current else "failed"
        states.append({"id": source.id, "name": source.name, "url": source.url,
                       "status": state, "lastSuccessAt": last_success, "errorCode": error})
        items.extend(current)
    return {"schemaVersion": 1, "generatedAtUtc": iso_utc(now),
            "coverage": {"type": "source_links", "isLive": False, "includesCorridaSummaries": False,
                         "noteEs": "Enlaces a novedades oficiales. No son resúmenes de corridas. La fecha de cada publicación se conserva; un flujo inaccesible mantiene sus enlaces anteriores y figura como desactualizado."},
            "sources": states,
            "items": sorted(items, key=lambda item: (item["date"], item["id"]), reverse=True)}


def write_snapshot(path: Path, data: dict) -> None:
    if path.is_symlink():
        raise FeedError("OUTPUT_SYMLINK_REJECTED")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".taurino-feed-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="Local public JSON snapshot path; never a URL")
    args = parser.parse_args(argv)
    try:
        previous = load_previous(args.output)
        result = refresh_all(previous)
        write_snapshot(args.output, result)
    except FeedError as exc:
        print(json.dumps({"status": "failed", "errorCode": exc.code}), file=sys.stderr)
        return 2
    except OSError:
        print(json.dumps({"status": "failed", "errorCode": "OUTPUT_IO_ERROR"}), file=sys.stderr)
        return 2
    print(json.dumps({"status": "written", "itemCount": len(result["items"]),
                      "sources": [{k: s[k] for k in ("id", "status", "errorCode")} for s in result["sources"]]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
