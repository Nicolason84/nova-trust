#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, urllib.request
from datetime import datetime, timezone
from pathlib import Path

TOPO=Path("docs/data/france-topology.json")
ORG=Path("docs/data/organism-state.json")
ENV=Path("docs/data/environment-live.json")
OUT=Path("docs/data/france-organism.json")
UA="OJO-France-Organism/1.0 (+https://github.com/Nicolason84/nova-trust)"

REGIONS_URL="https://geo.api.gouv.fr/regions"
DEPARTMENTS_URL="https://geo.api.gouv.fr/departements"
EPCI_URL="https://geo.api.gouv.fr/epcis?fields=nom,code,codesRegions,codesDepartements,population,type,financement"
COMMUNES_URL="https://geo.api.gouv.fr/communes?fields=nom,code,population,codeDepartement,codeRegion,codeEpci"
COG_COMMUNES_URL="https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv"
OFFICIAL_COUNTS={"regions":18,"departments":101,"epcis":1252,"communes":34875}

SYSTEMS=["macro","budget","energy","finance","logistics","climate","health","geopolitics"]

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def load(path, default):
    try:return json.loads(path.read_text())
    except:return default

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=45) as r:
        return json.loads(r.read().decode("utf-8"))

def fetch_cog_commune_codes():
    req=urllib.request.Request(COG_COMMUNES_URL,headers={"User-Agent":UA,"Accept":"text/csv,*/*"})
    with urllib.request.urlopen(req,timeout=45) as r:
        raw=r.read().decode("utf-8-sig")
    try:
        dialect=csv.Sniffer().sniff(raw[:8192],delimiters=",;\t")
    except:
        dialect=csv.excel
    rows=csv.DictReader(io.StringIO(raw),dialect=dialect)
    codes=set()
    for row in rows:
        if str(row.get("TYPECOM","")).strip()=="COM":
            code=str(row.get("COM","")).strip()
            if code: codes.add(code)
    return codes

def ensure_topology():
    old=load(TOPO,{})
    stamp=old.get("generated_at")
    if stamp:
        try:
            t=datetime.fromisoformat(stamp.replace("Z","+00:00"))
            age=(datetime.now(timezone.utc)-t).total_seconds()
            if age<86400 and old.get("schema")=="OJO_FRANCE_TOPOLOGY_V2" and old.get("regions") and old.get("official_communes_count")==OFFICIAL_COUNTS["communes"]:
                return old
        except: pass

    regions=fetch(REGIONS_URL)
    deps=fetch(DEPARTMENTS_URL)
    epcis=fetch(EPCI_URL)
    communes_raw=fetch(COMMUNES_URL)
    official_commune_codes=fetch_cog_commune_codes()
    communes=[c for c in communes_raw if str(c.get("code") or "") in official_commune_codes]

    reg={str(x["code"]):{
        "code":str(x["code"]),
        "name":x["nom"],
        "population":0,
        "departments":0,
        "epcis":0,
        "communes":0
    } for x in regions}

    for d in deps:
        code=str(d.get("codeRegion") or d.get("region",{}).get("code") or "")
        if code in reg: reg[code]["departments"]+=1

    for e in epcis:
        codes=e.get("codesRegions") or []
        for code in set(map(str,codes)):
            if code in reg: reg[code]["epcis"]+=1

    for c in communes:
        code=str(c.get("codeRegion") or "")
        if code in reg:
            reg[code]["communes"]+=1
            pop=c.get("population")
            if isinstance(pop,(int,float)): reg[code]["population"]+=int(pop)

    topo={
      "schema":"OJO_FRANCE_TOPOLOGY_V2",
      "generated_at":now(),
      "sources":[
        {"name":"API Découpage administratif","publisher":"Etalab / data.gouv.fr","url":"https://geo.api.gouv.fr/decoupage-administratif"},
        {"name":"COG 2026","publisher":"Insee","url":"https://www.insee.fr/fr/information/8740222","commune_csv":COG_COMMUNES_URL},
        {"name":"Collectivités locales en chiffres 2026","publisher":"DGCL","url":"https://www.collectivites-locales.gouv.fr/les-collectivites-locales-en-chiffres-2026"}
      ],
      "counts":OFFICIAL_COUNTS,
      "api_record_counts":{
        "regions":len(regions),
        "departments":len(deps),
        "epcis":len(epcis),
        "communes_raw":len(communes_raw),
        "communes_cog_filtered":len(communes)
      },
      "regions":sorted(reg.values(),key=lambda x:x["code"]),
      "departments_count":len(deps),
      "epcis_count":len(epcis),
      "communes_count":len(communes),
      "official_communes_count":len(official_commune_codes),
      "model_note":"Administrative topology is descriptive. Special territorial arrangements must remain explicit rather than being forced into a uniform hierarchy."
    }
    TOPO.parent.mkdir(parents=True,exist_ok=True)
    TOPO.write_text(json.dumps(topo,ensure_ascii=False,indent=2)+"\n")
    return topo

def main():
    topo=ensure_topology()
    organism=load(ORG,{})
    env=load(ENV,{})
    state=organism.get("state",{})
    arms=state.get("arms",{})

    # France is the body; previous organism becomes transverse physiology.
    regions=[]
    total_pop=sum(r.get("population",0) for r in topo.get("regions",[])) or 1
    for r in topo.get("regions",[]):
        regions.append({
          **r,
          "population_share":round(r.get("population",0)/total_pop,6),
          "state":"OBSERVED",
          "local_pressure":"UNRESOLVED",
          "systems":{k:round(float(arms.get(k,0)),4) for k in SYSTEMS},
          "truth":"No region-specific pressure is inferred without territorially resolved evidence."
        })

    out={
      "schema":"OJO_FRANCE_ORGANISM_V1",
      "version":"2026-09-21",
      "updated_at":now(),
      "identity":{
        "name":"France",
        "type":"DISTRIBUTED_TERRITORIAL_ORGANISM",
        "metaphor":{
          "body":"France",
          "major_organs":"regions",
          "sub_organs":"departments",
          "functional_tissues":"EPCI",
          "cells":"communes",
          "transverse_systems":SYSTEMS
        }
      },
      "topology":{
        "source_generated_at":topo.get("generated_at"),
        "counts":topo.get("counts",{}),
        "regions":regions
      },
      "physiology":{
        "regime":state.get("regime"),
        "strain":state.get("strain"),
        "vigilance":state.get("vigilance"),
        "heart_rate_visual":state.get("heart_rate_visual"),
        "respiration_visual":state.get("respiration_visual"),
        "sensor_health":state.get("sensor_health"),
        "systems":{k:round(float(arms.get(k,0)),4) for k in SYSTEMS},
        "learning":organism.get("learning",{}),
        "control_readiness":organism.get("control_readiness",{})
      },
      "environment":{
        "sequence":env.get("sequence"),
        "summary":env.get("summary",{}),
        "note":"External events remain signals until a territorial transmission path is resolved."
      },
      "constitutional_rules":[
        "Territorial structure is observed, not simplified for visual convenience.",
        "Event is not impact.",
        "National signal is not automatically a regional signal.",
        "No region is ranked or politically scored.",
        "Policy choices remain human; the organism may expose evidence, dependencies, stress and uncertainty."
      ],
      "next_resolution":{
        "territorial_event_binding":"PENDING",
        "region_specific_systems":"PENDING",
        "department_epci_commune_drilldown":"TOPOLOGY_READY",
        "historical_backtest":"PENDING"
      }
    }
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":"WROTE","regions":len(regions),"counts":out["topology"]["counts"]}))

if __name__=="__main__":
    main()
