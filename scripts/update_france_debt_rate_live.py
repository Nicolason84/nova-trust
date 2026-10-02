#!/usr/bin/env python3
from __future__ import annotations
import hashlib, html, json, re, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT=Path("docs/data/france-debt-rate-live.json")
UA="OJO-France-Debt-Rate-Live/1.0 (+https://github.com/Nicolason84/nova-trust)"
MAX=3_000_000
AFT_HOME="https://www.aft.gouv.fr/fr"
AFT_BUDGET="https://www.aft.gouv.fr/fr/budget-etat"
BDF_PREFIX="https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-"

PAP_CURVE=[3.1,7.5,11.3,15.0,18.4,21.7,24.8,27.7,30.2,32.1]

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def norm(s):
    s=re.sub(r"(?is)<(script|style|svg|noscript)[^>]*>.*?</\\1>"," ",s)
    s=re.sub(r"(?is)<!--.*?-->"," ",s)
    s=re.sub(r"(?s)<[^>]+>"," ",s)
    return re.sub(r"\\s+"," ",html.unescape(s)).strip()

def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"text/html,*/*;q=0.8"})
    with urllib.request.urlopen(req,timeout=25) as r:
        raw=r.read(MAX).decode("utf-8","replace")
        return getattr(r,"status",200),norm(raw),r.headers.get("etag"),r.headers.get("last-modified")

def fnum(s):
    return float(s.replace("\u00a0"," ").replace(" ","").replace(",", "."))

def fint(s):
    return int(re.sub(r"\\D","",s))

def iso_fr_date(s):
    months={"janvier":1,"février":2,"fevrier":2,"mars":3,"avril":4,"mai":5,"juin":6,"juillet":7,"août":8,"aout":8,"septembre":9,"octobre":10,"novembre":11,"décembre":12,"decembre":12}
    m=re.search(r"(\\d{1,2})\\s+([A-Za-zÀ-ÿ]+)\\s+(\\d{4})",s,re.I)
    if not m:return None
    mo=months.get(m.group(2).lower())
    if not mo:return None
    return f"{int(m.group(3)):04d}-{mo:02d}-{int(m.group(1)):02d}"

def source_record(i,publisher,label,url,health="OK",digest=None,error=None,etag=None,lm=None):
    return {"id":i,"publisher":publisher,"label":label,"url":url,"health":health,"digest":digest,"checked_at":now(),"error":error,"etag":etag,"last_modified":lm}

def parse_aft_home(text):
    out={}
    m=re.search(r"([0-9][0-9 \\u00a0]{6,})\\s*€\\s*Encours de la dette négociable de l['’]État\\s*(\\d{1,2}\\s+[A-Za-zÀ-ÿ]+\\s+\\d{4})",text,re.I)
    if m:
        out["debt_negotiable_eur"]=fint(m.group(1)); out["debt_date"]=iso_fr_date(m.group(2))
    m=re.search(r"(\\d+)\\s*ans et\\s*(\\d+)\\s*jours\\s*Durée de vie moyenne de la dette négociable\\s*(\\d{1,2}\\s+[A-Za-zÀ-ÿ]+\\s+\\d{4})",text,re.I)
    if m:
        out["debt_avg_life_years"]=int(m.group(1)); out["debt_avg_life_days"]=int(m.group(2)); out["debt_avg_life_date"]=iso_fr_date(m.group(3))
    m=re.search(r"([0-9]+[,.][0-9]+)\\s*%\\s*TEC\\s*10\\s*(\\d{1,2}\\s+[A-Za-zÀ-ÿ]+\\s+\\d{4})",text,re.I)
    if m:
        out["tec10_pct"]=fnum(m.group(1)); out["tec10_date"]=iso_fr_date(m.group(2))
    m=re.search(r"([0-9]+[,.][0-9]+)\\s*%\\s*Taux Moyen Pondéré OAT.*?(\\d{1,2}\\s+[A-Za-zÀ-ÿ]+\\s+\\d{4})",text,re.I)
    if m:
        out["weighted_oat_issuance_pct"]=fnum(m.group(1)); out["weighted_oat_date"]=iso_fr_date(m.group(2))
    return out

def parse_budget(text):
    out={}
    m=re.search(r"besoin prévisionnel de financement de l['’]État\\s+atteindra\\s+([0-9]+[,.][0-9]+)\\s*milliards",text,re.I)
    if m: out["financing_need_2027_bne"]=fnum(m.group(1))
    m=re.search(r"programme d['’]émissions de titres d['’]État à moyen et long terme à hauteur de\\s+([0-9]+[,.][0-9]+)\\s*milliards",text,re.I)
    if m: out["issuance_mlt_2027_bne"]=fnum(m.group(1))
    return out

def fetch_bdf_latest():
    start=datetime.now(timezone.utc).date()
    last_err=None
    for back in range(0,10):
        d=start-timedelta(days=back); url=BDF_PREFIX+d.isoformat()
        try:
            status,text,etag,lm=get(url)
            m=re.search(r"TEC10\\s+((?:[0-9]+[,.][0-9]+\\s+){1,8})TEC15",text,re.I)
            vals=[]
            if m: vals=re.findall(r"[0-9]+[,.][0-9]+",m.group(1))
            if vals:
                return source_record("BDF_TEC","Banque de France","Indices obligataires TEC",url,digest=hashlib.sha256(text.encode()).hexdigest(),etag=etag,lm=lm),{"bdf_latest_page_date":d.isoformat(),"bdf_tec10_last_pct":fnum(vals[-1])}
            if "TEC10" in text:
                mm=re.search(r"TEC10\\s+(.*?)(?:TEC15|Indices Hebdomadaires)",text,re.I)
                vals=re.findall(r"[0-9]+[,.][0-9]+",mm.group(1) if mm else "")
                if vals:
                    return source_record("BDF_TEC","Banque de France","Indices obligataires TEC",url,digest=hashlib.sha256(text.encode()).hexdigest(),etag=etag,lm=lm),{"bdf_latest_page_date":d.isoformat(),"bdf_tec10_last_pct":fnum(vals[-1])}
        except Exception as e:
            last_err=e
    return source_record("BDF_TEC","Banque de France","Indices obligataires TEC",BDF_PREFIX+start.isoformat(),health="ERROR",error=f"{type(last_err).__name__}: {last_err}"[:350]),{}

def fetch_live():
    sources=[]; observed={}
    try:
        status,text,etag,lm=get(AFT_HOME)
        dig=hashlib.sha256(text.encode()).hexdigest()
        vals=parse_aft_home(text)
        health="OK" if {"debt_negotiable_eur","debt_avg_life_years","tec10_pct"}.issubset(vals) else "PARSE_WARN"
        sources.append(source_record("AFT_HOME","Agence France Trésor","Dette négociable, maturité, TEC10, taux moyen pondéré",AFT_HOME,health=health,digest=dig,etag=etag,lm=lm))
        observed.update(vals)
    except Exception as e:
        sources.append(source_record("AFT_HOME","Agence France Trésor","Dette négociable, maturité, TEC10, taux moyen pondéré",AFT_HOME,health="ERROR",error=f"{type(e).__name__}: {e}"[:350]))
    try:
        status,text,etag,lm=get(AFT_BUDGET)
        dig=hashlib.sha256(text.encode()).hexdigest()
        vals=parse_budget(text)
        health="OK" if {"financing_need_2027_bne","issuance_mlt_2027_bne"}.issubset(vals) else "PARSE_WARN"
        sources.append(source_record("AFT_BUDGET","Agence France Trésor","Besoin et ressources de financement 2027",AFT_BUDGET,health=health,digest=dig,etag=etag,lm=lm))
        observed.update(vals)
    except Exception as e:
        sources.append(source_record("AFT_BUDGET","Agence France Trésor","Besoin et ressources de financement 2027",AFT_BUDGET,health="ERROR",error=f"{type(e).__name__}: {e}"[:350]))
    bsrc,bvals=fetch_bdf_latest(); sources.append(bsrc); observed.update(bvals)
    observed["plf2026_end_2026_10y_assumption_pct"]=3.8
    if observed.get("tec10_pct") is not None:
        observed["tec10_vs_plf_assumption_bps"]=round((observed["tec10_pct"]-3.8)*100,1)
    return sources,observed

try:
    prev=json.loads(OUT.read_text())
except Exception:
    prev={}

sources,observed=fetch_live()
old_sources={x.get("id"):x for x in prev.get("sources",[]) if isinstance(x,dict)}
events=[]
for s in sources:
    p=old_sources.get(s["id"])
    if not p:
        events.append({"kind":"SOURCE_BASELINED","source_id":s["id"],"at":s["checked_at"],"detail":"First fingerprint captured."})
    elif p.get("health")!=s.get("health"):
        events.append({"kind":"SOURCE_HEALTH_CHANGED","source_id":s["id"],"at":s["checked_at"],"detail":f"{p.get('health')} → {s.get('health')}"})
    elif s.get("digest") and p.get("digest")!=s.get("digest"):
        events.append({"kind":"SOURCE_CHANGED","source_id":s["id"],"at":s["checked_at"],"detail":"Official public source changed; typed observations refreshed."})

oldobs=prev.get("observed",{})
for k,v in observed.items():
    if k in oldobs and oldobs.get(k)!=v:
        events.append({"kind":"METRIC_CHANGED","metric":k,"at":now(),"detail":f"{oldobs.get(k)} → {v}"})

if not prev:
    seq=1
else:
    seq=int(prev.get("sequence",0))+(1 if events else 0)

manifest={
 "schema":"OJO_FRANCE_DEBT_RATE_LIVE_V1",
 "version":"2026-10-02",
 "sequence":seq,
 "updated_at":now(),
 "policy":{"political_recommendation":"NONE","market_yield_is_not_whole_debt_cost":True,"source_change":"DELTA_THEN_RECONCILE","typed_live_metrics":"OBSERVED_NOT_CAUSAL","sensitivity_model":"FIXED_OFFICIAL_VINTAGES"},
 "observed":{**oldobs,**observed},
 "sensitivity":{
   "pap2026":{"label":"PLF 2026 · PAP Engagements financiers de l’État","shock_bps":100,"annual_extra_charge_bne":PAP_CURVE,"start_year":2026},
   "aft_later":{"label":"AFT · estimation citée par le Sénat","shock_bps":100,"points_bne":{"1":3.2,"5":23.5,"9":33.5}}
 },
 "sources":sources,
 "events":(prev.get("events",[])+events)[-120:],
 "material_changes":events,
 "summary":{"healthy":sum(s.get("health")=="OK" for s in sources),"monitored":len(sources),"warnings":sum(s.get("health")!="OK" for s in sources),"changed_this_sequence":len(events)}
}

OUT.parent.mkdir(parents=True,exist_ok=True)
encoded=json.dumps(manifest,ensure_ascii=False,indent=2)+"\n"
if prev:
    comparable_prev={k:v for k,v in prev.items() if k not in ("updated_at","material_changes","sources")}
    comparable_new={k:v for k,v in manifest.items() if k not in ("updated_at","material_changes","sources")}
    same_core=(comparable_prev==comparable_new and all(old_sources.get(s["id"],{}).get("digest")==s.get("digest") and old_sources.get(s["id"],{}).get("health")==s.get("health") for s in sources))
    if same_core:
        print("NO_MATERIAL_CHANGE")
        raise SystemExit(0)
OUT.write_text(encoded)
print(json.dumps({"status":"WROTE","sequence":seq,"events":len(events),"observed":manifest["observed"]},ensure_ascii=False))
