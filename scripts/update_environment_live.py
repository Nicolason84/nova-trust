#!/usr/bin/env python3
from __future__ import annotations
import hashlib, html, json, math, re, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

OUT = Path("docs/data/environment-live.json")
UA = "OJO-Environment-Monitor/1.0 (+https://github.com/Nicolason84/nova-trust)"
MAX_BYTES = 8_000_000

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def parse_dt(x):
    if not x: return None
    try:
        if isinstance(x,(int,float)):
            return datetime.fromtimestamp(float(x)/1000, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
        s=str(x).strip()
        if re.fullmatch(r"\d{13}",s):
            return datetime.fromtimestamp(int(s)/1000, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
        if s.endswith("Z"):
            return datetime.fromisoformat(s.replace("Z","+00:00")).astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
        try:
            return parsedate_to_datetime(s).astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
        except Exception:
            return datetime.fromisoformat(s.replace(" ","T")).astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
    except Exception: return None

def fetch_bytes(url,accept="*/*",timeout=25):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":accept})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read(MAX_BYTES),getattr(r,"status",200),dict(r.headers.items())

def fetch_text(url,accept="text/html,application/xml,application/json,*/*"):
    b,status,h=fetch_bytes(url,accept)
    return b.decode("utf-8","replace"),status,h

def sha(s): return hashlib.sha256(s.encode("utf-8","replace")).hexdigest()
def local(tag): return str(tag).split("}")[-1].lower()
def event_id(prefix,*parts):
    raw="|".join(str(x or "") for x in parts)
    return prefix+":"+hashlib.sha1(raw.encode()).hexdigest()[:16]

def event(source_id,title,occurred_at=None,updated_at=None,severity="WATCH",scope="GLOBAL",
          domains=None,channels=None,location=None,url=None,evidence_type="SOURCE_EVENT",details=None):
    return {"id":event_id(source_id,title,occurred_at or ""),"source_id":source_id,"title":title[:500],
            "occurred_at":occurred_at,"updated_at":updated_at or occurred_at,"severity":severity,"scope":scope,
            "domains":domains or [],"impact_channels":channels or [],"location":location,"url":url,
            "evidence_type":evidence_type,"details":details or {}}

def centroid_coords(coords):
    pts=[]
    def walk(x):
        if isinstance(x,list) and len(x)>=2 and all(isinstance(v,(int,float)) for v in x[:2]): pts.append((float(x[0]),float(x[1])))
        elif isinstance(x,list):
            for y in x: walk(y)
    walk(coords)
    if not pts:return None
    return {"lon":sum(p[0] for p in pts)/len(pts),"lat":sum(p[1] for p in pts)/len(pts)}

def source_status(sid,publisher,url,scope,domain,health,status=None,error=None,checked_at=None,metrics=None,digest=None,cadence=None,access="OPEN"):
    return {"id":sid,"publisher":publisher,"url":url,"scope":scope,"domain":domain,"health":health,"http_status":status,
            "error":error,"checked_at":checked_at or now(),"metrics":metrics or {},"digest":digest,"cadence":cadence,"access":access}

def sev_from_alert(alert=None,mag=None,sig=None):
    a=(alert or "").lower()
    if a=="red":return "CRITICAL"
    if a=="orange":return "MATERIAL"
    if (mag or 0)>=7 or (sig or 0)>=1000:return "MATERIAL"
    return "WATCH"

def pull_usgs():
    sid="USGS_SIG";url="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";checked=now()
    try:
        txt,status,h=fetch_text(url,"application/json");j=json.loads(txt);out=[]
        for f in j.get("features",[])[:30]:
            p=f.get("properties",{});g=f.get("geometry") or {};c=g.get("coordinates") or [];title=p.get("title") or ("Earthquake "+str(f.get("id","")))
            loc={"name":p.get("place")}
            if len(c)>=2:loc.update({"lon":c[0],"lat":c[1]})
            out.append(event(sid,title,parse_dt(p.get("time")),parse_dt(p.get("updated")),sev_from_alert(p.get("alert"),p.get("mag"),p.get("sig")),"GLOBAL",
                ["SEISMIC","DISASTER"],["SUPPLY_CHAIN","INSURANCE","TRADE","INFRASTRUCTURE"],loc,p.get("url"),
                details={"mag":p.get("mag"),"alert":p.get("alert"),"sig":p.get("sig"),"tsunami":p.get("tsunami")}))
        return source_status(sid,"USGS",url,"GLOBAL","DISASTER","OK",status,checked_at=checked,metrics={"event_count":len(out)},digest=sha(txt),cadence="1m"),out
    except Exception as e:
        return source_status(sid,"USGS",url,"GLOBAL","DISASTER","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="1m"),[]

def pull_gdacs():
    sid="GDACS";url="https://www.gdacs.org/xml/rss.xml";checked=now()
    try:
        txt,status,h=fetch_text(url,"application/rss+xml,application/xml,text/xml");root=ET.fromstring(txt);out=[]
        for it in root.findall(".//item")[:50]:
            vals={}
            for ch in list(it):vals[local(ch.tag)]=(ch.text or "").strip()
            title=vals.get("title") or "GDACS event";alert=(vals.get("alertlevel") or "").lower();severity={"red":"CRITICAL","orange":"MATERIAL","green":"WATCH"}.get(alert,"WATCH")
            point=vals.get("point") or "";loc={"name":vals.get("country") or vals.get("isocountry")}
            m=re.match(r"\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)",point)
            if m:loc.update({"lat":float(m.group(1)),"lon":float(m.group(2))})
            et=(vals.get("eventtype") or "").upper()
            out.append(event(sid,title,parse_dt(vals.get("pubdate") or vals.get("fromdate")),parse_dt(vals.get("todate")),severity,"GLOBAL",
                ["DISASTER"]+([et] if et else []),["TRADE","SUPPLY_CHAIN","ENERGY","INSURANCE","INFRASTRUCTURE"],loc,vals.get("link"),
                details={"alert_level":alert or None,"event_type":et or None}))
        return source_status(sid,"GDACS (UN / European Commission)",url,"GLOBAL","DISASTER","OK",status,checked_at=checked,metrics={"event_count":len(out)},digest=sha(txt),cadence="6m"),out
    except Exception as e:
        return source_status(sid,"GDACS (UN / European Commission)",url,"GLOBAL","DISASTER","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="6m"),[]

def pull_vigicrues():
    sid="VIGICRUES";url="https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson";checked=now()
    try:
        txt,status,h=fetch_text(url,"application/geo+json,application/json");j=json.loads(txt);out=[];counts={"green":0,"yellow":0,"orange":0,"red":0};levels={1:("green","INFO"),2:("yellow","WATCH"),3:("orange","MATERIAL"),4:("red","CRITICAL")}
        for f in j.get("features",[]):
            p=f.get("properties",{});lvl=int(p.get("NivInfViCr") or 1);name=p.get("lbentcru") or p.get("acroentcru") or str(f.get("id",""));color,severity=levels.get(lvl,("unknown","WATCH"));counts[color]=counts.get(color,0)+1
            if lvl<2:continue
            loc={"name":name};cen=centroid_coords((f.get("geometry") or {}).get("coordinates"))
            if cen:loc.update(cen)
            out.append(event(sid,f"Vigicrues {name} — niveau {color}",updated_at=checked,severity=severity,scope="FR_LOCAL",domains=["FLOOD","CLIMATE"],
                channels=["LOCAL_SERVICES","TRANSPORT","INFRASTRUCTURE","PUBLIC_SPENDING"],location=loc,url="https://www.vigicrues.gouv.fr/",details={"level":lvl,"color":color,"entity_code":p.get("CdEntCru")}))
        return source_status(sid,"Vigicrues / Ministère de la Transition écologique",url,"FR_LOCAL","CLIMATE","OK",status,checked_at=checked,metrics={"active_non_green":len(out),"levels":counts},digest=sha(txt),cadence="near-real-time"),out
    except Exception as e:
        return source_status(sid,"Vigicrues / Ministère de la Transition écologique",url,"FR_LOCAL","CLIMATE","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="near-real-time"),[]

ROAD_URL="https://www.data.gouv.fr/api/1/datasets/r/5f814261-10d8-4b46-bcc1-e847b28a473f"
def first_desc_text(node,names):
    names=set(n.lower() for n in names)
    for el in node.iter():
        if local(el.tag) in names and (el.text or "").strip():return re.sub(r"\s+"," ",(el.text or "").strip())
    return None

def pull_roads():
    sid="BISON_FUTE_RRN";checked=now()
    try:
        txt,status,h=fetch_text(ROAD_URL,"application/xml,text/xml");root=ET.fromstring(txt);records=[]
        for el in root.iter():
            if local(el.tag)=="situationrecord" or local(el.tag) in {"accident","roadworks","generalobstruction","networkmanagement","abnormaltraffic","poorroadinfrastructure","environmentalobstruction","nonweatherrelatedroadconditions"}:records.append(el)
        out=[]
        for rec in records[:250]:
            typ=next((str(v).split(":")[-1].lower() for k,v in rec.attrib.items() if local(k)=="type"),local(rec.tag));rid=rec.attrib.get("id") or rec.attrib.get("version") or first_desc_text(rec,["situationRecordId","id"]);comment=first_desc_text(rec,["comment","value","locationDescriptor","roadName","roadNumber"]);town=first_desc_text(rec,["town","municipality","city"]);lat=first_desc_text(rec,["latitude"]);lon=first_desc_text(rec,["longitude"]);text=(comment or typ).lower();sev="MATERIAL" if any(k in text for k in ["fermé","closure","blocked","accident","danger","coupure"]) or typ=="accident" else "WATCH";loc={"name":town or comment}
            try:
                if lat and lon:loc.update({"lat":float(lat),"lon":float(lon)})
            except Exception:pass
            start=first_desc_text(rec,["overallStartTime","startTime"])
            out.append(event(sid,f"Réseau routier national — {typ}: {comment or rid or 'événement'}",parse_dt(start),checked,sev,"FR_LOCAL",["TRANSPORT","ROAD"],["LOGISTICS","LOCAL_SERVICES","SUPPLY_CHAIN"],loc,
                "https://transport.data.gouv.fr/datasets/evenements-routiers-sur-le-reseau-routier-national-non-concede",details={"type":typ,"record_id":rid}))
        return source_status(sid,"Bison Futé / transport.data.gouv.fr",ROAD_URL,"FR_LOCAL","TRANSPORT","OK",status,checked_at=checked,metrics={"parsed_event_count":len(out)},digest=sha(txt),cadence="real-time/hourly aggregate"),out
    except Exception as e:
        return source_status(sid,"Bison Futé / transport.data.gouv.fr",ROAD_URL,"FR_LOCAL","TRANSPORT","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="real-time/hourly aggregate"),[]

class LinkParser(HTMLParser):
    def __init__(self):super().__init__();self.current=None;self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="a":
            href=dict(attrs).get("href","")
            if "disease-outbreak-news/item/" in href:self.current={"href":href,"text":[]}
    def handle_data(self,data):
        if self.current:self.current["text"].append(data)
    def handle_endtag(self,tag):
        if tag.lower()=="a" and self.current:
            text=re.sub(r"\s+"," "," ".join(self.current["text"])).strip()
            if text:self.links.append((self.current["href"],text))
            self.current=None

def pull_who():
    sid="WHO_HEALTH_RSS";url="https://www.who.int/rss-feeds/news-english.xml";checked=now()
    keys=("outbreak","disease","emergency","cholera","mpox","ebola","influenza","pandemic","virus","public health")
    try:
        txt,status,h=fetch_text(url,"application/rss+xml,text/xml");items=rss_items(txt,80);out=[]
        for x in items:
            title=x.get("title") or "";desc=x.get("description") or ""
            if not any(k in (title+" "+desc).lower() for k in keys):continue
            out.append(event(sid,title,parse_dt(x.get("pubdate")),severity="WATCH",scope="GLOBAL",domains=["HEALTH"],channels=["HEALTH_SPENDING","TRAVEL","TRADE","SUPPLY_CHAIN"],url=x.get("link"),details={"description":re.sub(r"<[^>]+>"," ",desc)[:500],"note":"WHO news signal; verify Disease Outbreak News for event-specific conclusions."}))
        return source_status(sid,"World Health Organization",url,"GLOBAL","HEALTH","OK",status,checked_at=checked,metrics={"relevant_items":len(out)},digest=sha(txt),cadence="publication-driven"),out
    except Exception as e:
        return source_status(sid,"World Health Organization",url,"GLOBAL","HEALTH","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="publication-driven"),[]

def rss_items(txt,limit=40):
    root=ET.fromstring(txt);out=[]
    for it in root.findall(".//item")[:limit]:
        d={}
        for ch in list(it):d[local(ch.tag)]=(ch.text or "").strip()
        out.append(d)
    return out
EU_KEYS=("econom","financ","energy","transport","trade","sanction","defence","security","ukrain","russia","iran","middle east","tariff","budget","tax","climate","emergency","customs")
def pull_consilium():
    sid="EU_COUNCIL_RSS";url="https://www.consilium.europa.eu/en/rss/pressreleases.ashx";checked=now()
    try:
        txt,status,h=fetch_text(url,"application/rss+xml,text/xml");items=rss_items(txt,60);out=[]
        for x in items:
            title=x.get("title") or "";desc=x.get("description") or ""
            if not any(k in (title+" "+desc).lower() for k in EU_KEYS):continue
            out.append(event(sid,title,parse_dt(x.get("pubdate")),severity="WATCH",scope="EU",domains=["EU_INSTITUTIONAL","GEOPOLITICS"],channels=["TRADE","ENERGY","FINANCE","DEFENCE","REGULATION"],location={"name":"European Union"},url=x.get("link"),details={"description":re.sub(r"<[^>]+>"," ",desc)[:500]}))
        return source_status(sid,"Council of the EU / European Council",url,"EU","GEOPOLITICS","OK",status,checked_at=checked,metrics={"relevant_items":len(out)},digest=sha(txt),cadence="publication-driven"),out
    except Exception as e:
        return source_status(sid,"Council of the EU / European Council",url,"EU","GEOPOLITICS","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="publication-driven"),[]

RTE_URLS=["https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records?limit=1&where=consommation%20is%20not%20null&order_by=date_heure%20DESC","https://opendata.reseaux-energies.fr/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records?limit=1&where=consommation%20is%20not%20null&order_by=date_heure%20DESC"]
def pull_rte():
    sid="RTE_ECO2MIX";checked=now();last_err=None
    for url in RTE_URLS:
        try:
            txt,status,h=fetch_text(url,"application/json");j=json.loads(txt);rec=(j.get("results") or [{}])[0];metrics={}
            for k in ["date_heure","consommation","prevision_j","prevision_j1","taux_co2","ech_physiques"]:
                if k in rec:metrics[k]=rec.get(k)
            return source_status(sid,"RTE / Open Data Réseaux Énergies",url,"FR","ENERGY","OK",status,checked_at=checked,metrics=metrics,digest=sha(txt),cadence="15m"),[]
        except Exception as e:last_err=e
    return source_status(sid,"RTE / Open Data Réseaux Énergies",RTE_URLS[0],"FR","ENERGY","ERROR",getattr(last_err,"code",None),str(last_err)[:300],checked,cadence="15m"),[]

def pull_ecb():
    sid="ECB_FX";url="https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=2&format=csvdata";checked=now()
    try:
        txt,status,h=fetch_text(url,"text/csv");lines=[x for x in txt.splitlines() if x.strip()];metrics={"rows":max(0,len(lines)-1)}
        if len(lines)>=2:
            hdr=lines[0].split(",");vals=lines[-1].split(",")
            if len(hdr)==len(vals):
                row=dict(zip(hdr,vals));metrics.update({"time_period":row.get("TIME_PERIOD"),"obs_value":row.get("OBS_VALUE")})
        return source_status(sid,"European Central Bank",url,"EU","FINANCE","OK",status,checked_at=checked,metrics=metrics,digest=sha(txt),cadence="daily"),[]
    except Exception as e:
        return source_status(sid,"European Central Bank",url,"EU","FINANCE","ERROR",getattr(e,"code",None),str(e)[:300],checked,cadence="daily"),[]

AUTH_CANDIDATES=[
 {"id":"METEO_VIGILANCE","publisher":"Météo-France","scope":"FR_LOCAL","domain":"CLIMATE","status":"AUTH_REQUIRED","access":"Account on API portal","limit":"60 req/min","reason":"Official vigilance JSON requires an authorized Météo-France API account.","secret_handling":"Store token as GitHub Secret; never commit it."},
 {"id":"GEORISQUES_V2","publisher":"Géorisques","scope":"FR_LOCAL","domain":"RISKS","status":"AUTH_REQUIRED","access":"Cerbère or FranceConnect token","reason":"v2 endpoints require a token; v1 remains available without token.","secret_handling":"Store token as GitHub Secret; never commit it."},
 {"id":"LEGIFRANCE_PISTE","publisher":"DILA / PISTE","scope":"FR","domain":"LAW","status":"AUTH_REQUIRED","access":"PISTE OAuth2 client credentials","reason":"Production API requires PISTE registration, CGU acceptance, client_id and client_secret.","secret_handling":"Use GitHub Secrets and OAuth client_credentials server-side."},
 {"id":"RELIEFWEB","publisher":"UN OCHA","scope":"GLOBAL","domain":"HUMANITARIAN","status":"AUTH_REQUIRED","access":"Pre-approved appname","reason":"Since 1 Nov 2025 ReliefWeb requires a pre-approved appname.","secret_handling":"Obtain approval before use."},
 {"id":"INSEE_CATALOG_APIS","publisher":"Insee","scope":"FR_LOCAL","domain":"STATISTICS","status":"OPTIONAL_AUTH","access":"Depending on API / subscription","reason":"BDM/SDMX is already used; Melodi, local data and metadata APIs can enrich later."}
]
SUGGESTION_RULES={
 "ENERGY":{"title":"Recalculer le stress énergie","action":"Mettre à jour uniquement les sensibilités énergie/inflation/activité; ne pas réécrire le scénario budgétaire de référence sans réconciliation institutionnelle.","needs":["RTE","Banque de France","ECB/Eurostat"]},
 "CLIMATE":{"title":"Ouvrir l’exposition territoriale","action":"Croiser l’événement avec l’exposition locale, les infrastructures et la durée avant d’estimer un impact budgétaire.","needs":["Vigicrues","Géorisques/Météo-France si autorisés"]},
 "TRANSPORT":{"title":"Tester la continuité logistique","action":"Mesurer zone, durée et axes touchés; distinguer gêne locale et effet macro avant toute extrapolation.","needs":["Bison Futé","transport.data.gouv.fr"]},
 "HEALTH":{"title":"Ouvrir un scénario santé conditionnel","action":"Surveiller diffusion Europe/France et signaux sanitaires; un DON de l’OMS n’est pas une incidence française.","needs":["WHO","ECDC/France santé publique si connecté"]},
 "GEOPOLITICS":{"title":"Tracer les canaux de transmission","action":"Tester séparément énergie, commerce, défense, change et taux. L’événement géopolitique n’a pas d’impact budgétaire automatique.","needs":["Conseil UE","ECB","RTE","GDACS"]},
 "DISASTER":{"title":"Qualifier l’exposition France/Europe","action":"Évaluer les liens commerce, approvisionnement, assurance et énergie avant de modifier une hypothèse française.","needs":["GDACS","USGS","RTE/Eurostat selon le canal"]},
 "FINANCE":{"title":"Rafraîchir le scénario financier","action":"Comparer change/taux et nouvelles projections avec la référence; conserver la distinction donnée observée / prévision / cible.","needs":["ECB","Banque de France","Insee"]}
}
def build_suggestions(new_events):
    domains=set()
    for e in new_events:
        domains.update(e.get("domains") or []);domains.update(e.get("impact_channels") or [])
    mapped=[]
    if "ENERGY" in domains:mapped.append("ENERGY")
    if any(x in domains for x in ["FLOOD","CLIMATE"]):mapped.append("CLIMATE")
    if any(x in domains for x in ["TRANSPORT","ROAD","LOGISTICS"]):mapped.append("TRANSPORT")
    if "HEALTH" in domains:mapped.append("HEALTH")
    if any(x in domains for x in ["GEOPOLITICS","EU_INSTITUTIONAL","DEFENCE","REGULATION"]):mapped.append("GEOPOLITICS")
    if any(x in domains for x in ["DISASTER","SEISMIC"]):mapped.append("DISASTER")
    if "FINANCE" in domains:mapped.append("FINANCE")
    out=[]
    for k in dict.fromkeys(mapped):
        x=SUGGESTION_RULES[k];out.append({"id":"SUG_"+k,"domain":k,"title":x["title"],"action":x["action"],"evidence_needed":x["needs"],"nature":"ANALYTICAL_NEXT_STEP_NOT_POLITICAL_RECOMMENDATION"})
    if not out:out.append({"id":"SUG_STABLE","domain":"SYSTEM","title":"Aucune action analytique déclenchée","action":"Continuer la surveillance; ne pas recalculer sans delta matériel.","evidence_needed":[],"nature":"ANALYTICAL_NEXT_STEP_NOT_POLITICAL_RECOMMENDATION"})
    return out

def main():
    try:prev=json.loads(OUT.read_text())
    except Exception:prev={}
    previous_ids={e.get("id") for e in prev.get("events",[]) if isinstance(e,dict)}
    pulls=[pull_usgs,pull_gdacs,pull_vigicrues,pull_roads,pull_who,pull_consilium,pull_rte,pull_ecb];sources=[];current=[]
    for fn in pulls:
        s,evs=fn();sources.append(s);current.extend(evs)
    ded={}
    for e in current:ded[e["id"]]=e
    current=list(ded.values());new=[e for e in current if e["id"] not in previous_ids];boot=not bool(prev.get("sequence"))
    hist=(prev.get("events",[])+new)[-250:]
    manifest={"schema":"OJO_ENVIRONMENT_LIVE_V1","version":"2026-09-21","sequence":int(prev.get("sequence",0))+1,"updated_at":now(),
      "policy":{"event_is_not_impact":"An event is a signal. Impact requires an explicit transmission channel and evidence.","canonical_mutation":"NEVER_FROM_EVENT_ALONE","location":"No precise user location is stored server-side. Local filtering is client-side opt-in.","political_recommendation":"NONE"},
      "summary":{"sources":len(sources),"healthy":sum(s["health"]=="OK" for s in sources),"errors":sum(s["health"]!="OK" for s in sources),"current_events":len(current),"new_events":0 if boot else len(new)},
      "sources":sources,"auth_candidates":AUTH_CANDIDATES,"current_events":current[-150:],"new_events":[] if boot else new[-80:],"events":hist,"suggestions":build_suggestions(([] if boot else new) or [e for e in current if e.get("severity") in {"MATERIAL","CRITICAL"}][:30])}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":"WROTE","sequence":manifest["sequence"],"healthy":manifest["summary"]["healthy"],"errors":manifest["summary"]["errors"],"current_events":len(current),"new_events":manifest["summary"]["new_events"]}))

if __name__=="__main__":main()
