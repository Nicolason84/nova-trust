#!/usr/bin/env python3
"""Static projection using the page's existing JS renderer, not a second model."""
import hashlib, json, re, subprocess
from html.parser import HTMLParser
from pathlib import Path

PAGE=Path('docs/france-debt-rate-risk-live-2026-10-02.html')
LIVE=Path('docs/data/france-debt-rate-live.json')
EVO=Path('docs/data/france-debt-rate-evolution.json')

class Elements(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.lines=[0]
        for m in re.finditer('\n',text): self.lines.append(m.end())
        self.stack=[]; self.elements={}; self.text=text
    def absolute_position(self):
        line,col=self.getpos(); return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        if tag in {'meta','link','br','wbr','input','img','hr','source','area','base','embed','param','track','col'}: return
        start=self.absolute_position(); ident=dict(attrs).get('id')
        self.stack.append((tag,ident,start,start+len(self.get_starttag_text())))
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:
                _,ident,start,inner=self.stack[i]; self.stack=self.stack[:i]
                if ident:self.elements[ident]=(start,inner,self.absolute_position())
                return

def main():
    text=PAGE.read_text()
    live_raw=LIVE.read_bytes(); live=json.loads(live_raw); evo=json.loads(EVO.read_text())
    parsed=Elements(text); parsed.feed(text)
    seeds={k:text[b:c] for k,(a,b,c) in parsed.elements.items()}
    script=re.search(r'<script>(.*?)</script>',text,re.S)[1]
    script=script[:script.rindex('\n// LA_BETE_BOOT_START')]
    script=script[:script.index("\ntry{const initial=JSON.parse($('canonicalSnapshot')")]
    engine=Path('scripts/prerender_france_beast.cjs')
    observability=Path('docs/assets/la-bete-observability.js').read_text()
    result=subprocess.run(
        ['node',str(engine)],
        input=json.dumps({
            'script':script,
            'prelude':observability,
            'live':live,
            'evolution':evo,
            'seeds':seeds
        }),
        text=True,
        capture_output=True,
        check=True
    )
    changes=json.loads(result.stdout)
    edits=[]
    for ident,html in changes.items():
        if ident not in parsed.elements: continue
        a,b,c=parsed.elements[ident]; edits.append((b,c,html))
    # An explicitly replaced parent owns its whole projection, including children.
    edits=[e for e in edits if not any(p[0]<e[0] and p[1]>=e[1] for p in edits)]
    for a,b,value in sorted(edits,reverse=True):text=text[:a]+value+text[b:]
    embedded=json.dumps(live,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    evo_embed=json.dumps(evo,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    snapshot=f'<script type="application/json" id="canonicalSnapshot" data-sha256="{hashlib.sha256(live_raw).hexdigest()}">{embedded}</script>'
    evolution=f'<script type="application/json" id="canonicalEvolution">{evo_embed}</script>'
    for ident,value in [('canonicalSnapshot',snapshot),('canonicalEvolution',evolution)]:
        if f'id="{ident}"' in text:text=re.sub(r'<script[^>]*id="'+ident+r'"[^>]*>.*?</script>',lambda _:value,text,flags=re.S)
        else:text=text.replace('\n<script>','\n'+value+'\n<script>',1)
    PAGE.write_text(text)
    print('CANONICAL_PRERENDER_PASS '+live['snapshot_id'])

if __name__=='__main__':main()
