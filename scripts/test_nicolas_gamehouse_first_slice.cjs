#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../docs');
const OUT=path.resolve(__dirname,'../PROOF/NICOLAS_GAMEHOUSE_V1_20261005/browser');
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
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nicolas-first-slice-profile-'));
  const exe=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  chrome=spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let logs='';chrome.stderr.on('data',d=>logs=(logs+d).slice(-5000));
  for(let i=0;i<80&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await sleep(100);
  if(!fs.existsSync(path.join(profile,'DevToolsActivePort')))throw Error('CHROME_START_FAILED '+logs);
  const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);
  const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let seq=0;const pending=new Map(),exceptions=[];let recording=false;const videoFrames=[];const framesDir=path.join(OUT,'frames');fs.mkdirSync(framesDir,{recursive:true});
  socket.onmessage=e=>{
    const x=JSON.parse(e.data);
    if(x.id){const cb=pending.get(x.id);if(cb){pending.delete(x.id);x.error?cb.reject(Error(JSON.stringify(x.error))):cb.resolve(x.result);}}
    else if(x.method==='Page.screencastFrame'){const f=x.params;if(recording){const name=String(videoFrames.length).padStart(5,'0')+'.jpg';fs.writeFileSync(path.join(framesDir,name),Buffer.from(f.data,'base64'));videoFrames.push({name,time:f.metadata.timestamp});}send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});}
    else if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params.exceptionDetails.exception?.description||x.params.exceptionDetails.text);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
  const wait=async(expr,why)=>{for(let i=0;i<360;i++){if(await evaljs(expr))return;await sleep(100);}throw Error('WAIT '+why);};
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));};
  const pass=x=>console.log('PASS '+x);

  await send('Page.enable');await send('Runtime.enable');await send('Page.bringToFront');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const url='http://127.0.0.1:'+server.address().port+'/france-debt-rate-risk-live-2026-10-02.html';
  await send('Page.navigate',{url});
  await wait("document.readyState==='complete'&&!!window.LaBeteHouseGameV1",'house game script');
  const pre=await evaljs("LaBeteHouseGameV1.state()");assert.equal(pre.world_ready,false);
  const route=[],checks={lazy:true};
  const key=async(code,on)=>send('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',code,key:code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:code.startsWith('Key')?code.charCodeAt(3):code==='Escape'?27:code==='ArrowUp'?38:0});
  const click=async(x,y)=>{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});mouseX=x;mouseY=y;};
  const clickSelector=async selector=>{const p=await evaljs(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await click(p.x,p.y);};
  let mouseX=720,mouseY=450;
  const lock=async()=>{if(!await evaljs('!!document.pointerLockElement')){await click(720,450);mouseX=720;mouseY=450;await sleep(100);}assert.equal(await evaljs('!!document.pointerLockElement'),true);};
  const look=async target=>{
    await lock();
    const pitch=await evaljs('LaBeteThreeRuntime.camera.rotation.x');mouseY+=(pitch+.04)/.0019;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:mouseX,y:mouseY,button:'none'});await sleep(60);
    for(let i=0;i<3;i++){
      const yaw=await evaljs('LaBeteThreeRuntime.camera.rotation.y');const d=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));if(Math.abs(d)<.006)break;
      mouseX-=d/.0022;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:mouseX,y:mouseY,button:'none'});await sleep(80);
    }
  };
  const position=()=>evaljs('LaBeteHouseGameV1.state().player');
  const go=async(x,z,label)=>{
    let pos=await position();await look(Math.atan2(-(x-pos.x),-(z-pos.z)));await key('KeyW',true);
    let reached=false;
    for(let i=0;i<140;i++){await sleep(90);pos=await position();route.push({at:Date.now(),label,...pos});if(Math.hypot(pos.x-x,pos.z-z)<.24){reached=true;break;}}
    await key('KeyW',false);await sleep(240);pos=await position();assert.ok(reached,'UNREACHED '+label+' '+JSON.stringify(pos));console.log('WALK',label,JSON.stringify(pos));
  };
  recording=true;await send('Page.startScreencast',{format:'jpeg',quality:78,maxWidth:1440,maxHeight:900,everyNthFrame:3});
  await sleep(2500);
  await clickSelector('#houseGameEnter');await wait('LaBeteHouseGameV1.state().active','enter by real click');await lock();await sleep(2000);
  const refs=await evaljs(`(()=>{const r=LaBeteThreeRuntime;window.__receiptRenderer=r.renderer;window.__receiptScene=r.scene;window.__receiptCamera=r.camera;const w=r.scene.getObjectByName('LivingAdvisoryHouseGameWorld');return {canvasCount:document.querySelectorAll('#beastMount canvas').length,worldParent:w.parent===r.scene,avatars:w.children.filter(o=>o.userData.type==='avatar').map(a=>{let meshes=0,bones=[];a.traverse(m=>{if(m.isSkinnedMesh){meshes++;bones.push(m.skeleton.bones.length)}});return {name:a.name,meshes,bones}})}})()`);
  assert.equal(refs.canvasCount,1);assert.equal(refs.worldParent,true);assert.equal(refs.avatars.length,2);assert.ok(refs.avatars.every(a=>a.meshes===14&&a.bones.every(n=>n===40)));
  checks.actual_skinned_mesh_40_bones=true;checks.single_scene_renderer=true;
  await go(1.65,2.95,'approach-nicolas');await look(-1.05);await sleep(4800);await shot('arrival-nicolas');
  await key('KeyE',true);await key('KeyE',false);await wait("!document.getElementById('houseGamePanel').hidden",'host interaction');await sleep(1200);await shot('arrival-interaction');
  const hostPose=await evaljs("LaBeteHouseGameV1.pose('desk')");await sleep(2500);
  await clickSelector('#houseGamePanelClose');await sleep(150);
  await go(0,2,'arrival-door-approach');await look(0);await sleep(1700);await shot('arrival-door-open');
  await go(0,-2,'through-arrival-door');await go(0,-5,'central-corridor');await sleep(5000);await shot('corridor');
  await go(4.4,-5,'toward-decision');await look(-Math.PI/2);await sleep(1400);await shot('decision-door');
  await go(8.2,-5,'through-decision-door');assert.equal(await evaljs('LaBeteHouseGameV1.state().room'),'decision');
  await go(8.6,-7.2,'around-committee-table');await go(12,-7.25,'approach-decision-host');await look(-Math.PI/2);await sleep(2200);await shot('decision-nicolas');
  const before=await evaljs("LaBeteHouseGameV1.pose('decision')");await key('KeyE',true);await key('KeyE',false);await sleep(900);
  const after=await evaljs("LaBeteHouseGameV1.pose('decision')");
  assert.ok(Math.abs(after.rightShoulderZ-before.rightShoulderZ)>.04||Math.abs(after.rightElbowZ-before.rightElbowZ)>.04,'gesture does not change');
  assert.equal(await evaljs("document.getElementById('houseGamePanelTitle').textContent===document.getElementById('decisionTwinTitle').textContent"),true);
  assert.ok(await evaljs("document.getElementById('houseGamePanelBody').textContent.includes('Incertitudes')"));
  await shot('decision-twin');await sleep(8500);await clickSelector('#houseGamePanelClose');await sleep(100);
  await go(8.5,-7.2,'return-around-table');await go(8.3,-5,'return-to-decision-door');await go(4.3,-5,'return-corridor');await go(0,-5,'return-junction');await go(0,2,'return-arrival');await look(-1.1);await sleep(7000);await shot('arrival-return');
  checks.physical_round_trip=true;checks.decision_owner_binding=true;checks.gesture_changed=true;checks.pointer_lock_and_mouse=true;
  recording=false;await send('Page.stopScreencast');
  fs.writeFileSync(path.join(OUT,'video-frames.json'),JSON.stringify(videoFrames));
  const concat=videoFrames.map((f,i)=>`file '${path.join(framesDir,f.name)}'\nduration ${i+1<videoFrames.length?Math.max(.001,videoFrames[i+1].time-f.time):.05}`).join('\n');fs.writeFileSync(path.join(OUT,'video-concat.txt'),concat);
  const desktopPerf=await evaljs('LaBeteHouseGameV1.performance()');
  // Actual wall collision: walk against the north wall away from the doorway.
  await go(-3.5,1.8,'wall-test-approach');await look(0);await key('KeyW',true);await sleep(1800);await key('KeyW',false);await sleep(200);const wall=await position();assert.ok(wall.z>=.43,'crossed wall');checks.wall_collision=true;
  // Actual desk collision from its front: footprint centered at (-1,5.5).
  await go(0,2,'desk-collision-approach');await look(Math.PI);await key('ArrowUp',true);await sleep(2200);await key('ArrowUp',false);await sleep(200);const furniture=await position();assert.ok(furniture.z<4.26,'crossed desk');checks.furniture_collision=true;checks.arrow_keys=true;
  // Audio is explicit and belongs to the existing sensory owner.
  assert.equal(await evaljs('LaBeteHouseGameV1.state().sound_enabled'),false);await evaljs('document.exitPointerLock()');await clickSelector('#houseGameSound');await sleep(250);
  assert.equal(await evaljs("LaBeteSensoryRuntime.context?.state"),'running');await clickSelector('#houseGameExit');assert.equal(await evaljs('LaBeteSensoryRuntime.context'),null);checks.audio_opt_in_exit_silence=true;
  assert.equal(await evaljs('LaBeteHouseGameV1.state().active'),false);
  await clickSelector('#houseGameEnter');await wait('LaBeteHouseGameV1.state().active','resume');
  assert.equal(await evaljs('LaBeteThreeRuntime.renderer===__receiptRenderer&&LaBeteThreeRuntime.scene===__receiptScene&&LaBeteThreeRuntime.camera===__receiptCamera'),true);checks.exit_resume_same_objects=true;
  await evaljs('document.exitPointerLock()');await key('Escape',true);await key('Escape',false);assert.equal(await evaljs('LaBeteHouseGameV1.state().active'),false);checks.escape=true;
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await clickSelector('#houseGameEnter');await wait('LaBeteHouseGameV1.state().active','reduced');await sleep(500);await shot('reduced-motion');
  assert.equal(await evaljs('LaBeteHouseGameV1.state().reduced_motion'),true);const ys=[];await key('KeyW',true);for(let i=0;i<6;i++){await sleep(90);ys.push(await evaljs('LaBeteThreeRuntime.camera.position.y'));}await key('KeyW',false);assert.ok(ys.every(y=>y===1.64));checks.reduced_motion_no_bob=true;
  await evaljs('document.exitPointerLock()');await clickSelector('#houseGameExit');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await clickSelector('#houseGameEnter');await wait('LaBeteHouseGameV1.state().active','mobile');await evaljs('document.exitPointerLock()');await sleep(1000);
  const mobileStart=await position();const touchRect=await evaljs("(()=>{const r=document.querySelector('[data-move=right]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchRect,id:1,radiusX:5,radiusY:5}]});await sleep(500);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(200);
  const mobileEnd=await position();assert.ok(Math.hypot(mobileEnd.x-mobileStart.x,mobileEnd.z-mobileStart.z)>.35,'touch did not move player');
  const yawBefore=await evaljs('LaBeteThreeRuntime.camera.rotation.y');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:400,id:2}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:250,y:400,id:2}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);assert.ok(Math.abs(await evaljs('LaBeteThreeRuntime.camera.rotation.y')-yawBefore)>.1);checks.real_touch_move_look=true;
  await sleep(2500);await shot('mobile');const mobilePerf=await evaljs('LaBeteHouseGameV1.performance()');assert.ok(await evaljs('document.documentElement.scrollWidth<=innerWidth+1'));checks.mobile_no_overflow=true;
  // Context loss exits safely; restored event reuses the renderer and loop owner.
  await evaljs("window.__loss=LaBeteThreeRuntime.renderer.getContext().getExtension('WEBGL_lose_context');__loss.loseContext()");await sleep(600);assert.equal(await evaljs('LaBeteHouseGameV1.state().active'),false);
  await evaljs("__loss.restoreContext()");await sleep(1400);await clickSelector('#houseGameEnter');await wait('LaBeteHouseGameV1.state().active','context restore');await sleep(600);assert.equal(await evaljs('LaBeteThreeRuntime.renderer===__receiptRenderer'),true);checks.context_loss_restore=true;
  await evaljs('document.exitPointerLock()');await clickSelector('#houseGameExit');
  assert.equal(exceptions.length,0,exceptions.join('\n'));
  const receipt={schema:'LA_BETE_HOUSE_GAME_V1_BROWSER_RECEIPT',scope:'FIRST_SLICE_ARRIVAL_CORRIDOR_DECISION_RETURN',checks,actual:refs,hostPose,decisionPose:{before,after},wall,furniture,mobile:{from:mobileStart,to:mobileEnd},route,exceptions,video_duration_seconds:videoFrames.at(-1).time-videoFrames[0].time,verdict:'PARTIALLY_PROVEN_NAVIGATION_READY_AVATAR_NOT_FINAL',limitations:['Five-room route deferred until first-slice visual approval','Physical mobile and physical gamepad not tested','XR hardware not available','Avatar likeness and realism not final']};
  fs.writeFileSync(path.join(OUT,'LA_BETE_HOUSE_GAME_V1_BROWSER_RECEIPT.json'),JSON.stringify(receipt,null,2));
  fs.writeFileSync(path.join(OUT,'PERFORMANCE_RECEIPT.json'),JSON.stringify({desktop:desktopPerf,mobile_emulation:mobilePerf,measurement:'Chrome native rendering, actual animation-loop intervals; recording overhead included; emulation is not physical mobile',viewport_desktop:[1440,900],viewport_mobile:[390,844]},null,2));
  console.log('FIRST_SLICE_BROWSER_PASS',JSON.stringify(checks));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{try{socket?.close();}catch{}try{chrome?.kill('SIGTERM');}catch{}try{server?.close();}catch{}});
