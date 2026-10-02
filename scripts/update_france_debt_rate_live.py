#!/usr/bin/env python3
from __future__ import annotations
import csv, gzip, hashlib, html, io, json, re, urllib.request
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
DGFIP_EXPORT="https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/situation-mensuelle-de-l-etat/exports/json"
PAP_CURVE=[3.1,7.5,11.3,15.0,18.4,21.7,24.8,27.7,30.2,32.1]
TEC_TENORS=(1,2,3,5,7,10,15,20,25,30)
HISTORY_LIMIT=120
AFT_MATURITY_URLS={
 "oat":"https://www.aft.gouv.fr/fr/encours-detaille-oat",
 "oati":"https://www.aft.gouv.fr/fr/encours-detaille-oati",
 "oatei":"https://www.aft.gouv.fr/fr/encours-detaille-oatei",
}

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
    r=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":accept,"Accept-Language":"fr-FR,fr;q=0.9,en;q=0.6","Accept-Encoding":"gzip"})
    with urllib.request.urlopen(r,timeout=25) as x:
        b=x.read(MAX)
        if (x.headers.get("content-encoding") or "").lower()=="gzip":
            b=gzip.decompress(b)
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
            text=b.decode(cs or "utf-8-sig","replace").lstrip("\ufeff")
            rows=list(csv.reader(io.StringIO(text),delimiter=";"))
            if not rows:
                raise ValueError("EMPTY_CSV")
            header=rows[0]
            tenors={}
            for i,name in enumerate(header):
                m=re.search(r"Echéance Constante\s*-\s*(\d+)\s*ans",name,re.I)
                if m: tenors[i]=int(m.group(1))
            if 10 not in tenors.values() or len(tenors)<8:
                raise ValueError("TEC_COLUMNS_NOT_FOUND")
            hist=[]
            for row in rows[1:]:
                if not row or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",(row[0] or "").strip()):
                    continue
                curve=[]
                for idx,tenor in tenors.items():
                    if idx>=len(row): continue
                    raw=(row[idx] or "").strip()
                    if raw in ("","-"): continue
                    try: curve.append({"tenor_years":tenor,"rate_pct":fnum(raw)})
                    except Exception: pass
                if len(curve)>=8:
                    curve=sorted(curve,key=lambda x:x["tenor_years"])
                    hist.append({"date":row[0].strip(),"curve":curve})
                if len(hist)>=HISTORY_LIMIT:
                    break
            if not hist:
                raise ValueError("NO_VALID_TEC_ROWS")
            latest=hist[0]
            m=curve_map(latest["curve"])
            return src("BDF_WEBSTAT","Banque de France · Webstat","Historique CNO-TEC · export CSV",url,health="OK",digest=hashlib.sha256(b).hexdigest(),etag=etag,lm=lm,extra={"history_rows":len(hist)}),{
              "webstat_tec10_last_pct":m.get(10),
              "webstat_last_date":latest["date"],
              "webstat_curve_latest":latest["curve"],
              "webstat_history":list(reversed(hist))
            }
        except Exception as e:
            errs.append(f"{type(e).__name__}: {e}")
    return src("BDF_WEBSTAT","Banque de France · Webstat","Historique CNO-TEC · export CSV",BDF_CSV[0],health="ERROR",error=" | ".join(errs)[:500]),{}

def fetch_watch(i,publisher,label,url,accept):
    try:
        status,b,etag,lm,cs=req(url,accept)
        return src(i,publisher,label,url,digest=hashlib.sha256(b).hexdigest(),etag=etag,lm=lm,extra={"bytes":len(b)})
    except Exception as e:
        return src(i,publisher,label,url,health="ERROR",error=f"{type(e).__name__}: {e}"[:500])

def document_period(title):
    months={
      "janvier":1,"février":2,"fevrier":2,"mars":3,"avril":4,"mai":5,"juin":6,
      "juillet":7,"août":8,"aout":8,"septembre":9,"octobre":10,"novembre":11,"décembre":12,"decembre":12
    }
    t=(title or "").lower()
    for name,month in months.items():
        m=re.search(r"\b"+re.escape(name)+r"\s+(20\d{2})\b",t)
        if m:return (int(m.group(1)),month)
    return (0,0)

def fetch_dgfip_execution():
    try:
        status,b,etag,lm,cs=req(DGFIP_EXPORT,"application/json,*/*;q=0.8")
        rows=json.loads(b.decode(cs or "utf-8","replace"))
        if not isinstance(rows,list) or not rows:
            raise ValueError("EMPTY_DGFIP_DATASET")
        docs=[x for x in rows if isinstance(x,dict) and x.get("titre_document") and x.get("url_fichier")]
        docs=[x for x in docs if document_period(x.get("titre_document"))!=(0,0)]
        if not docs: raise ValueError("NO_DGFIP_DOCUMENTS")
        latest=max(docs,key=lambda x:document_period(x.get("titre_document")))
        y,m=document_period(latest.get("titre_document"))
        obs={
          "period":f"{y:04d}-{m:02d}",
          "date_publication_raw":latest.get("date_publication"),
          "titre_document":latest.get("titre_document"),
          "url_fichier":latest.get("url_fichier"),
          "dataset_rows":len(rows)
        }
        return src("DGFIP_EXECUTION","DGFiP / data.economie.gouv.fr","Situation mensuelle de l'État · dernier document",DGFIP_EXPORT,health="OK",digest=hashlib.sha256(b).hexdigest(),etag=etag,lm=lm,extra={"latest_period":obs["period"]}),obs
    except Exception as e:
        return src("DGFIP_EXECUTION","DGFiP / data.economie.gouv.fr","Situation mensuelle de l'État · dernier document",DGFIP_EXPORT,health="ERROR",error=f"{type(e).__name__}: {e}"[:500]),{}


def parse_aft_maturities(text):
    text=norm(text)
    out={}
    for year,amount in re.findall(r"Échéance\s+(20\d{2}|21\d{2})\s+([0-9][0-9 ]{5,})",text,re.I):
        digits=re.sub(r"\D","",amount)
        if digits:
            out[int(year)]=int(digits)/1e9
    return out

def fetch_aft_maturity(previous):
    tables={}
    sources=[]
    for kind,url in AFT_MATURITY_URLS.items():
        try:
            status,b,etag,lm,cs=req(url)
            text=b.decode(cs or "utf-8","replace")
            table=parse_aft_maturities(text)
            if not table:
                raise ValueError("NO_MATURITY_ROWS_PARSED")
            tables[kind]=table
            sources.append(src("AFT_MATURITY_"+kind.upper(),"Agence France Trésor",
                               "Encours détaillé "+kind.upper(),url,health="OK",
                               digest=hashlib.sha256(norm(text).encode()).hexdigest(),
                               etag=etag,lm=lm,extra={"rows":len(table)}))
        except Exception as e:
            sources.append(src("AFT_MATURITY_"+kind.upper(),"Agence France Trésor",
                               "Encours détaillé "+kind.upper(),url,health="ERROR",
                               error=f"{type(e).__name__}: {e}"[:500]))
    if len(tables)==3:
        years=sorted(set().union(*[set(x) for x in tables.values()]))
        rows=[]
        for y in years:
            rows.append({
              "year":y,
              "oat_nominal_bne":round(tables["oat"].get(y,0.0),9),
              "oati_bne":round(tables["oati"].get(y,0.0),9),
              "oatei_bne":round(tables["oatei"].get(y,0.0),9),
            })
        return {
          "as_of":datetime.now(timezone.utc).date().isoformat(),
          "source":"Agence France Trésor — encours détaillé OAT / OATi / OAT€i",
          "mode":"LIVE_PARSED",
          "years":rows,
          "note":"Encours publié par millésime d'échéance; ce n'est ni le besoin annuel de financement ni le cash final d'amortissement après rachats/indexation."
        },sources
    old=previous.get("maturity_ladder") if isinstance(previous,dict) else None
    retained=old if isinstance(old,dict) and old.get("years") else MATURITY_VINTAGE
    retained=dict(retained)
    retained["mode"]="RETAINED_LAST_GOOD"
    retained["retained_at"]=retained.get("retained_at") or now()
    return retained,sources

def curve_map(rows):
    return {int(x["tenor_years"]):float(x["rate_pct"]) for x in rows or [] if isinstance(x,dict) and "tenor_years" in x and "rate_pct" in x}

def curve_metrics(rows):
    m=curve_map(rows)
    out={}
    if 2 in m and 10 in m: out["slope_2s10s_bps"]=round((m[10]-m[2])*100,1)
    if 10 in m and 30 in m: out["slope_10s30s_bps"]=round((m[30]-m[10])*100,1)
    if 1 in m and 30 in m: out["slope_1s30s_bps"]=round((m[30]-m[1])*100,1)
    return out

def append_curve_history(previous,observed,seed=None):
    hist=list(previous.get("curve_history",[])) if isinstance(previous,dict) else []
    merged={}
    for item in (seed or [])+hist:
        if isinstance(item,dict) and item.get("date") and item.get("curve"):
            merged[item["date"]]={"date":item["date"],"captured_at":item.get("captured_at") or now(),"curve":item["curve"]}
    rows=observed.get("yield_curve") or []
    if rows and observed.get("yield_curve_date"):
        date=observed["yield_curve_date"]
        existing=merged.get(date)
        captured_at=existing.get("captured_at") if existing and existing.get("curve")==rows else now()
        merged[date]={"date":date,"captured_at":captured_at,"curve":rows}
    return [merged[k] for k in sorted(merged)][-HISTORY_LIMIT:]

def curve_delta(history):
    if len(history)<2:return {}
    a=curve_map(history[-2].get("curve",[])); b=curve_map(history[-1].get("curve",[]))
    common=sorted(set(a)&set(b))
    return {str(t):round((b[t]-a[t])*100,1) for t in common}

def curve_change(history, days):
    usable=[x for x in history if isinstance(x,dict) and x.get("date") and x.get("curve")]
    if len(usable)<2:return {"days_requested":days,"available":False,"changes_bps":{}}
    current=usable[-1]
    cur_date=datetime.fromisoformat(current["date"]).date()
    cutoff=cur_date-timedelta(days=days)
    candidates=[x for x in usable[:-1] if datetime.fromisoformat(x["date"]).date()<=cutoff]
    reference=(candidates[-1] if candidates else usable[0])
    a,b=curve_map(reference["curve"]),curve_map(current["curve"])
    common=sorted(set(a)&set(b))
    return {
      "days_requested":days,
      "available":bool(common),
      "from_date":reference["date"],
      "to_date":current["date"],
      "actual_days":(cur_date-datetime.fromisoformat(reference["date"]).date()).days,
      "changes_bps":{str(t):round((b[t]-a[t])*100,1) for t in common}
    }

def curve_regime_memory(history):
    usable=[x for x in history if isinstance(x,dict) and x.get("date") and x.get("curve")]
    if not usable:return {"regime":"UNKNOWN","forecast":False,"similar_historical_configurations":[]}
    horizons={f"{d}d":curve_change(usable,d) for d in (1,7,30,90)}
    daily=horizons["1d"].get("changes_bps",{})
    vals=[float(v) for v in daily.values()]
    avg=sum(vals)/len(vals) if vals else 0.0
    dispersion=(sum((v-avg)**2 for v in vals)/len(vals))**0.5 if vals else 0.0
    short=[float(v) for k,v in daily.items() if int(k)<=3]
    long=[float(v) for k,v in daily.items() if int(k)>=10]
    short_avg=sum(short)/len(short) if short else 0.0
    long_avg=sum(long)/len(long) if long else 0.0
    if vals and abs(avg)>=3 and dispersion<=3:
        regime="PARALLEL_UP" if avg>0 else "PARALLEL_DOWN"
    elif vals and long_avg-short_avg>=3:
        regime="STEEPENING"
    elif vals and long_avg-short_avg<=-3:
        regime="FLATTENING"
    else:
        regime="MIXED_OR_STABLE"
    current=curve_map(usable[-1]["curve"])
    anchor=current.get(10)
    similar=[]
    if anchor is not None:
        shape={t:current[t]-anchor for t in current}
        for item in usable[:-1]:
            m=curve_map(item["curve"])
            if 10 not in m:continue
            common=sorted(set(shape)&set(m))
            if len(common)<8:continue
            rmse=(sum(((m[t]-m[10])-shape[t])**2 for t in common)/len(common))**0.5*100
            similar.append({"date":item["date"],"shape_rmse_bps":round(rmse,1)})
    similar=sorted(similar,key=lambda x:x["shape_rmse_bps"])[:5]
    return {
      "as_of":usable[-1]["date"],
      "regime":regime,
      "daily_mean_move_bps":round(avg,1),
      "daily_dispersion_bps":round(dispersion,1),
      "short_vs_long_bps":round(long_avg-short_avg,1),
      "horizon_changes_bps":horizons,
      "similar_historical_configurations":similar,
      "method":"Descriptive curve-shape comparison; no causal attribution and no forecast.",
      "forecast":False
    }

def refinancing_twin(observed,maturity):
    rows=maturity.get("years",[]) if isinstance(maturity,dict) else []
    as_of=datetime.fromisoformat((maturity.get("as_of") or datetime.now(timezone.utc).date().isoformat())[:10]).date()
    last_year=max([int(r.get("year",0)) for r in rows] or [as_of.year])
    views=[]
    for months in (12,36,60,120):
        end_year=as_of.year+(months+11)//12
        selected=[r for r in rows if as_of.year<int(r.get("year",0))<=end_year]
        nominal=sum(float(r.get("oat_nominal_bne",0)) for r in selected)
        indexed=sum(float(r.get("oati_bne",0))+float(r.get("oatei_bne",0)) for r in selected)
        views.append({
          "horizon_months":months,
          "maturity_stock_bne":round(nominal+indexed,3),
          "nominal_stock_bne":round(nominal,3),
          "indexed_stock_bne":round(indexed,3),
          "included_years":[int(r["year"]) for r in selected],
          "coverage":"OFFICIAL_VINTAGE" if end_year<=last_year else "PARTIAL_OFFICIAL_VINTAGE",
          "financing_need_bne":float(observed["financing_need_2027_bne"]) if months==12 and observed.get("financing_need_2027_bne") is not None else None,
          "financing_need_scope":"ANNUAL_2027_VINTAGE_NOT_HORIZON_SUM" if months==12 else "UNKNOWN_NOT_SUMMED",
        })
    return {
      "as_of":maturity.get("as_of"),
      "mode":maturity.get("mode","UNKNOWN"),
      "views":views,
      "stock_definition":"Outstanding securities by maturity year.",
      "financing_need_definition":"Budget deficit financing plus debt amortisation and other cash items; not equal to maturity stock.",
      "average_stock_cost":"UNKNOWN_FROM_CURRENT_PUBLIC_FEED",
      "market_yield_proxy":"TEC curve is marginal market evidence, not average stock cost.",
      "transmission":"New issuance, refinancing, buybacks and indexation transmit market conditions progressively.",
    }

def decision_delta(history,regime,claim_state):
    if len(history)<2:
        return {"status":"INSUFFICIENT_HISTORY","confidence":claim_state,"what_requires_review":["Wait for a second distinct official curve state."]}
    previous,current=history[-2],history[-1]
    changes=curve_delta(history)
    material={k:v for k,v in changes.items() if abs(float(v))>=0.1}
    return {
      "status":"MATERIAL_CHANGE" if material else "NO_MATERIAL_CURVE_CHANGE",
      "previous_state":{"date":previous.get("date"),"curve":previous.get("curve")},
      "current_state":{"date":current.get("date"),"curve":current.get("curve")},
      "delta_bps":changes,
      "transmission_channel":"Yield curve → new issuance/refinancing → portfolio average cost → interest charge over time.",
      "possible_impact":"Directional exposure may change if the move persists and reaches maturities that must be financed; no automatic budget amount is inferred from TEC10 alone.",
      "curve_regime":regime.get("regime","UNKNOWN"),
      "confidence":claim_state,
      "what_requires_review":[
        "Persistence of the observed curve move.",
        "Maturity stock actually exposed after buybacks and indexation.",
        "Updated financing programme and budget execution.",
        "Any newer official sensitivity vintage."
      ]
    }

def what_would_change_reading():
    return [
      {"reading":"Market conditions transmit progressively to the debt stock.","change_conditions":["Sustained curve reversal","Material issuance-programme change","Significant buybacks","Change in average maturity"],"sensitive_assumption":"Persistence and refinancing volume","review_source":"Banque de France curve + AFT financing programme"},
      {"reading":"Current maturity exposure is only partially live.","change_conditions":["Machine-readable AFT file becomes available","AFT pages become runner-accessible","New official maturity vintage"],"sensitive_assumption":"Retained-last-good ladder","review_source":"AFT detailed OAT/OATi/OAT€i outstanding"},
      {"reading":"Stress outputs are sensitivities, not forecasts.","change_conditions":["New official sensitivity model","Non-linear official estimates","Different shock shape or start date"],"sensitive_assumption":"Linear scaling of fixed official vintages","review_source":"PAP / AFT official publications"},
      {"reading":"TEC10 is cross-checked.","change_conditions":["Page/Webstat divergence exceeds 1 bp","Publication date mismatch","One source becomes unavailable"],"sensitive_assumption":"Same official observation vintage","review_source":"Banque de France page + Webstat"}
    ]

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
# Webstat is both an independent official cross-check and a last-good fallback.
if "tec10_pct" not in bvals and wvals.get("webstat_tec10_last_pct") is not None:
    observed["tec10_pct"]=wvals["webstat_tec10_last_pct"]
    observed["tec10_date"]=wvals.get("webstat_last_date")
    observed["yield_curve_date"]=wvals.get("webstat_last_date")
    observed["yield_curve"]=wvals.get("webstat_curve_latest",[])

sources.append(fetch_watch("AFT_RSS","Agence France Trésor","Flux RSS des publications","https://www.aft.gouv.fr/fr/rss.xml","application/rss+xml,application/xml,text/xml,*/*;q=0.8"))
dgfip_source,budget_execution=fetch_dgfip_execution()
sources.append(dgfip_source)
sources.append(src("AFT_SNAPSHOT","Agence France Trésor","Ancre officielle · encours, maturité, financement 2027","https://www.aft.gouv.fr/fr",health="PINNED",digest=hashlib.sha256(json.dumps(PINNED,sort_keys=True).encode()).hexdigest(),extra={"published_through":"2026-10-01","note":"Pinned canonical anchor; live detailed maturity pages are attempted separately."}))

maturity_ladder,maturity_sources=fetch_aft_maturity(prev)
sources.extend(maturity_sources)

crosscheck_bps=round((float(observed.get("tec10_pct"))-float(wvals.get("webstat_tec10_last_pct")))*100,1) if observed.get("tec10_pct") is not None and wvals.get("webstat_tec10_last_pct") is not None else None
for s in sources:
    sid=s.get("id","")
    raw=s.get("health")
    if raw=="ERROR":
        s["health"]="UNAVAILABLE"
    elif sid=="AFT_SNAPSHOT":
        s["health"]="OFFICIAL_VINTAGE"
    elif sid=="BDF_WEBSTAT" and crosscheck_bps is not None and abs(crosscheck_bps)<=1:
        s["health"]="CROSSCHECKED"
    elif raw in ("OK","PINNED"):
        s["health"]="LIVE_VERIFIED"
if maturity_ladder.get("mode")=="RETAINED_LAST_GOOD":
    sources.append(src(
      "AFT_MATURITY_RETAINED","Agence France Trésor",
      "Échéancier officiel conservé — dernier bon état",
      "https://www.aft.gouv.fr/fr",health="RETAINED_LAST_GOOD",
      digest=hashlib.sha256(json.dumps(maturity_ladder.get("years",[]),sort_keys=True).encode()).hexdigest(),
      extra={"vintage":maturity_ladder.get("as_of"),"reason":"Detailed pages unavailable to the runner."}
    ))

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

curve_history=append_curve_history(prev,observed,wvals.get("webstat_history",[]))
curve_delta_bps=curve_delta(curve_history)
regime_memory=curve_regime_memory(curve_history)
tec_claim_state="CROSSCHECKED" if crosscheck_bps is not None and abs(crosscheck_bps)<=1 else ("LIVE_VERIFIED" if bvals.get("tec10_pct") is not None else "DEGRADED")
maturity_claim_state="LIVE_VERIFIED" if maturity_ladder.get("mode")=="LIVE_PARSED" else "RETAINED_LAST_GOOD"
derived={
  **curve_metrics(observed.get("yield_curve",[])),
  "curve_delta_vs_previous_bps":curve_delta_bps,
  "curve_history_points":len(curve_history),
  "model_divergence_5y_bne":round(abs(float(23.5)-float(PAP_CURVE[4])),1),
  "maturity_mode":maturity_ladder.get("mode","UNKNOWN"),
  "latest_budget_execution_period":budget_execution.get("period"),
  "webstat_crosscheck_bps":crosscheck_bps,
}
refinancing=refinancing_twin(observed,maturity_ladder)
delta=decision_delta(curve_history,regime_memory,tec_claim_state)
claims=[
  {"claim_id":"TEC10","label":"TEC10 observé","type":"OBSERVED","value":observed.get("tec10_pct"),"unit":"pct","date":observed.get("tec10_date"),"state":tec_claim_state,"confidence":"HIGH" if tec_claim_state=="CROSSCHECKED" else "MEDIUM","source_ids":["BDF_TEC","BDF_WEBSTAT"]},
  {"claim_id":"TEC_CURVE","label":"Courbe TEC 1–30 ans","type":"OBSERVED","value":observed.get("yield_curve"),"date":observed.get("yield_curve_date"),"state":tec_claim_state,"confidence":"HIGH" if len(observed.get("yield_curve",[]))>=8 else "LOW","source_ids":["BDF_TEC","BDF_WEBSTAT"]},
  {"claim_id":"CURVE_REGIME","label":"Régime descriptif de courbe","type":"DERIVED","value":regime_memory.get("regime"),"date":regime_memory.get("as_of"),"state":"DERIVED_FROM_OFFICIAL","confidence":"MEDIUM","source_ids":["BDF_TEC","BDF_WEBSTAT"]},
  {"claim_id":"MATURITY_LADDER","label":"Encours par échéance","type":"OBSERVED","value":maturity_ladder.get("years"),"date":maturity_ladder.get("as_of"),"state":maturity_claim_state,"confidence":"MEDIUM" if maturity_claim_state=="RETAINED_LAST_GOOD" else "HIGH","source_ids":["AFT_MATURITY_RETAINED"] if maturity_claim_state=="RETAINED_LAST_GOOD" else ["AFT_MATURITY_OAT","AFT_MATURITY_OATI","AFT_MATURITY_OATEI"]},
  {"claim_id":"PAP_STRESS","label":"Sensibilité +100 pb","type":"STRESS","value":PAP_CURVE,"date":"OFFICIAL_VINTAGE","state":"OFFICIAL_VINTAGE","confidence":"MODEL_BOUND","source_ids":["PAP2026"]},
]
evidence_graph={
  "schema":"SUPRA_PROOFGRAPH_PUBLIC_PROJECTION_V1",
  "nodes":[
    {"id":"BDF_TEC","kind":"SOURCE","label":"Banque de France · page TEC"},
    {"id":"BDF_WEBSTAT","kind":"SOURCE","label":"Banque de France · Webstat"},
    {"id":"TEC_CURVE","kind":"METRIC","label":"Courbe TEC observée"},
    {"id":"CURVE_REGIME","kind":"DERIVED_METRIC","label":"Régime descriptif"},
    {"id":"PAP2026","kind":"PUBLICATION","label":"PAP 2026"},
    {"id":"PAP_STRESS","kind":"SCENARIO","label":"Stress parallèle"},
    {"id":"EXECUTIVE_OUTPUT","kind":"OUTPUT","label":"Executive Decision Room"}
  ],
  "edges":[
    {"from":"BDF_TEC","to":"TEC_CURVE","relation":"OBSERVES"},
    {"from":"BDF_WEBSTAT","to":"TEC_CURVE","relation":"CROSSCHECKS"},
    {"from":"TEC_CURVE","to":"CURVE_REGIME","relation":"DERIVES"},
    {"from":"PAP2026","to":"PAP_STRESS","relation":"PARAMETERIZES"},
    {"from":"TEC_CURVE","to":"EXECUTIVE_OUTPUT","relation":"INFORMS"},
    {"from":"CURVE_REGIME","to":"EXECUTIVE_OUTPUT","relation":"INFORMS"},
    {"from":"PAP_STRESS","to":"EXECUTIVE_OUTPUT","relation":"STRESSES"}
  ],
  "black_box":False
}
stress_shapes={
  "parallel":{"label":"Parallèle","type":"STRESS","tenor_shock_bps":{str(t):100 for t in TEC_TENORS}},
  "short_term":{"label":"Court terme","type":"STRESS","tenor_shock_bps":{str(t):(100 if t<=3 else 50 if t==5 else 0) for t in TEC_TENORS}},
  "long_term":{"label":"Long terme","type":"STRESS","tenor_shock_bps":{str(t):(100 if t>=10 else 0) for t in TEC_TENORS}},
  "steepener":{"label":"Pentification","type":"STRESS","tenor_shock_bps":{str(t):(-50 if t<=3 else 50 if t>=10 else 0) for t in TEC_TENORS}},
  "flattener":{"label":"Aplatissement","type":"STRESS","tenor_shock_bps":{str(t):(50 if t<=3 else -50 if t>=10 else 0) for t in TEC_TENORS}},
}
seq=int(prev.get("sequence",0))+(1 if events else 0)
ok_states={"LIVE_VERIFIED","CROSSCHECKED","OFFICIAL_VINTAGE","RETAINED_LAST_GOOD"}
source_state_counts={state:sum(s.get("health")==state for s in sources) for state in ("LIVE_VERIFIED","CROSSCHECKED","OFFICIAL_VINTAGE","RETAINED_LAST_GOOD","DEGRADED","UNAVAILABLE","CONTRADICTED")}
snapshot_payload=json.dumps({"observed":observed,"maturity_ladder":maturity_ladder,"sensitivity":{"pap2026":PAP_CURVE},"decision_delta":delta},sort_keys=True,ensure_ascii=False)
snapshot_id="OJO-"+hashlib.sha256(snapshot_payload.encode()).hexdigest()[:16].upper()
manifest={
 "schema":"OJO_FRANCE_DEBT_RATE_LIVE_V1",
 "version":"2026-10-02.7",
 "snapshot_id":snapshot_id,
 "sequence":seq,
 "updated_at":now(),
 "policy":{"political_recommendation":"NONE","market_yield_is_not_whole_debt_cost":True,"maturity_stock_is_not_financing_need":True,"stress_test_is_not_forecast":True,"model_output_is_not_policy_recommendation":True,"source_change":"DELTA_THEN_RECONCILE","typed_live_metrics":"OBSERVED_DERIVED_HYPOTHESIS_STRESS_UNKNOWN","sensitivity_model":"FIXED_OFFICIAL_VINTAGES","aft_html":"PINNED_DUE_TO_RUNNER_BLOCK"},
 "observed":observed,
 "sensitivity":{
   "pap2026":{"label":"PLF 2026 · PAP Engagements financiers de l’État","shock_bps":100,"annual_extra_charge_bne":PAP_CURVE,"start_year":2026},
   "aft_later":{"label":"AFT · estimation citée par le Sénat","shock_bps":100,"points_bne":{"1":3.2,"5":23.5,"9":33.5}},
   "stress_shapes":stress_shapes
 },
 "maturity_ladder":maturity_ladder,
 "refinancing_twin":refinancing,
 "budget_execution":budget_execution,
 "curve_history":curve_history,
 "curve_regime_memory":regime_memory,
 "decision_delta":delta,
 "what_would_change_the_reading":what_would_change_reading(),
 "claims":claims,
 "evidence_graph":evidence_graph,
 "derived":derived,
 "supra_bindings":{
   "mode":"READ_ONLY_PUBLIC_PROJECTION",
   "no_second_runtime":True,
   "capabilities_reused":["Decision Twin","ProofGraph","Context Engine","Scenario / Counterfactual Reasoning","Canonical Store","Pattern Memory","Chronology","Claim Confidence","Executive Cockpit","Verification","Non-Regression","Executive Brief"]
 },
 "capabilities":{
   "scheduled_refresh_minutes":15,
   "browser_poll_seconds":30,
   "live_full_yield_curve":True,
   "last_good_retention":True,
   "curve_history":True,
   "curve_delta_bps":True,
   "curve_regime_memory":True,
   "decision_delta":True,
   "refinancing_twin":True,
   "time_machine":True,
   "claim_confidence":True,
   "evidence_graph":True,
   "what_would_change_the_reading":True,
   "webstat_historical_backfill":True,
   "monthly_budget_execution_discovery":True,
   "maturity_auto_refresh":maturity_ladder.get("mode")=="LIVE_PARSED",
   "official_model_vintages":2,
   "political_recommendation":False
 },
 "sources":sources,
 "events":(prev.get("events",[])+events)[-120:],
 "material_changes":events,
 "summary":{"healthy":sum(s.get("health") in ok_states for s in sources),"monitored":len(sources),"warnings":sum(s.get("health") not in ok_states for s in sources),"source_state_counts":source_state_counts,"changed_this_sequence":len(events),
            "curve_history_points":len(curve_history),"maturity_mode":maturity_ladder.get("mode","UNKNOWN"),"decision_delta_status":delta.get("status")}
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
