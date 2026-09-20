#!/usr/bin/env python3
from __future__ import annotations
import hashlib, html, json, re, urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT=Path("docs/data/budget-2027-live.json")
UA="OJO-Budget-Evidence-Monitor/1.0 (+https://github.com/Nicolason84/nova-trust)"
MAX=2000000
SOURCES=[
 {"id":"BDF_SEPT_2026","label":"Banque de France — projections septembre 2026","publisher":"Banque de France","organ":"MACRO","claims":["F10","F11"],"url":"https://www.banque-france.fr/fr/actualites/projections-macroeconomiques-intermediaires-septembre-2026","mode":"html","watch":["0,9 %","1,9 %","19 août 2026"]},
 {"id":"INSEE_APU","label":"Comptes des administrations publiques","publisher":"Insee / data.gouv.fr","organ":"ACCOUNTS","claims":["F8","F9"],"url":"https://www.data.gouv.fr/api/1/datasets/comptes-des-administrations-publiques/","mode":"json","watch":[]},
 {"id":"INSEE_BDM_RSS","label":"Flux mises à jour BDM","publisher":"Insee","organ":"MACRO","claims":["F8","F9","F10","F11"],"url":"https://bdm.insee.fr/series/sdmx/rss/donnees","mode":"rss","watch":[]},
 {"id":"BUDGET_CALENDAR","label":"Calendrier budgétaire","publisher":"Direction du Budget","organ":"EXECUTION","claims":["F8"],"url":"https://www.budget.gouv.fr/calendrier-budgetaire","mode":"html","watch":["Situation mensuelle","solde général"]},
 {"id":"BUDGET_FINANCES","label":"Finances publiques","publisher":"Direction du Budget","organ":"BUDGET","claims":["F8","F9"],"url":"https://www.budget.gouv.fr/reperes/finances_publiques","mode":"html","watch":["2027","déficit","dette"]},
 {"id":"IGF_REVUES","label":"Revues de dépenses","publisher":"Inspection générale des finances","organ":"MEASURES","claims":[],"url":"https://www.igf.gouv.fr/toutes-les-actualites/publication-de-5-revues-de-depenses","mode":"html","watch":["151","10"]},
 {"id":"EU_EDP","label":"Procédure de déficit excessif","publisher":"Conseil de l’Union européenne","organ":"RULES","claims":["F12"],"url":"https://www.consilium.europa.eu/fr/policies/excessive-deficit-procedure/","mode":"html","watch":["France","2029","1,2"]},
 {"id":"LEGIFRANCE_ART39","label":"LOLF article 39","publisher":"Légifrance","organ":"RULES","claims":[],"url":"https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044611960","mode":"html","watch":["premier mardi"]},
 {"id":"PUBLIC_SENAT_54","label":"Cadrage public des 54 Md€","publisher":"Public Sénat","organ":"ANNOUNCEMENTS","claims":["F1","F2","F3","F4","F5"],"url":"https://www.publicsenat.fr/actualites/politique/budget-2027-sebastien-lecornu-propose-un-effort-de-54-milliards-deuros","mode":"html","watch":["54 milliards","6,5","4,8","6,4"]}
]

def now():
 return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def norm_html(s):
 s=re.sub(r"(?is)<(script|style|svg|noscript)[^>]*>.*?</\\1>"," ",s)
 s=re.sub(r"(?is)<!--.*?-->"," ",s)
 s=re.sub(r"(?s)<[^>]+>"," ",s)
 return re.sub(r"\\s+"," ",html.unescape(s)).strip()

def norm_rss(s):
 items=re.findall(r"(?is)<item\\b.*?</item>",s)[:30]
 if not items:return norm_html(s)
 out=[]
 for item in items:
  vals=[]
  for tag in ("title","pubDate","link","guid"):
   m=re.search(rf"(?is)<{tag}[^>]*>(.*?)</{tag}>",item)
   vals.append(norm_html(m.group(1)) if m else "")
  out.append(" | ".join(vals))
 return "\n".join(out)

def norm_json(s):
 try:return json.dumps(json.loads(s),ensure_ascii=False,sort_keys=True,separators=(",",":"))
 except:return re.sub(r"\\s+"," ",s).strip()

def observe(text,watch):
 lo=text.lower();out=[]
 for n in watch:
  i=lo.find(n.lower())
  if i>=0:out.append({"needle":n,"snippet":text[max(0,i-80):min(len(text),i+len(n)+150)][:420]})
 return out[:6]

def fetch(spec):
 checked=now()
 try:
  req=urllib.request.Request(spec["url"],headers={"User-Agent":UA,"Accept":"application/json,text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8"})
  with urllib.request.urlopen(req,timeout=25) as r:
   data=r.read(MAX);ctype=r.headers.get("content-type","")
   headers={"etag":r.headers.get("etag"),"last_modified":r.headers.get("last-modified")}
   status=getattr(r,"status",200)
  raw=data.decode("utf-8","replace")
  mode=spec["mode"]
  txt=norm_json(raw) if mode=="json" else norm_rss(raw) if mode=="rss" else norm_html(raw)
  return {**{k:spec[k] for k in ("id","label","publisher","organ","claims","url")},"health":"OK","http_status":status,"etag":headers["etag"],"last_modified":headers["last_modified"],"digest":hashlib.sha256(txt.encode()).hexdigest(),"checked_at":checked,"candidate_observations":observe(txt,spec["watch"]),"error":None}
 except Exception as e:
  return {**{k:spec[k] for k in ("id","label","publisher","organ","claims","url")},"health":"ERROR","http_status":getattr(e,"code",None),"etag":None,"last_modified":None,"digest":None,"checked_at":checked,"candidate_observations":[],"error":f"{type(e).__name__}: {e}"[:400]}

try: prev=json.loads(OUT.read_text())
except: prev={}
old={x.get("id"):x for x in prev.get("sources",[]) if isinstance(x,dict)}
cur=[fetch(x) for x in SOURCES]
changes=[]
for s in cur:
 p=old.get(s["id"])
 if not p or p.get("health")=="BOOTSTRAP_PENDING":
  changes.append({"source_id":s["id"],"kind":"SOURCE_BASELINED","organ":s["organ"],"claims":s["claims"],"at":s["checked_at"],"detail":"First live fingerprint captured."})
 elif p.get("health")!=s["health"]:
  changes.append({"source_id":s["id"],"kind":"SOURCE_HEALTH_CHANGED","organ":s["organ"],"claims":s["claims"],"at":s["checked_at"],"detail":f"{p.get('health')} → {s['health']}"})
 elif s["health"]=="OK" and p.get("digest")!=s.get("digest"):
  changes.append({"source_id":s["id"],"kind":"SOURCE_CHANGED","organ":s["organ"],"claims":s["claims"],"at":s["checked_at"],"detail":"Public source fingerprint changed; canonical claims require reconciliation before mutation."})
if not changes and prev:
 print("NO_MATERIAL_CHANGE")
 raise SystemExit(0)
events=(prev.get("events",[])+changes)[-80:]
manifest={"schema":"OJO_BUDGET_2027_LIVE_FEED_V1","version":"2026-09-21","sequence":int(prev.get("sequence",0))+1,"updated_at":now(),"policy":{"canonical_mutation":"NEVER_FROM_FINGERPRINT_ALONE","source_change":"EMIT_DELTA_THEN_RECONCILE","political_recommendation":"NONE"},"sources":cur,"material_changes":changes,"events":events,"summary":{"monitored":len(cur),"healthy":sum(x["health"]=="OK" for x in cur),"errors":sum(x["health"]!="OK" for x in cur),"changed_this_sequence":len(changes)}}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"status":"WROTE","sequence":manifest["sequence"],"changes":len(changes)}))
