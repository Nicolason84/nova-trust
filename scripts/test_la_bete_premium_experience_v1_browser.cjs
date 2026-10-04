#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../docs');
const OUT=process.env.LA_BETE_PREMIUM_PROOF_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'la-bete-premium-v1-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
let server,chrome,socket;
async function main(){
 server=http.createServer((req,res)=>{const file=path.resolve(ROOT,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(ROOT+'/')){res.writeHead(403);return res.end();}try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end('not found');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(OUT,'profile-')),exe=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 chrome=spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let logs='';chrome.stderr.on('data',d=>logs=(logs+d).slice(-5000));
 for(let i=0;i<80&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await sleep(100);
 if(!fs.existsSync(path.join(profile,'DevToolsActivePort')))throw Error('CHROME_START_FAILED '+logs);
 const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);
 const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let seq=0;const pending=new Map(),exceptions=[];
 socket.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){const cb=pending.get(x.id);if(cb){pending.delete(x.id);x.error?cb.reject(Error(JSON.stringify(x.error))):cb.resolve(x.result);}}else if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params.exceptionDetails.exception?.description||x.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 const wait=async(expr,why)=>{for(let i=0;i<120;i++){if(await evaljs(expr))return;await sleep(80);}throw Error('WAIT '+why);};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));};
 const ask=async text=>{await evaljs(`(()=>{LaBeteAdvisoryHouseV5.setRoom('desk');const i=document.getElementById('beastDialogueInput');i.value=${JSON.stringify(text)};i.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('beastDialogueForm').requestSubmit();})()`);};
 const pass=x=>console.log('PASS '+x);
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 const url='http://127.0.0.1:'+server.address().port+'/france-debt-rate-risk-live-2026-10-02.html';
 await send('Page.navigate',{url});await wait("document.readyState==='complete'&&!!window.LaBetePremiumExperienceV1",'premium boot');
 await evaljs('scrollTo(0,0)');
 assert.equal(await evaljs("document.querySelectorAll('#advisory-house-v5').length"),1);
 assert.deepEqual(await evaljs("({engine:LaBetePremiumExperienceV1.second_engine,registry:LaBetePremiumExperienceV1.second_registry,truth:LaBetePremiumExperienceV1.second_truth,privateStorage:LaBetePremiumExperienceV1.private_storage,execution:LaBetePremiumExperienceV1.execution_authority_promoted})"),{engine:false,registry:false,truth:false,privateStorage:false,execution:false});
 assert.equal(await evaljs("document.querySelectorAll('.housePane:not([hidden])').length"),1);
 assert.equal(await evaljs("document.getElementById('housePrivateDoor').getAttribute('href')"),'supra://private-office');
 assert.equal(await evaljs("document.getElementById('housePrivateDoor').getAttribute('href').includes('?')||document.getElementById('housePrivateDoor').getAttribute('href').includes('#')"),false);
 pass('premium shell is one system with one active room and payload-free private boundary');
 await shot('desktop-arrival');

 await ask('Je veux acheter une entreprise en Espagne');
 await wait("LaBeteAdvisoryHouseV5.state().room==='mission'",'scenario A mission');
 assert.deepEqual(await evaljs("LaBetePremiumExperienceV1.state().specialists"),['Opportunités','Finance','Juridique','Réseau']);
 assert.ok((await evaljs("document.getElementById('premiumMissionObjective').textContent")).includes('entreprise en Espagne'));
 assert.ok((await evaljs("document.getElementById('premiumMissionOffer').textContent")).includes('2 500'));
 assert.equal(await evaljs("document.querySelector('.premiumMissionExpert').open"),false);
 pass('scenario A M&A reaches contextual Mission with only proven bound specialists');
 await sleep(450);await shot('desktop-mission');

 await ask('Ma banque financera-t-elle cette acquisition ?');
 await wait("LaBeteAdvisoryHouseV5.state().room==='decision'",'scenario B decision');
 assert.deepEqual(await evaljs("LaBetePremiumExperienceV1.state().specialists"),['Finance']);
 assert.ok((await evaljs("document.getElementById('houseCommitteeUnknowns').textContent")).length>10);
 await evaljs("document.querySelector('.premiumProofJump').click()");
 await wait("LaBeteAdvisoryHouseV5.state().room==='proof'",'scenario B proof continuation');
 pass('scenario B financing reaches Decision then Proof without new engine');

 await ask('Pourquoi devrais-je croire cette conclusion ?');
 await wait("LaBeteAdvisoryHouseV5.state().room==='proof'",'scenario C proof');
 assert.equal(await evaljs("document.querySelectorAll('.housePane:not([hidden]) #evidence-graph').length"),1);
 pass('scenario C proof request opens the same Evidence room');

 await ask('Montre-moi tout ce qui est lié à cette entreprise.');
 await wait("LaBeteAdvisoryHouseV5.state().room==='explore'",'scenario D explore');
 assert.equal(await evaljs("document.getElementById('experience-explore').open"),true);
 assert.equal(await evaljs("document.body.classList.contains('mu-active')"),false);
 pass('scenario D enters Observatory while Cosmos remains voluntary');

 await ask('Je veux que vous vous occupiez du dossier.');
 await wait("LaBeteAdvisoryHouseV5.state().room==='mission'",'scenario E mission');
 assert.equal(await evaljs("document.querySelectorAll('#beastDialogueForm').length"),1);
 assert.ok((await evaljs("document.getElementById('premiumMissionObjective').textContent")).includes('occupiez du dossier'));
 assert.deepEqual(await evaljs("LaBetePremiumExperienceV1.state().specialists"),['Opportunités']);
 pass('scenario E reuses the dossier and produces a contextual Mission Office instead of a generic intake');

 await evaljs("LaBeteAdvisoryHouseV5.setRoom('decision')");
 await wait("location.hash==='#house-decision'",'history decision');
 await evaljs("LaBeteAdvisoryHouseV5.setRoom('proof')");
 await wait("location.hash==='#house-proof'",'history proof');
 await send('Page.getNavigationHistory').then(async h=>{await send('Page.navigateToHistoryEntry',{entryId:h.entries[h.currentIndex-1].id});});
 await wait("location.hash==='#house-decision'",'history back');
 pass('navigation history returns to the previous cognitive room');
 await sleep(450);await shot('desktop-decision');

 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await evaljs("getComputedStyle(document.querySelector('.premiumRoomVeil')).animationName"),'none');pass('reduced motion disables room transition animation');

 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await send('Page.reload',{ignoreCache:true});await wait("document.readyState==='complete'&&!!window.LaBetePremiumExperienceV1",'mobile boot');
 await evaljs("LaBeteAdvisoryHouseV5.setRoom('desk');scrollTo(0,0)");await wait("LaBeteAdvisoryHouseV5.state().room==='desk'",'mobile arrival desk');
 const mobile=await evaljs("(()=>{const h=document.getElementById('advisory-house-v5').getBoundingClientRect();return {left:h.left,right:h.right,width:h.width,vw:innerWidth,body:document.documentElement.scrollWidth,visible:document.querySelectorAll('.housePane:not([hidden])').length,identity:getComputedStyle(document.querySelector('.houseIdentity')).display,privateParent:document.querySelector('.housePrivateBoundary').parentElement.id,navOverflow:getComputedStyle(document.querySelector('.houseRooms')).overflowX}})()");
 assert.ok(mobile.left>=-2&&mobile.right<=mobile.vw+2&&mobile.body<=mobile.vw+2);
 assert.equal(mobile.visible,1);assert.equal(mobile.identity,'none');assert.equal(mobile.privateParent,'advisory-house-v5');
 pass('mobile keeps one focused room, compact arrival and the same private door without desktop miniaturization');
 await sleep(450);await shot('mobile-arrival');
 await evaljs("LaBeteAdvisoryHouseV5.setRoom('decision');scrollTo(0,0)");await wait("LaBeteAdvisoryHouseV5.state().room==='decision'",'mobile decision');await sleep(450);await shot('mobile-decision');

 assert.equal(exceptions.length,0,'browser exceptions: '+exceptions.join('\n'));
 const receipt={schema:'LA_BETE_LIVING_ADVISORY_HOUSE_PREMIUM_EXPERIENCE_V1_BROWSER_PROOF',desktop:{width:1440,height:960},mobile,exceptions,output:OUT,verdict:'PASS'};
 fs.writeFileSync(path.join(OUT,'receipt.json'),JSON.stringify(receipt,null,2));
 console.log('LA_BETE_PREMIUM_EXPERIENCE_V1_BROWSER_PASS '+OUT);
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{try{socket?.close();}catch{}try{chrome?.kill('SIGTERM');}catch{}try{server?.close();}catch{}});
