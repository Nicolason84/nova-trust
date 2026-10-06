'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
exports.sleep=sleep;
exports.start=async function({root,overrides={},cacheControl='no-store'}){
 const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'};
 const server=http.createServer((req,res)=>{const rel=new URL(req.url,'http://localhost').pathname;const file=overrides[rel]||path.resolve(root,'.'+decodeURIComponent(rel));
  if(!overrides[rel]&&!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':cacheControl});res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('not found');}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nicolas-v4-'));
 const chrome=spawn(process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--enable-webgl','--ignore-gpu-blocklist','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let logs='';chrome.stderr.on('data',d=>logs=(logs+d).slice(-6000));
 for(let i=0;i<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await sleep(100);
 if(!fs.existsSync(path.join(profile,'DevToolsActivePort'))){chrome.kill();server.close();throw Error(logs);}
 const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);
 const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let seq=0;const pending=new Map(),exceptions=[],events={};
 socket.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){const cb=pending.get(x.id);if(cb){pending.delete(x.id);clearTimeout(cb.timer);x.error?cb.reject(Error(JSON.stringify(x.error))):cb.resolve(x.result);}}else{if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params.exceptionDetails.exception?.description||x.params.exceptionDetails.text);events[x.method]?.(x.params);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},45000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 const wait=async(expr,why)=>{for(let i=0;i<240;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('WAIT '+why+' '+JSON.stringify(exceptions));};
 const shot=async file=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(r.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Page.bringToFront');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 const base='http://127.0.0.1:'+server.address().port;
 return {send,evaluate,wait,shot,exceptions,events,base,overrides,profile,async open(version='v4'){await send('Page.navigate',{url:base+'/france-debt-rate-risk-live-2026-10-02.html?housegame=nicolas-avatar-'+version+'&review=1#house-desk'});await wait("document.readyState==='complete'&&!!window.LaBeteHouseGameV1",'ready');await evaluate('LaBeteHouseGameV1.enter({pointerLock:false})');await wait('LaBeteHouseGameV1.state().world_ready','world');},async close(){for(const cb of pending.values())clearTimeout(cb.timer);socket.close();chrome.kill('SIGTERM');await new Promise(r=>server.close(r));}};
};
