#!/usr/bin/env python3
from __future__ import annotations
import hashlib, html, json, re, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT=Path("docs/data/france-debt-rate-live.json")
UA="Mozilla/5.0 (compatible; OJO-France-Debt-Rate-Live/1.1; +https://github.com/Nicolason84/nova-trust)"
MAX=3_000_000
BDF_HOSTS=[
 "https://www.banque-france.fr",
 "https://acpr.banque-france.fr",
 "https://www.abe-infoservice.fr",
 "https://esurfi.banque-france.fr",
]
BDF_PATH="/fr/statistiques/taux-et-cours/indices-obligataires-"
BDF_CSV=[
 "https://webstat.banque-france.fr/export/csv-columns/fr/selection/5385693",
 "https://webstat.banque-france.fr/fr/downloadFile.do?id=5385693&exportType=csv",
]
AFT_RSS="https://www.aft.gouv.fr/fr/rss.xml"
DGFIP_META="https://www.data.gouv.fr/api/1/datasets/dgfip-situation-mensuelle-de-letat/"
PAP_CURVE=[3.1,7.5,11.3,15.0,18.4,21.7,24.8,27.7,30.2,32.1]
TEC_TENORS=(1,2,3,5,7,10,15,20,25,30)

# Official AFT outstanding-by-maturity vintage observed 2026-10-02.
# Indexed bonds are shown separately because future redemption cash can differ with indexation.
MATURITY_VINTAGE={
 "as_of":"2026-10-02",
 "source":"Agence France Trésor — encours détaillé OAT / OATi / OAT€i",
 "years":[
   {"year":2027,"oat_nominal_bne":165.642,"oati_bne":0.0,"oatei_bne":21.737},
   {"year":2028,"oat_nominal_bne":228.417232603,"oati_bne":17.412,"oatei_bne":0.0},
   {"year":2029,"oat_nominal_bne":249.525880462,"oati_bne":10.176144,"oatei_bne":24.041}
 ],
 "note":"Encours publié par millésime d'échéance; ce n'est ni le besoin annuel de financement ni le cash final d'amortissement après rachats/indexation."
}

PINNED={
 "debt_negotiable_eur":2896181146497,
 "debt_date":"2026-09-30",
 "debt_avg_life_years":8,
 "debt_avg_life_days":158,
 "debt_avg_life_date":"2026-09-30",
 "weighted_oat_issuance_pct":3.55,
 "weighted_oat_date":"2026-09-30",
 "financing_need_2027_bne":339.7,
 "issuance_mlt_2027_bne":340.0,
 "plf2026_end_2026_10y_assumption_pct":3.8,
}

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def norm(s):
    s=re.sub(r"(?is)<(script|style|svg|noscript)[^>]*>.*?</\1>"," ",s)
    s=re.sub(r"(?is)<!--.*?-->"," ",s)
    s=re.sub(r"(?s)<[^>]+>"," ",s)
    return re.sub(r"\s+"," ",html.unescape(s)).strip()

def req(url,accept="text/html,*/*;q=0.8"):
    r=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":accept,"Accept-Language":"fr-FR,fr;q=0.9,en;q=0.6"})
    with urllib.request.urlopen(r,timeout=25) as x:
        b=x.read(MAX)
        return getattr(x,"status",200),b,x.headers.get("etag"),x.headers.get("last-modified"),x.headers.get_content_charset()

def fnum(s):
    return float(s.replace("\u00a0"," ").replace(" ","").replace(",", "."))

def src(i,publisher,label,url,health="OK",digest=None,error=None,etag=None,lm=None,extra=None):
    d={"id":i,"publisher":publisher,"label":label,"url":url,"health":health,"digest":digest,"checked_at":now(),"error":error,"etag":etag,"last_modified":lm}
    if extra:d.update(extra)
    return d

def parse_bdf_curve(text):
    text=norm(text)
    out={}
    for i,tenor in enumerate(TEC_TENORS):
        nxt = TEC_TENORS[i+1] if i+1 < len(TEC_TENORS) else None
        if nxt is not None:
            pat=rf"\bTEC{tenor}\b\s+(.*?)(?=\bTEC{nxt}\b)"
        else:
            pat=rf"\bTEC{tenor}\b\s+(.*?)(?=Indices Hebdomadaires|Indices Mensuels|$)"
        m=re.search(pat,text,re.I|re.S)
        vals=re.findall(r"(?<!\d)(\d{1,2}[,.]\d{3,4})(?!\d)",m.group(1) if m else "")
        if vals:
            out[tenor]=fnum(vals[-1])
    return out

def fetch_bdf_html():
    today=datetime.now(timezone.utc).date()
    errs=[]
    for back in range(0,10):
        d=today-timedelta(days=back)
        for host in BDF_HOSTS:
            url=host+BDF_PATH+d.isoformat()
            try:
                status,b,etag,lm,cs=req(url)
                text=b.decode(cs or "utf-8","replace")
                curve=parse_bdf_curve(text)
                if curve.get(10) is not None:
                    curve_rows=[{"tenor_years":t,"rate_pct":curve[t]} for t in TEC_TENORS if t in curve]
                    return src("BDF_TEC","Banque de France","Courbe TEC quotidienne · page officielle",url,digest=hashlib.sha256(norm(text).encode()).hexdigest(),etag=etag,lm=lm),{
                        "tec10_pct":curve[10],
                        "tec10_date":d.isoformat(),
                        "yield_curve_date":d.isoformat(),
                        "yield_curve":curve_rows
                    }
            except Exception as e:
                errs.append(f"{host}:{type(e).__name__}:{e}")
    return src("BDF_TEC","Banque de France","TEC10 quotidien · page officielle",BDF_HOSTS[0]+BDF_PATH+today.isoformat(),health="ERROR",error=" | ".join(errs[-4:])[:700]),{}

def fetch_bdf_csv():
    errs=[]
    for url in BDF_CSV:
        try:
            status,b,etag,lm,cs=req(url,"text/csv,text/plain,*/*;q=0.8")
            text=b.decode(cs or "utf-8","replace")
            dates=re.findall(r"(?:\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})",text)
            # Flexible extraction: inspect TEC10 row/record first, then neighboring fields.
            chunks=[x for x in re.split(r"[\r\n]+",text) if re.search(r"TEC\s*10|TEC10",x,re.I)]
            vals=[]
            for c in chunks:
                vals += [fnum(x) for x in re.findall(r"(?<!\d)(\d+[,.]\d{2,4})(?!\d)",c)]
            if vals:
                v=vals[-1]
                date=None
                if dates:
                    z=dates[-1]
                    if "/" in z:
                        dd,mm,yy=z.split("/"); date=f"{yy}-{mm}-{dd}"
                    else: date=z
                return src("BDF_WEBSTAT","Banque de France · Webstat","Historique CNO-TEC · export CSV",url,digest=hashlib.sha256(b).hexdigest(),etag=etag,lm=lm),{"webstat_tec10_last_pct":v,"webstat_last_date":date}
            return src("BDF_WEBSTAT","Banque de France · Webstat","Historique CNO-TEC · export CSV",url,health="PARSE_WARN",digest=hashlib.sha256(b).hexdigest(),etag=etag,lm=lm,error="CSV fetched but TEC10 record not parsed."),{}
        except Exception as e:
            errs.append(f"{type(e).__name__}: {e}")
    return src("BDF_WEBSTAT","Banque de France · Webstat","Historique CNO-TEC · export CSV",BDF_CSV[0],health="ERROR",error=" | ".join(errs)[:500]),{}

def fetch_watch(i,publisher,label,url,accept):
    try:
        status,b,etag,lm,cs=req(url,accept)
        return src(i,publisher,label,url,digest=hashlib.sha256(b).hexdigest(),etag=etag,lm=lm,extra={"bytes":len(b)})
    except Exception as e:
        return src(i,publisher,label,url,health="ERROR",error=f"{type(e).__name__}: {e}"[:500])

try:
    prev=json.loads(OUT.read_text())
except Exception:
    prev={}

oldobs=prev.get("observed",{})
observed={**PINNED,**oldobs}
sources=[]

bdf,bvals=fetch_bdf_html()
sources.append(bdf)
observed.update(bvals)

webstat,wvals=fetch_bdf_csv()
sources.append(webstat)
# Only use CSV as a fallback live TEC observation if page mirror did not bind.
if "tec10_pct" not in bvals and wvals.get("webstat_tec10_last_pct") is not None:
    observed["tec10_pct"]=wvals["webstat_tec10_last_pct"]
    if wvals.get("webstat_last_date"): observed["tec10_date"]=wvals["webstat_last_date"]

sources.append(fetch_watch("AFT_RSS","Agence France Trésor","Flux RSS des publications","https://www.aft.gouv.fr/fr/rss.xml","application/rss+xml,application/xml,text/xml,*/*;q=0.8"))
sources.append(fetch_watch("DGFIP_META","DGFiP / data.gouv.fr","Situation mensuelle de l'État · métadonnées","https://www.data.gouv.fr/api/1/datasets/dgfip-situation-mensuelle-de-letat/","application/json,*/*;q=0.8"))
sources.append(src("AFT_SNAPSHOT","Agence France Trésor","Ancre officielle · encours, maturité, financement 2027","https://www.aft.gouv.fr/fr",health="PINNED",digest=hashlib.sha256(json.dumps(PINNED,sort_keys=True).encode()).hexdigest(),extra={"published_through":"2026-10-01","note":"Pinned because AFT HTML blocks unattended GitHub runners; publication RSS remains live-monitored."}))

if observed.get("tec10_pct") is not None:
    observed["tec10_vs_plf_assumption_bps"]=round((float(observed["tec10_pct"])-3.8)*100,1)

old_sources={x.get("id"):x for x in prev.get("sources",[]) if isinstance(x,dict)}
events=[]
for s in sources:
    p=old_sources.get(s["id"])
    if not p:
        events.append({"kind":"SOURCE_BASELINED","source_id":s["id"],"at":s["checked_at"],"detail":"First fingerprint captured."})
    elif p.get("health")!=s.get("health"):
        events.append({"kind":"SOURCE_HEALTH_CHANGED","source_id":s["id"],"at":s["checked_at"],"detail":f"{p.get('health')} → {s.get('health')}"})
    elif s.get("digest") and p.get("digest")!=s.get("digest"):
        events.append({"kind":"SOURCE_CHANGED","source_id":s["id"],"at":s["checked_at"],"detail":"Public source fingerprint changed."})

for k,v in observed.items():
    if k in oldobs and oldobs.get(k)!=v:
        events.append({"kind":"METRIC_CHANGED","metric":k,"at":now(),"detail":f"{oldobs.get(k)} → {v}"})

seq=int(prev.get("sequence",0))+(1 if events else 0)
ok_states={"OK","PINNED"}
manifest={
 "schema":"OJO_FRANCE_DEBT_RATE_LIVE_V1",
 "version":"2026-10-02.3",
 "sequence":seq,
 "updated_at":now(),
 "policy":{"political_recommendation":"NONE","market_yield_is_not_whole_debt_cost":True,"source_change":"DELTA_THEN_RECONCILE","typed_live_metrics":"OBSERVED_NOT_CAUSAL","sensitivity_model":"FIXED_OFFICIAL_VINTAGES","aft_html":"PINNED_DUE_TO_RUNNER_BLOCK"},
 "observed":observed,
 "sensitivity":{
   "pap2026":{"label":"PLF 2026 · PAP Engagements financiers de l’État","shock_bps":100,"annual_extra_charge_bne":PAP_CURVE,"start_year":2026},
   "aft_later":{"label":"AFT · estimation citée par le Sénat","shock_bps":100,"points_bne":{"1":3.2,"5":23.5,"9":33.5}}
 },
 "maturity_ladder":MATURITY_VINTAGE,
 "sources":sources,
 "events":(prev.get("events",[])+events)[-120:],
 "material_changes":events,
 "summary":{"healthy":sum(s.get("health") in ok_states for s in sources),"monitored":len(sources),"warnings":sum(s.get("health") not in ok_states for s in sources),"changed_this_sequence":len(events)}
}
OUT.parent.mkdir(parents=True,exist_ok=True)
encoded=json.dumps(manifest,ensure_ascii=False,indent=2)+"\n"

if prev:
    core_prev={k:v for k,v in prev.items() if k not in ("updated_at","material_changes","sources","summary")}
    core_new={k:v for k,v in manifest.items() if k not in ("updated_at","material_changes","sources","summary")}
    src_same=all(old_sources.get(s["id"],{}).get("digest")==s.get("digest") and old_sources.get(s["id"],{}).get("health")==s.get("health") for s in sources)
    if core_prev==core_new and src_same:
        print("NO_MATERIAL_CHANGE")
        raise SystemExit(0)

OUT.write_text(encoded)
print(json.dumps({"status":"WROTE","sequence":seq,"events":len(events),"summary":manifest["summary"],"tec10":observed.get("tec10_pct")},ensure_ascii=False))
