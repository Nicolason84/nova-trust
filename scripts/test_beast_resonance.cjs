const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const page=fs.readFileSync('docs/france-debt-rate-risk-live-2026-10-02.html','utf8');
const script=page.slice(page.indexOf('// Optional sensory presentation.'),page.indexOf('\nlet beast3d=null'));
function fixture(audio=true,haptic=false){
 const nodes=new Map(),events={},windowEvents={},contexts=[];
 const node=()=>({textContent:'',value:'24',disabled:false,attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.events[k]=f}});
 const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v}});
 class Context{constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.oscillators=[];contexts.push(this)}createGain(){return{gain:param(),connect(){}}}createDynamicsCompressor(){return{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}}}createOscillator(){const o={frequency:param(),connect(){},start(){this.started=true},stop(){this.stopped=true}};this.oscillators.push(o);return o}async resume(){this.state='running'}async close(){this.state='closed'}}
 const document={hidden:false,body:{dataset:{}},addEventListener(k,f){events[k]=f}};
 const navigator=haptic?{vibrations:[],vibrate(p){this.vibrations.push(p);return true}}:{};
 const window={addEventListener(k,f){windowEvents[k]=f}};if(audio)window.AudioContext=Context;
 const c=vm.createContext({document,window,navigator,Math,Number,String,setTimeout:f=>f(),$:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}});
 vm.runInContext(script,c);const run=s=>vm.runInContext(s,c);run('initResonance()');return{run,nodes,document,navigator,events,windowEvents,contexts};
}
(async()=>{
 const f=fixture();assert.equal(f.contexts.length,0,'No audio context at startup');assert(f.nodes.get('beastHaptic').disabled);
 await f.nodes.get('beastSound').events.click();assert.equal(f.contexts.length,1);assert.equal(f.contexts[0].oscillators.length,7);assert.equal(f.document.body.dataset.resonance,'on');assert.equal(f.nodes.get('beastSound').attrs['aria-pressed'],'true');
 assert(Math.abs(f.run('beastResonance.master.gain.value')-.0384)<1e-8);
 f.nodes.get('beastVolume').value='0';f.nodes.get('beastVolume').events.input();assert.equal(f.run('beastResonance.master.gain.value'),0);
 f.nodes.get('beastVolume').value='900';f.nodes.get('beastVolume').events.input();assert(f.run('beastResonance.master.gain.value')<=.096);
 f.document.hidden=true;f.events.visibilitychange();assert.equal(f.document.body.dataset.resonance,'off');assert.equal(f.contexts[0].state,'closed');assert(f.contexts[0].oscillators.every(o=>o.stopped));
 f.document.hidden=false;f.events.visibilitychange();assert.equal(f.contexts.length,1,'No automatic audio restart');
 await f.nodes.get('beastSound').events.click();await f.nodes.get('beastSound').events.click();assert.equal(f.document.body.dataset.resonance,'off');assert.equal(f.contexts[1].state,'closed');
 const h=fixture(true,true);h.nodes.get('beastHaptic').events.click();assert.equal(h.navigator.vibrations.length,1);h.document.hidden=true;h.events.visibilitychange();assert.equal(h.navigator.vibrations.at(-1),0);
 const unavailable=fixture(false);assert(unavailable.nodes.get('beastSound').disabled);assert.equal(unavailable.contexts.length,0);
 assert(!/getUserMedia|fetch\(|setInterval\(|localStorage|political_recommendation/.test(script));
 console.log('BEAST_RESONANCE_OPT_IN_VOLUME_STOP_BACKGROUND_HAPTIC_FALLBACK_PASS');
})().catch(e=>{console.error(e);process.exit(1)});
