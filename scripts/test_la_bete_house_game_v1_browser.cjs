#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../docs');
const OUT=process.env.LA_BETE_HOUSE_GAME_PROOF_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'la-bete-house-game-v1-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
let server,chrome,socket;
async function main(){
  server=http.createServer((req,res)=>{
    const file=path.resolve(ROOT,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(ROOT+'/')){res.writeHead(403);return res.end();}
    try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}
    catch(_){res.writeHead(404);res.end('not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  fs.mkdirSync(OUT,{recursive:true});
  const profile=fs.mkdtempSync(path.join(OUT,'profile-'));
  const exe=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  chrome=spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let logs='';chrome.stderr.on('data',d=>logs=(logs+d).slice(-5000));
  for(let i=0;i<80&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await sleep(100);
  if(!fs.existsSync(path.join(profile,'DevToolsActivePort')))throw Error('CHROME_START_FAILED '+logs);
  const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);
  const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let seq=0;const pending=new Map(),exceptions=[];
  socket.onmessage=e=>{
    const x=JSON.parse(e.data);
    if(x.id){const cb=pending.get(x.id);if(cb){pending.delete(x.id);x.error?cb.reject(Error(JSON.stringify(x.error))):cb.resolve(x.result);}}
    else if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params.exceptionDetails.exception?.description||x.params.exceptionDetails.text);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
  const wait=async(expr,why)=>{for(let i=0;i<360;i++){if(await evaljs(expr))return;await sleep(100);}throw Error('WAIT '+why);};
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));};
  const pass=x=>console.log('PASS '+x);

  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const url='http://127.0.0.1:'+server.address().port+'/france-debt-rate-risk-live-2026-10-02.html';
  await send('Page.navigate',{url});
  await wait("document.readyState==='complete'&&!!window.LaBeteHouseGameV1",'house game script');
  const pre=await evaljs("({canvas:document.querySelectorAll('#beastMount canvas').length,button:document.getElementById('houseGameEnter')?.textContent||'',disabled:document.getElementById('houseGameEnter')?.disabled,game:LaBeteHouseGameV1.state()})");
  assert.equal(pre.game.second_engine,false);
  assert.equal(pre.game.world_ready,false);
  assert.equal(pre.disabled,false);
  pass('initial QUESTION surface remains light: 3D is lazy and no second engine boots in the background');

  await evaljs("LaBeteHouseGameV1.enter({pointerLock:false})");
  await wait("LaBeteHouseGameV1.state().active===true&&LaBeteHouseGameV1.state().avatar_model_mode==='canonical_glb_skinned_curved_face_v2_web_preview'&&document.body.classList.contains('house-game-active')",'first-slice game active with exact Nicolas V2');
  const entered=await evaljs("LaBeteHouseGameV1.state()");
  assert.equal(await evaljs("document.querySelectorAll('#beastMount canvas').length"),1);
  assert.equal(entered.avatars.length,2);
  assert.ok(entered.avatars.every(x=>x.same_identity===true&&x.exact_canonical_mesh===true));
  assert.equal(entered.exact_avatar_meshes,14);
  assert.equal(entered.exact_avatar_vertices,34385);
  assert.equal(entered.first_slice_only,true);
  pass('one existing Three.js canvas owns the explicit Bureau + Décision first slice with two exact Nicolas V2 projections');
  assert.equal(entered.same_renderer,true);
  assert.equal(entered.same_scene,true);
  assert.equal(entered.continuous_world,true);
  assert.equal(entered.collisions,true);
  assert.equal(entered.physical_doors,2);
  assert.equal(await evaljs("document.querySelectorAll('#beastMount canvas').length"),1);
  pass('entering the House reuses the existing renderer, camera and scene without a second canvas');
  await shot('house-game-desk');

  const before=await evaljs("LaBeteHouseGameV1.state().player");
  const after=await evaljs(`(()=>{
    const base=performance.now();
    LaBeteHouseGameV1.control('forward',true);
    for(let i=1;i<=10;i++)window.LaBeteThreeFrameHook(base+i*50,window.LaBeteThreeRuntime);
    LaBeteHouseGameV1.control('right',true);
    for(let i=11;i<=26;i++)window.LaBeteThreeFrameHook(base+i*50,window.LaBeteThreeRuntime);
    LaBeteHouseGameV1.control('forward',false);
    LaBeteHouseGameV1.control('right',false);
    return LaBeteHouseGameV1.state().player;
  })()`);
  assert.ok(after.x>before.x+1.8&&after.z<before.z-.6,'player did not move toward the Bureau host: '+JSON.stringify({before,after}));
  pass('WASD locomotion advances deterministically through real world coordinates');

  const deskPose=await evaljs("LaBeteHouseGameV1.pose('desk')");
  assert.equal(deskPose.nativeWebSkeleton,true);
  assert.equal(await evaljs("LaBeteHouseGameV1.interact()"),true);
  await wait("document.getElementById('houseGamePanel').hidden===false",'desk interaction');
  const deskPanel=await evaljs("({title:document.getElementById('houseGamePanelTitle').textContent,intro:document.getElementById('houseGamePanelIntro').textContent})");
  assert.ok(deskPanel.title.length>10);
  assert.match(deskPanel.intro,/Decision/);
  assert.equal(await evaljs("LaBeteHouseGameV1.state().room"),'desk');
  pass('E interaction opens the real Bureau guidance and points to Decision without fabricating the unfinished rooms');
  await shot('house-game-desk-panel');

  await evaljs("document.getElementById('houseGamePanelClose').click()");
  await wait("document.getElementById('houseGamePanel').hidden===true",'desk panel close');

  const state=await evaljs("LaBeteHouseGameV1.state()");
  assert.equal(state.avatar_identity,'NICOLAS_CANONICAL_USDA_CURVED_FACE_V2');
  assert.equal(state.avatar_model_mode,'canonical_glb_skinned_curved_face_v2_web_preview');
  assert.equal(state.native_skeleton_loaded,true);
  assert.equal(state.canonical_native_rig,'Nicolas.usda');
  assert.equal(state.first_slice_only,true);
  assert.equal(state.avatars.length,2);
  assert.equal(state.physical_doors,2);
  assert.equal(exceptions.length,0,'browser exceptions: '+exceptions.join('\n'));
  const receipt={schema:'LA_BETE_HOUSE_GAME_V1_BROWSER_PROOF',pre,entered,state,exceptions,output:OUT,verdict:'PASS'};
  fs.writeFileSync(path.join(OUT,'receipt.json'),JSON.stringify(receipt,null,2));
  console.log('LA_BETE_HOUSE_GAME_V1_BROWSER_PASS '+OUT);
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{try{socket?.close();}catch{}try{chrome?.kill('SIGTERM');}catch{}try{server?.close();}catch{}});
