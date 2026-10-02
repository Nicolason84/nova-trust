// Isolated browser regression against the authorized PUBLIC URL, with no account session.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer');
const url='https://nicolason84.github.io/nova-trust/france-debt-rate-risk-live-2026-10-02.html';
const out=process.argv[2]||'receipts/france-beast-convergence';await fs.mkdir(out,{recursive:true});
const b=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const results={url,at:new Date().toISOString(),engine:'Chrome isolated headless; responsive viewport, not physical iPhone',checks:[],screenshots:{}};
async function open(viewport,js=true,degraded=false){
 const p=await b.newPage();await p.setViewport(viewport);await p.setJavaScriptEnabled(js);
 await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(degraded){await p.setRequestInterception(true);p.on('request',r=>/france-debt-rate-live.json|api.github.com/.test(r.url())?r.abort():r.continue());}
 const r=await p.goto(url,{waitUntil:'networkidle2',timeout:60000});assert.equal(r.status(),200);
 const state=await p.evaluate(()=>({headline:document.getElementById('realityHeadline').textContent,
  feed:document.getElementById('feed').textContent,runner:document.getElementById('runner').textContent,
  width:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
  duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((x,i,a)=>a.indexOf(x)!==i),
  snapshot:JSON.parse(document.getElementById('canonicalSnapshot').textContent),
  canvas:!!document.querySelector('#beastMount canvas'),beastTag:document.getElementById('beastTag').textContent,
  motion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  curve:document.getElementById('curveSvg').innerHTML.length,
  proof:document.getElementById('proof-TEC10').textContent,
  artStylesheet:!![...document.styleSheets].find(s=>s.href?.includes('la-bete-art.css')&&s.cssRules.length>100),
  soundAtBoot:document.getElementById('beastSound')?.getAttribute('aria-pressed')}));
 assert(!/Lecture de l’état canonique|Chargement/.test(state.headline));
 assert.equal(state.duplicateIds.length,0);assert(state.scrollWidth<=state.clientWidth+1);assert(state.width<=viewport.width+1);assert(state.motion);
 assert(state.proof.includes('SOURCE_OBSERVATION_IDENTITY'));assert(state.curve>100);
 assert.equal(state.snapshot.france_binding.territorial_imputation,false);assert.deepEqual(errors,[]);
 assert(state.artStylesheet);assert.equal(state.soundAtBoot,'false');
 if(degraded){assert(state.feed.includes('SNAPSHOT CONSERVÉ'));assert(state.runner.includes('UNKNOWN'));}
 results.checks.push({viewport,js,degraded,status:'PASS',...state,snapshot:{snapshot_id:state.snapshot.snapshot_id,sequence:state.snapshot.sequence,updated_at:state.snapshot.updated_at}});
 return p;
}
try{
 for(const [name,viewport] of [['DESKTOP',{width:1440,height:1000}],['MOBILE',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1}]]){
  const p=await open(viewport);await p.screenshot({path:out+'/CAPTURE_FINAL_'+name+'.png'});
  results.screenshots[name]=crypto.createHash('sha256').update(await fs.readFile(out+'/CAPTURE_FINAL_'+name+'.png')).digest('hex');
  // Exercise the real export handlers, keeping bytes in the isolated test context.
  for(const id of ['downloadBrief','downloadBriefHtml','downloadSnapshot']){
   await p.evaluate(()=>{window.__export=null;URL.createObjectURL=blob=>{window.__export=blob;return 'blob:test-export'};HTMLAnchorElement.prototype.click=function(){};});
   await p.click('#'+id);const text=await p.evaluate(async()=>window.__export?.text());assert(text?.length>100);
   if(id==='downloadSnapshot')assert.equal(JSON.parse(text).france_binding.territorial_imputation,false);
   else assert(text.includes('national ≠ territorial'));
  }
  results.checks.push({exports:name,status:'PASS'});
  await p.click('#beastSound');await p.waitForFunction(()=>document.body.dataset.resonance==='on'&&beastResonance.context.currentTime>.25,{timeout:5000});
  const sound=await p.evaluate(async()=>{
   const c=beastResonance.context,a=c.createAnalyser();a.fftSize=1024;beastResonance.master.connect(a);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const samples=new Float32Array(a.fftSize);a.getFloatTimeDomainData(samples);beastResonance.master.disconnect(a);
   return{state:c.state,voices:beastResonance.voices.length,master:beastResonance.master.gain.value,rms:Math.sqrt(samples.reduce((n,x)=>n+x*x,0)/samples.length),hapticAvailable:typeof navigator.vibrate==='function'};
  });assert.equal(sound.state,'running');assert.equal(sound.voices,7);assert(sound.master>0&&sound.master<.0961);assert(sound.rms>0);
  await p.click('#beastSound');await p.waitForFunction(()=>document.body.dataset.resonance==='off'&&beastResonance.context===null,{timeout:5000});
  results.checks.push({resonance:name,status:'PASS',...sound,stopped:true,hardwareVibration:'Not physically certified'});
  await (await p.$('#la-bete .beastShell')).screenshot({path:out+'/CAPTURE_BEAST_'+name+'.png'});
  await (await p.$('#beast-resonance')).screenshot({path:out+'/CAPTURE_RESONANCE_'+name+'.png'});
  await p.close();
 }
 await (await open({width:390,height:844,isMobile:true},false)).close();
 await (await open({width:1440,height:1000},true,true)).close();
 await (await open({width:844,height:390,isMobile:true})).close();
 results.status='PASS';
}catch(e){results.status='FAIL';results.error=String(e);throw e;}
finally{await fs.writeFile(out+'/PUBLIC_BROWSER_CHECKS.json',JSON.stringify(results,null,2)+'\n');await b.close();console.log(JSON.stringify(results));}
