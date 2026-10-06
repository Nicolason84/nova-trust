#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../docs');
const OUT=path.resolve(__dirname,'../PROOF/NICOLAS_GAMEHOUSE_V1_20261005/fallback');
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
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/.test(kind)?null:original.call(this,kind,...args)}`});
  await send('Network.enable');await send('Network.setUserAgentOverride',{userAgent:'LinkedInBot/1.0'});
  await send('Page.navigate',{url});
  await wait("document.readyState==='complete'&&!!window.LaBeteHouseGameV1",'house game script');
  const metadata=await evaljs("({title:document.title,og:document.querySelector('meta[property=\"og:title\"]')?.content,privateLink:!!document.querySelector('a[href=\"supra://private-office\"]'),form:!!document.getElementById('beastDialogueInput')})");
  assert.ok(metadata.title.includes('La Bête'));assert.ok(metadata.og);assert.equal(metadata.privateLink,true);assert.equal(metadata.form,true);
  const failed=await evaljs("LaBeteHouseGameV1.enter({pointerLock:false}).then(()=>false).catch(()=>true)");assert.equal(failed,true);
  assert.equal(await evaljs("document.body.classList.contains('house-game-active')"),false);
  assert.equal(await evaljs("!!document.getElementById('beastDialogueInput')&&!document.getElementById('beastDialogueInput').disabled"),true);
  await shot('fallback-2d');
  fs.writeFileSync(path.join(OUT,'FALLBACK_AND_LINKEDINBOT_RECEIPT.json'),JSON.stringify({status:'PASS',webgl_denied:true,two_d_question_available:true,game_not_active:true,metadata,exceptions,scope:'Local historical URL with LinkedInBot user-agent; no public deployment or LinkedIn update'},null,2));
  console.log('FALLBACK_2D_AND_LINKEDINBOT_PASS');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{try{socket?.close();}catch{}try{chrome?.kill('SIGTERM');}catch{}try{server?.close();}catch{}});
