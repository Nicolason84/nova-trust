#!/usr/bin/env python3
from __future__ import annotations
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UA = "LaBeteContributionVerifier/1.0 (+https://github.com/Nicolason84/nova-trust)"
REPO = "Nicolason84/nova-trust"

def get(url: str) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status, r.geturl(), r.read(600000)

def contribution_url(dep: str, quest: str) -> str:
    title = f"[TERRITOIRE {dep}][QUEST {quest}] "
    return "https://github.com/" + REPO + "/issues/new?" + urllib.parse.urlencode({
        "template": "territory-contribution.yml",
        "labels": "territoire",
        "title": title,
    })

template = (ROOT / ".github/ISSUE_TEMPLATE/territory-contribution.yml").read_text()
for required in ("name: Enrichir un territoire", "id: department", "id: quest", "id: contribution", "id: source", "territoire"):
    if required not in template:
        raise SystemExit("CONTRIBUTION_TEMPLATE_MISSING:" + required)

status, _, raw = get("https://api.github.com/repos/" + REPO)
repo = json.loads(raw)
if status != 200 or not repo.get("has_issues"):
    raise SystemExit("GITHUB_ISSUES_DISABLED")

status, _, raw = get("https://api.github.com/repos/" + REPO + "/labels/territoire")
label = json.loads(raw)
if status != 200 or label.get("name") != "territoire":
    raise SystemExit("TERRITORY_LABEL_MISSING")

raw_url = "https://raw.githubusercontent.com/" + REPO + "/main/.github/ISSUE_TEMPLATE/territory-contribution.yml"
status, _, raw = get(raw_url)
if status != 200 or b"id: department" not in raw or b"id: quest" not in raw:
    raise SystemExit("REMOTE_CONTRIBUTION_TEMPLATE_BROKEN")

for dep, quest in (("60","local_expressions"),("13","heritage_memory"),("80","nature_risks")):
    expected = contribution_url(dep, quest)
    status, final, _ = get(expected)
    if status != 200:
        raise SystemExit("CONTRIBUTION_LINK_HTTP:" + str(status))
    host = urllib.parse.urlparse(final).hostname
    if host != "github.com":
        raise SystemExit("CONTRIBUTION_LINK_HOST")
    if "/login" in final:
        return_to = urllib.parse.parse_qs(urllib.parse.urlparse(final).query).get("return_to", [""])[0]
        if "/Nicolason84/nova-trust/issues/new" not in urllib.parse.unquote(return_to):
            raise SystemExit("CONTRIBUTION_LOGIN_RETURN_BROKEN")
    elif "/Nicolason84/nova-trust/issues/new" not in final:
        raise SystemExit("CONTRIBUTION_FORM_ROUTE_BROKEN")
    print("PASS_LINK", dep, quest, final)

print("TERRITORY_CONTRIBUTION_LINKS_PASS")
