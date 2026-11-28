#!/usr/bin/env python3
"""Public canonical seed projection and reproducible opt-in artistic audio.
No source collection, financial calculation or private assets.
"""
from pathlib import Path
import json, math, struct, wave, hashlib
root=Path(__file__).resolve().parents[1]
seed=(root.parent/'docs/data/france-debt-rate-live.json').read_bytes()
data=json.loads(seed)
assert data['france_binding']['organ_id']=='OJO_FRANCE_DEBT_RATE_LIVE_V1'
voices=[(72,.26),(108,.14),(144.6,.12),(216,.19),(324,.16),(648,.08)]
samples=bytearray()
for n in range(22050*20):
 t=n/22050
 breath=.6+.4*math.sin(2*math.pi*.23*t)
 fade=min(1,t/.3,(20-t)/.3)
 value=sum(a*math.sin(2*math.pi*f*t) for f,a in voices)*breath*fade*.12
 samples.extend(struct.pack('<h',round(value*32767)))
for relative in ['ios/LaBete','ios/Tests','android/assets']:
 folder=root/relative;folder.mkdir(parents=True,exist_ok=True)
 (folder/'canonical-seed.json').write_bytes(seed)
 if relative!='ios/Tests':
  with wave.open(str(folder/'resonance.wav'),'wb') as wav:
   wav.setparams((1,2,22050,0,'NONE','not compressed'));wav.writeframes(samples)
print(json.dumps({'snapshot_id':data['snapshot_id'],'sequence':data['sequence'],'canonical_sha256':hashlib.sha256(seed).hexdigest(),'audio':'six sine voices adapted from published resonance; 20s mono 22050Hz; optional'}))
