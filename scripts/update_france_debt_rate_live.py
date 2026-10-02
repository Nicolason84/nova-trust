#!/usr/bin/env python3
from __future__ import annotations
import hashlib, html, json, re, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT=Path("docs/data/france-debt-rate-live.json")
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36 OJO-France-Debt-Rate-Live/1.1"
BDF_PREFIX="https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-"

# Official AFT vintages. These are deliberately versioned anchors, not pseudo-live values.
AFT_DEBT={
 "debt_negotiable_eur":2896181146497,
 "debt_date":"2026-09-30",
 "debt_avg_life_years":8,
 "debt_avg_life_days":158,
 "debt_avg_life_date":"2026-09-30",
 "weighted_oat_issuance_pct":3.55,
 "weighted_oat_date":"2026-09-30"
}
AFT_2027={
 "financing_need_2027_bne":339.7,
 "issuance_mlt_2027_bne":340.0,
 "debt_charge_2027_bne":72.9,
 "debt_charge_2026_bne":62.6
}
PAP_CURVE=[3.1,7.5,11.3,15.0,18.4,21.7,24.8,27.7,30.2,32.1]

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def norm(s):
    s=re.sub(r"(?is)<(script|style|svg|noscript)[^>]*>.*?</\1>"," ",s)
    s=re.sub(r"(?is)<!--.*?-->"," ",s)
    s=re.sub(r"(?s)<[^>]+>"," ",s)
    return re.sub(r"\s+"," ",html.unescape(s)).strip()

def get(url):
    req=urllib.request.Request(url,headers={
      "User-Agent":UA,
      "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language":"fr-FR,fr;q=0.9,en;q=0.7",
      "Cache-Control":"no-cache"
    })
    with urllib.request.urlopen(req,timeout=25) as r:
        raw=r.read(3_000_000).decode("utf-8","replace")
        return getattr(r,"status",200),norm(raw),r.headers.get("etag"),r.headers.get("last-modified")

def fnum(s):
    return float(s.replace("\u00a0"," ").replace(" ","").replace(",", "."))

def source_record(i,publisher,label,url,health,checked_at=None,digest=None,error=None,etag=None,lm=None):
    return {"id":i,"publisher":publisher,"label":label,"url":url,"health":health,"digest":digest,
            "checked_at":checked_at or now(),"error":error,"etag":etag,"last_modified":lm}

def fetch_bdf_latest(previous):
    start=datetime.now(timezone.utc).date()
    errors=[]
    for back in range(0,12):
        d=start-timedelta(days=back)
        url=BDF_PREFIX+d.isoformat()
        try:
            _,text,etag,lm=get(url)
            block=re.search(r"\bTEC10\b(.*?)\bTEC15\b",text,re.I|re.S)
            vals=re.findall(r"(?<!\d)(\d{1,2}[,.]\d{3,4})(?!\d)",block.group(1) if block else "")
            if not vals:
                # Fallback if page markup/order changes: inspect a bounded window after TEC10.
                i=text.upper().find("TEC10")
                window=text[i:i+700] if i>=0 else ""
                vals=re.findall(r"(?<!\d)(\d{1,2}[,.]\d{3,4})(?!\d)",window)
            if vals:
                value=fnum(vals[-1])
                return (
                  source_record("BDF_TEC","Banque de France","TEC10 quotidien",url,"OK_LIVE",
                                digest=hashlib.sha256(text.encode()).hexdigest(),etag=etag,lm=lm),
                  {"tec10_pct":value,"tec10_date":d.isoformat(),"bdf_latest_page_date":d.isoformat()}
                )
            errors.append(f"{d}: parse")
        except Exception as e:
            errors.append(f"{d}: {type(e).__name__} {getattr(e,'code','')}")
    old=(previous or {}).get("observed",{})
    retained={}
    for k in ("tec10_pct","tec10_date","bdf_latest_page_date"):
        if k in old: retained[k]=old[k]
    return (
      source_record("BDF_TEC","Banque de France","TEC10 quotidien",BDF_PREFIX+start.isoformat(),
                    "DEGRADED_RETAINED",error="; ".join(errors[:5])[:500]),
      retained
    )

try:
    prev=json.loads(OUT.read_text())
except Exception:
    prev={}

observed={}
observed.update(AFT_DEBT)
observed.update(AFT_2027)
observed["plf2026_end_2026_10y_assumption_pct"]=3.8

sources=[
 source_record(
   "AFT_DEBT_VINTAGE","Agence France Trésor",
   "Encours, durée de vie et taux moyen pondéré — vintage 30/09/2026",
   "https://www.aft.gouv.fr/fr","OFFICIAL_VINTAGE",checked_at="2026-09-30T00:00:00Z"
 ),
 source_record(
   "AFT_2027_VINTAGE","Agence France Trésor",
   "Besoins et ressources de financement 2027 — publication 29/09/2026",
   "https://www.aft.gouv.fr/fr/publications/communiques-presse/29092026-besoins-et-ressources-financement-letat-en-2027-et-point",
   "OFFICIAL_VINTAGE",checked_at="2026-09-29T00:00:00Z"
 )
]
bdf_source,bdf_obs=fetch_bdf_latest(prev)
sources.append(bdf_source)
observed.update(bdf_obs)
if observed.get("tec10_pct") is not None:
    observed["tec10_vs_plf_assumption_bps"]=round((observed["tec10_pct"]-3.8)*100,1)

oldobs=prev.get("observed",{})
oldsrc={s.get("id"):s for s in prev.get("sources",[]) if isinstance(s,dict)}
events=[]

for s in sources:
    p=oldsrc.get(s["id"])
    if not p:
        events.append({"kind":"SOURCE_BASELINED","source_id":s["id"],"at":now(),"detail":"Source initialized."})
    elif p.get("health")!=s.get("health"):
        events.append({"kind":"SOURCE_HEALTH_CHANGED","source_id":s["id"],"at":now(),"detail":f"{p.get('health')} → {s.get('health')}"})

for k,v in observed.items():
    if k in oldobs and oldobs.get(k)!=v:
        events.append({"kind":"METRIC_CHANGED","metric":k,"at":now(),"detail":f"{oldobs.get(k)} → {v}"})

# Ignore the old source IDs created by v1.0; emit one migration event, never a permanent warning.
if any(x in oldsrc for x in ("AFT_HOME","AFT_BUDGET")):
    if not any(e.get("kind")=="SOURCE_MODEL_MIGRATED" for e in prev.get("events",[])):
        events.append({"kind":"SOURCE_MODEL_MIGRATED","at":now(),
                       "detail":"AFT values moved to explicit official vintages; only TEC10 remains live-polled."})

seq=int(prev.get("sequence",0))+(1 if events else 0)
manifest={
 "schema":"OJO_FRANCE_DEBT_RATE_LIVE_V1",
 "version":"2026-10-02.1",
 "sequence":seq,
 "updated_at":now(),
 "policy":{
   "political_recommendation":"NONE",
   "market_yield_is_not_whole_debt_cost":True,
   "source_change":"DELTA_THEN_RECONCILE",
   "typed_live_metrics":"OBSERVED_NOT_CAUSAL",
   "aft_values":"EXPLICIT_OFFICIAL_VINTAGES",
   "sensitivity_model":"FIXED_OFFICIAL_VINTAGES"
 },
 "observed":observed,
 "sensitivity":{
   "pap2026":{"label":"PLF 2026 · PAP Engagements financiers de l’État","shock_bps":100,
              "annual_extra_charge_bne":PAP_CURVE,"start_year":2026},
   "aft_later":{"label":"AFT · estimation citée par le Sénat","shock_bps":100,
                "points_bne":{"1":3.2,"5":23.5,"9":33.5}}
 },
 "sources":sources,
 "events":(prev.get("events",[])+events)[-120:],
 "material_changes":events,
 "summary":{
   "monitored":len(sources),
   "live_ok":sum(s.get("health")=="OK_LIVE" for s in sources),
   "official_vintages":sum(s.get("health")=="OFFICIAL_VINTAGE" for s in sources),
   "degraded":sum(s.get("health")=="DEGRADED_RETAINED" for s in sources),
   "changed_this_sequence":len(events)
 }
}

# No heartbeat-only commits. The runner can execute every 15 min without polluting history.
if prev and not events:
    print("NO_MATERIAL_CHANGE")
    raise SystemExit(0)

OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"status":"WROTE","sequence":seq,"events":len(events),"tec10":observed.get("tec10_pct"),
                  "tec10_date":observed.get("tec10_date"),"bdf_health":bdf_source["health"]},ensure_ascii=False))
