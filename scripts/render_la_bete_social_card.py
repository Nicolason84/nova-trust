#!/usr/bin/env python3
import json, re
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"docs/data/france-debt-rate-live.json"
HTML=ROOT/"docs/france-debt-rate-risk-live-2026-10-02.html"
ASSETS=ROOT/"docs/assets"
CARD=ASSETS/"la-bete-social-card.png"
CANON="https://nicolason84.github.io/nova-trust/france-debt-rate-risk-live-2026-10-02.html"

j=json.loads(DATA.read_text())
o=j.get("observed",{}); s=j.get("summary",{})
rate=float(o.get("tec10_pct",0)); rate_fr=f"{rate:.3f}".replace(".",",")
date=(o.get("tec10_date") or "—").split("-")
date_fr="/".join(reversed(date)) if len(date)==3 else "—"
warnings=int(s.get("warnings",0))
snapshot=str(j.get("snapshot_id","OJO-LIVE"))
version=re.sub(r"[^A-Za-z0-9]","",snapshot)[-12:] or "live"
title=f"La Bête · TEC10 {rate_fr} % · dette, taux & décision"
desc=f"Decision Twin public · observation {date_fr} · {warnings} source(s) en alerte · horizons, preuves et état des sources visibles."

def font(size,bold=False):
    candidates=[
      "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for x in candidates:
        if Path(x).exists(): return ImageFont.truetype(x,size)
    return ImageFont.load_default()

W,H=1200,630
im=Image.new("RGB",(W,H),"#071019"); px=im.load()
top=(9,24,34); bot=(4,11,17)
for y in range(H):
    t=y/(H-1)
    c=tuple(int(top[i]*(1-t)+bot[i]*t) for i in range(3))
    for x in range(W): px[x,y]=c
d=ImageDraw.Draw(im)
d.ellipse((760,-260,1370,350),fill="#102e3b")
d.ellipse((885,-110,1280,280),outline="#8bd6e5",width=2)
d.rounded_rectangle((55,48,1145,582),radius=32,outline="#29404b",width=2,fill="#09151e")
d.text((92,82),"ojO / SUPRA",font=font(28,True),fill="#c8f09a")
d.text((92,126),"LA BÊTE · FRANCE · DETTE & TAUX",font=font(21,True),fill="#e7bd72")
d.text((92,194),"Signal ≠ diagnostic.",font=font(58,True),fill="#eef5f2")
d.text((92,282),f"TEC10  {rate_fr} %",font=font(78,True),fill="#c8f09a")
d.text((94,382),f"Observation {date_fr} · courbe · refinancement · horizons · preuves",font=font(24),fill="#cbd8dc")
badge="#623f35" if warnings else "#173d2a"; badge_text=f"{warnings} SOURCE(S) EN ALERTE" if warnings else "SOURCES OPÉRATIONNELLES"
d.rounded_rectangle((92,438,510,493),radius=27,fill=badge,outline="#e7bd72" if warnings else "#7ed8a0",width=2)
d.text((116,453),badge_text,font=font(18,True),fill="#f0e2c0" if warnings else "#bfe8cb")
d.text((92,525),"Decision Twin public · données publiques · aucune recommandation politique",font=font(18),fill="#9fb1b7")
d.text((825,525),"nicolason84.github.io",font=font(18,True),fill="#8bd6e5")
im.save(CARD,optimize=True)

def icon(path,size):
    x=Image.new("RGB",(size,size),"#071019"); q=ImageDraw.Draw(x)
    pad=max(12,size//12); q.rounded_rectangle((pad,pad,size-pad,size-pad),radius=size//5,fill="#0e1a24",outline="#8bd6e5",width=max(2,size//64))
    f=font(int(size*.48),True); txt="O"; box=q.textbbox((0,0),txt,font=f); q.text(((size-(box[2]-box[0]))/2,(size-(box[3]-box[1]))/2-box[1]-size*.03),txt,font=f,fill="#c8f09a")
    x.save(path,optimize=True)
icon(ASSETS/"la-bete-icon-192.png",192); icon(ASSETS/"la-bete-icon-512.png",512); icon(ASSETS/"la-bete-apple-touch-icon.png",180)

text=HTML.read_text()
image=f"https://nicolason84.github.io/nova-trust/assets/la-bete-social-card.png?v={version}"
def set_meta(text,key,value,kind="property"):
    pat=rf'(<meta {kind}="{re.escape(key)}" content=")[^"]*(">)'
    out,n=re.subn(pat,lambda m:m.group(1)+escape(value,quote=True)+m.group(2),text,count=1)
    if n!=1: raise SystemExit(f"missing meta {kind}:{key}")
    return out
for k,v in [("og:title",title),("og:description",desc),("og:image",image),("og:image:secure_url",image)]:
    text=set_meta(text,k,v)
for k,v in [("twitter:title",title),("twitter:description",desc),("twitter:image",image)]:
    text=set_meta(text,k,v,"name")
HTML.write_text(text)
print(f"LA_BETE_SOCIAL_CARD_PASS {CARD} {version}")
