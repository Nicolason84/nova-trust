#!/usr/bin/env python3
from __future__ import annotations
import json, math, statistics
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BUD=Path("docs/data/budget-2027-live.json")
ENV=Path("docs/data/environment-live.json")
OUT=Path("docs/data/organism-state.json")
MAX_HISTORY=672

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def clamp(x,a=0.0,b=1.0):
    return max(a,min(b,float(x)))

def load(p,default):
    try:return json.loads(p.read_text())
    except:return default

def recent_weight(ts,hours=72):
    if not ts:return .35
    try:
        t=datetime.fromisoformat(str(ts).replace("Z","+00:00")).astimezone(timezone.utc)
        age=max(0,(datetime.now(timezone.utc)-t).total_seconds()/3600)
        if age<=6:return 1.0
        if age<=24:return .7
        if age<=72:return .35
        return .08
    except:return .25

SEV={"CRITICAL":1.0,"MATERIAL":.62,"WATCH":.12,"INFO":.05}
SCOPE={"FR":1.0,"FR_LOCAL":.45,"EU":.55,"GLOBAL":.32}
DOMAIN_ARM={
 "ENERGY":"energy","FINANCE":"finance","TRANSPORT":"logistics","ROAD":"logistics","LOGISTICS":"logistics",
 "FLOOD":"climate","CLIMATE":"climate","DISASTER":"climate","SEISMIC":"climate",
 "HEALTH":"health","GEOPOLITICS":"geopolitics","EU_INSTITUTIONAL":"geopolitics","DEFENCE":"geopolitics","REGULATION":"geopolitics",
 "TRADE":"geopolitics","SUPPLY_CHAIN":"logistics","INFRASTRUCTURE":"logistics","PUBLIC_SPENDING":"budget"
}
ARMS=["macro","budget","energy","finance","logistics","climate","health","geopolitics"]

def source_health(env,bud):
    es=env.get("summary",{});bs=bud.get("summary",{})
    total=(es.get("sources",0) or 0)+(bs.get("monitored",0) or 0)
    healthy=(es.get("healthy",0) or 0)+(bs.get("healthy",0) or 0)
    return healthy/total if total else 0

def event_pressures(env):
    vals={k:0.0 for k in ARMS}
    current=env.get("current_events",[])
    for e in current:
        sev=SEV.get(e.get("severity"),.08)
        sc=SCOPE.get(e.get("scope"),.3)
        rec=recent_weight(e.get("occurred_at") or e.get("updated_at"))
        base=sev*sc*rec
        tags=set((e.get("domains") or [])+(e.get("impact_channels") or []))
        touched=set()
        for t in tags:
            arm=DOMAIN_ARM.get(str(t).upper())
            if arm:touched.add(arm)
        if not touched:continue
        for arm in touched:
            vals[arm]+=base/max(1,len(touched))*.42
    return {k:clamp(v) for k,v in vals.items()}

def current_state(prev):
    env=load(ENV,{})
    bud=load(BUD,{})
    arms=event_pressures(env)

    # Budget / evidence nervous system.
    bsum=bud.get("summary",{})
    budget_delta=clamp((bsum.get("changed_this_sequence",0) or 0)/3)
    b_errors=clamp((bsum.get("errors",0) or 0)/max(1,bsum.get("monitored",1) or 1))
    arms["budget"]=clamp(max(arms["budget"],.55*budget_delta+.25*b_errors))

    # Macro reflects budget-source change and national macro feeds, but does not pretend to be a macro model.
    macro_changed=sum(1 for e in bud.get("material_changes",[]) if e.get("organ")=="MACRO")
    arms["macro"]=clamp(max(arms["macro"],.32*min(1,macro_changed)))

    # RTE surprise is an observed short-horizon physiological input, not a policy impact.
    rte=next((s for s in env.get("sources",[]) if s.get("id")=="RTE_ECO2MIX"),None) or {}
    m=rte.get("metrics") or {}
    cons=m.get("consommation");pred=m.get("prevision_j")
    if isinstance(cons,(int,float)) and isinstance(pred,(int,float)) and pred:
        surprise=clamp(abs(cons-pred)/abs(pred)*8)
        arms["energy"]=clamp(max(arms["energy"],surprise))

    health=source_health(env,bud)
    blind=clamp(1-health)
    if blind>.2:
        arms["macro"]=clamp(arms["macro"]+.2*blind)
        arms["finance"]=clamp(arms["finance"]+.15*blind)

    vals=list(arms.values())
    strain=clamp(.16*arms["macro"]+.17*arms["budget"]+.14*arms["energy"]+.10*arms["finance"]+
                 .12*arms["logistics"]+.10*arms["climate"]+.08*arms["health"]+.13*arms["geopolitics"])
    vigilance=max(vals) if vals else 0
    asym=statistics.pstdev(vals) if len(vals)>1 else 0
    active=sum(v>.32 for v in vals)
    heart=round(48+76*strain+12*vigilance)
    respiration=round(7+18*(.55*strain+.45*vigilance),1)
    contraction=round(clamp(.12+.72*strain),3)
    luminance=round(clamp(.78-.48*strain+.12*(1-blind)),3)

    hist=(prev.get("history",[]) if isinstance(prev,dict) else [])
    prior=hist[-1] if hist else None
    prev_strain=float(prior.get("strain",strain)) if prior else strain
    top_arm=max(arms,key=arms.get)

    if blind>=.35:regime="BLIND_SPOT"
    elif strain>=.68 or vigilance>=.88:regime="SHOCK"
    elif prior and prev_strain>=.52 and strain<=.34:regime="RECOVERY"
    elif strain>=.46:regime="STRESS"
    elif strain>=.23 or vigilance>=.42:regime="VIGILANT"
    else:regime="CALM"

    return env,bud,{"ts":now(),"strain":round(strain,4),"vigilance":round(vigilance,4),"asymmetry":round(asym,4),
                    "arms":{k:round(v,4) for k,v in arms.items()},"regime":regime,"top_arm":top_arm,
                    "heart_rate_visual":heart,"respiration_visual":respiration,"contraction":contraction,
                    "luminance":luminance,"sensor_health":round(health,4),"blindness":round(blind,4),"active_arms":active}

def autocorr1(xs):
    if len(xs)<4:return None
    a=xs[:-1];b=xs[1:];ma=sum(a)/len(a);mb=sum(b)/len(b)
    da=sum((x-ma)**2 for x in a);db=sum((x-mb)**2 for x in b)
    if da<=1e-12 or db<=1e-12:return 0.0
    return sum((x-ma)*(y-mb) for x,y in zip(a,b))/math.sqrt(da*db)

def slope(xs):
    n=len(xs)
    if n<2:return 0
    mx=(n-1)/2;my=sum(xs)/n
    den=sum((i-mx)**2 for i in range(n))
    return sum((i-mx)*(y-my) for i,y in enumerate(xs))/den if den else 0

def motifs(history):
    out=[]
    n=len(history)
    if not n:return out
    cur=history[-1];arms=cur.get("arms",{})
    hot=[k for k,v in arms.items() if v>=.42]
    if len(hot)>=3:out.append({"id":"SYNCHRONIZED_ACTIVATION","label":"Activation synchronisée","status":"ACTIVE","evidence":hot,"meaning":"Plusieurs systèmes s'activent dans le même battement; coactivation ne prouve pas causalité."})
    if arms:
        k=max(arms,key=arms.get)
        if arms[k]>=.66:out.append({"id":"LOCAL_OVERLOAD","label":"Surcharge localisée","status":"ACTIVE","evidence":[k],"meaning":"Un bras domine nettement le corps."})
    if n>=4:
        tops=[h.get("top_arm") for h in history[-4:]]
        if len(set(tops))==1 and sum(h.get("arms",{}).get(tops[0],0) for h in history[-4:])/4>=.30:
            out.append({"id":"PERSISTENT_DRIVER","label":"Conducteur persistant","status":"ACTIVE","evidence":[tops[0]],"meaning":"Le même domaine domine quatre états consécutifs."})
    if n>=2:
        p=history[-2].get("strain",0);c=history[-1].get("strain",0)
        if p>=.5 and c<=p-.15:out.append({"id":"REBOUND","label":"Décompression / récupération","status":"ACTIVE","evidence":[round(p,3),round(c,3)],"meaning":"La tension baisse fortement après un état élevé."})
    return out

def warning_signal(history):
    xs=[float(h.get("strain",0)) for h in history]
    if len(xs)<16:return {"status":"CALIBRATION","samples":len(xs),"note":"Au moins 16 états requis avant même un signal exploratoire."}
    a=xs[-8:];b=xs[-16:-8]
    va=statistics.pvariance(a);vb=statistics.pvariance(b)
    ac=autocorr1(a);sl=slope(a)
    candidate=(va>vb*1.35 and (ac or 0)>.45 and sl>0)
    return {"status":"CANDIDATE" if candidate else "NO_GENERIC_WARNING","samples":len(xs),
            "variance_recent":round(va,6),"variance_previous":round(vb,6),"lag1_autocorr_recent":None if ac is None else round(ac,4),
            "slope_recent":round(sl,6),"note":"Signal générique exploratoire seulement; variance/autocorrélation ne suffisent pas à prédire une transition."}

def prediction(history):
    xs=[float(h.get("strain",0)) for h in history]
    n=len(xs)
    if n<8:return {"status":"CALIBRATION","samples":n,"next":None,"horizon_4":None}
    w=xs[-min(16,n):]
    sl=slope(w)
    ew=w[0]
    alpha=.35
    for x in w[1:]:ew=alpha*x+(1-alpha)*ew
    one=clamp(ew+sl);four=clamp(ew+4*sl)
    diffs=[xs[i]-xs[i-1] for i in range(max(1,n-16),n)]
    sigma=statistics.pstdev(diffs) if len(diffs)>1 else .05
    return {"status":"EXPLORATORY","samples":n,"next":round(one,4),"horizon_4":round(four,4),
            "band":round(clamp(1.64*sigma,0,.5),4),"note":"Projection de dynamique du score visuel, pas une prévision économique."}

def transitions(history):
    c=Counter()
    for a,b in zip(history,history[1:]):
        c[(a.get("regime"),b.get("regime"))]+=1
    return [{"from":k[0],"to":k[1],"count":v} for k,v in c.most_common(8)]

def stage(n):
    if n<8:return "BOOTSTRAP"
    if n<32:return "CALIBRATION"
    if n<96:return "EARLY_LEARNING"
    if n<384:return "LEARNING"
    return "PATTERN_LIBRARY"

def main():
    prev=load(OUT,{})
    env,bud,snap=current_state(prev)
    history=(prev.get("history",[]) if isinstance(prev,dict) else [])
    # Event-driven dedup: only append a genuinely new combined source sequence.
    source_seq=f"{bud.get('sequence','?')}:{env.get('sequence','?')}"
    if not history or history[-1].get("source_seq")!=source_seq:
        snap["source_seq"]=source_seq
        history=(history+[snap])[-MAX_HISTORY:]
    else:
        snap=history[-1]

    n=len(history)
    learn=stage(n)
    pred=prediction(history)
    out={
      "schema":"OJO_ORGANISM_STATE_V1","version":"2026-09-21","updated_at":now(),
      "source_sequences":{"budget":bud.get("sequence"),"environment":env.get("sequence"),"combined":source_seq},
      "animal":{"species":"BIOMIMETIC_CEPHALOPOD","name":"OJO ORGANISM","metaphor":"Distributed nervous system; eight domain arms; mantle = whole-system state; skin = confidence/stress."},
      "state":snap,
      "learning":{"stage":learn,"samples":n,"max_memory":MAX_HISTORY,"motifs":motifs(history),"early_warning":warning_signal(history),
                  "prediction":pred,"regime_transitions":transitions(history)},
      "control_readiness":{
        "sensor_coverage":snap.get("sensor_health",0),
        "mathematical_observability":"UNPROVEN",
        "dynamic_edges_validated":0,
        "actuators_validated":0,
        "controllability":"UNPROVEN",
        "closed_loop_control":"NOT_READY",
        "reason":"Live sensing exists, but causal transfer functions between candidate levers and state variables are not yet empirically validated.",
        "next_requirements":["historical backtests","causal/functional edge registry","forecast-error ledger","validated actuator response functions"]
      },
      "policy":{"derived_indices":"VISUAL/ANALYTICAL, NOT OFFICIAL ECONOMIC METRICS","event_is_not_impact":True,
                "simulation_is_not_recommendation":True,"political_recommendation":"NONE"},
      "history":history
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":"WROTE","samples":n,"stage":learn,"regime":snap.get("regime"),"strain":snap.get("strain")}))

if __name__=="__main__":main()
