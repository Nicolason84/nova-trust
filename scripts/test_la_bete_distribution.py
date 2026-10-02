#!/usr/bin/env python3
import json,re,struct,os,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/"docs/france-debt-rate-risk-live-2026-10-02.html").read_text()
feed=json.loads((ROOT/"docs/data/france-debt-rate-live.json").read_text())
manifest=json.loads((ROOT/"docs/manifest.webmanifest").read_text())
def must(x,msg):
    if not x: raise SystemExit(msg)
for token in ['property="og:title"','property="og:description"','property="og:image"','name="twitter:card"','rel="manifest"','id="reality-pulse"','id="sourceAlert"','id="sourceAlertList"','function renderRealityPulse(j)','renderDecisionTwin(j)','const FEED=']:
    must(token in html,f"missing {token}")
for token in ['property="og:title"','property="og:image"','name="twitter:card"','rel="manifest"']:
    must(html.count(token)==1,f"duplicate {token}")
must('https://nicolason84.github.io/nova-trust/assets/la-bete-social-card.png?v=' in html,"absolute cache-busted OG image missing")
must('scroll-snap-type:x mandatory' in html and '.rpAdapt .signalSculpture{display:none}' in html,"mobile first-screen optimization missing")
must(manifest.get("display")=="standalone","manifest display")
must(manifest.get("start_url","").endswith("france-debt-rate-risk-live-2026-10-02.html"),"manifest start_url")
for rel,w,h in [("docs/assets/la-bete-social-card.png",1200,630),("docs/assets/la-bete-icon-192.png",192,192),("docs/assets/la-bete-icon-512.png",512,512),("docs/assets/la-bete-apple-touch-icon.png",180,180)]:
    p=ROOT/rel; must(p.exists(),f"missing {rel}"); b=p.read_bytes()[:24]
    must(b[:8]==b'\x89PNG\r\n\x1a\n',f"bad PNG {rel}"); W,H=struct.unpack(">II",b[16:24]); must((W,H)==(w,h),f"bad dimensions {rel}: {(W,H)}")
must((ROOT/"docs/assets/la-bete-favicon.svg").read_text().lstrip().startswith("<svg"),"favicon SVG invalid")
bad={"DEGRADED","UNAVAILABLE","CONTRADICTED"}; bad_sources=[s for s in feed.get("sources",[]) if s.get("health") in bad]
must("RETAINED_LAST_GOOD" in {s.get("health") for s in feed.get("sources",[])} or not bad_sources,"degraded fallback disclosure missing")
must('data/france-debt-rate-live.json' in html,"canonical feed binding changed")
caps=feed.get("capabilities",{}); must(all(caps.get(x) is True for x in ("decision_delta","refinancing_twin","evidence_graph","claim_confidence")),"Decision Twin capability regression")
must(feed.get("policy",{}).get("political_recommendation")=="NONE","neutrality policy changed")
base=os.environ.get("LA_BETE_TEST_BASE_URL","").rstrip("/")
if base:
    ua={"User-Agent":"LinkedInBot/1.0 (+https://www.linkedin.com/)"}
    page=urllib.request.urlopen(urllib.request.Request(base+"/france-debt-rate-risk-live-2026-10-02.html",headers=ua),timeout=10)
    served=page.read().decode("utf-8","replace")
    must(page.status==200 and 'property="og:image"' in served and 'property="og:title"' in served,"LinkedInBot page fetch failed")
    image_url=re.search(r'<meta property="og:image" content="([^"]+)"',served)
    must(image_url is not None,"LinkedInBot OG image missing")
    img=urllib.request.urlopen(urllib.request.Request(base+"/assets/la-bete-social-card.png",headers=ua),timeout=10)
    must(img.status==200 and (img.headers.get_content_type()=="image/png"),"LinkedInBot social card fetch failed")
print(f"LA_BETE_PUBLIC_DISTRIBUTION_PASS bad_sources={len(bad_sources)} snapshot={feed.get('snapshot_id')} linkedinbot={'PASS' if base else 'STATIC'}")
