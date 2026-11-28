'use strict';
// Isolated local browser experiment. No Cloudflare, JWT, real cookies, user
// account, personal data, model or production owner is contacted or modified.
// Uses the exact current owner predicate and actual service worker bytes.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.JAIME_PLAYWRIGHT_MODULE || 'playwright');
const ownerPath=process.env.JAIME_OWNER_SOURCE;
const workerPath=process.env.JAIME_WORKER_SOURCE;
if(!ownerPath||!workerPath)throw Error('Explicit reviewed source paths required');
const owner=fs.readFileSync(ownerPath,'utf8'),sw=fs.readFileSync(workerPath,'utf8');
const entryLine=owner.split('\n').find(x=>x.includes("const entry=req.method==='GET'"));
const rejectLine=owner.split('\n').find(x=>x.includes("return deny(403,'JAIME_BROWSER_AUTHORITY_REJECTED')"));
if(!entryLine||!rejectLine)throw Error('Exact owner predicate not found');
const condition=rejectLine.trim().replace(/^if\(/,'').replace(/\)return deny\(403,'JAIME_BROWSER_AUTHORITY_REJECTED'\);$/,'');
const rejects=new Function('req','c','count',entryLine+'\nreturn ('+condition+');');
const count=(req,name)=>req.rawHeaders.reduce((n,v,i)=>n+(i%2===0&&v.toLowerCase()===name?1:0),0);
const prefix='/ojo/jaime-owner-test/';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const workerPrelude="  if (request.mode === 'navigate') return; // TEST VARIANT: keep browser navigation metadata\n";
assert(sw.includes('  const request = event.request;\n'));
const corrected=sw.replace('  const request = event.request;\n','  const request = event.request;\n'+workerPrelude);
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const close=server=>new Promise(resolve=>server.close(resolve));
async function run(browser,variant){
  const records=[];let appOrigin,loginOrigin;let phase='initial';
  const app=http.createServer((req,res)=>{
    const relevant=req.url===prefix;
    const refused=rejects(req,{publicOrigin:appOrigin},count);
    if(relevant)records.push({phase,path:req.url,method:req.method,origin:req.headers.origin||null,
      fetch_site:req.headers['sec-fetch-site']||null,fetch_mode:req.headers['sec-fetch-mode']||null,
      fetch_dest:req.headers['sec-fetch-dest']||null,refused,status:refused?403:200});
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(refused){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'JAIME_BROWSER_AUTHORITY_REJECTED'}));return;}
    if(req.url===prefix+'sw.js'){
      res.writeHead(200,{'Content-Type':'application/javascript'});res.end(variant==='baseline'?sw:corrected);return;
    }
    const html='<!doctype html><meta charset="utf-8"><h1>LOCAL SYNTHETIC JAIME SHELL</h1><script>navigator.serviceWorker.register("./sw.js");</script>';
    res.writeHead(200,{'Content-Type':/\.js$/.test(req.url)?'application/javascript':'text/html'});
    res.end(relevant||/\.html$/.test(req.url)?html:'/* isolated fixture asset */');
  });
  const login=http.createServer((req,res)=>{
    if(req.method==='POST'&&req.url==='/verify'){
      req.resume();res.writeHead(302,{'Location':appOrigin+prefix,'Cache-Control':'no-store'});res.end();return;
    }
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
    res.end('<!doctype html><h1>LOCAL SYNTHETIC IDP RETURN</h1><form method="post" action="/verify"><button>Return to fixture</button></form>');
  });
  const appPort=await listen(app),loginPort=await listen(login);
  appOrigin='http://127.0.0.1:'+appPort;loginOrigin='http://localhost:'+loginPort;
  const ctx=await browser.newContext({serviceWorkers:'allow'});
  try{
    const page=await ctx.newPage();
    await page.goto(loginOrigin,{waitUntil:'domcontentloaded'});
    await Promise.all([page.waitForURL(appOrigin+prefix),page.getByRole('button',{name:'Return to fixture'}).click()]);
    await page.getByRole('heading',{name:'LOCAL SYNTHETIC JAIME SHELL'}).waitFor();
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    phase='first_reload_after_idp';
    const reload=await page.reload({waitUntil:'domcontentloaded'});
    const reloadStatus=reload.status();
    phase='direct_new_tab';
    const fresh=await ctx.newPage();const opened=await fresh.goto(appOrigin+prefix,{waitUntil:'domcontentloaded'});
    await fresh.getByRole('heading',{name:'LOCAL SYNTHETIC JAIME SHELL'}).waitFor();
    phase='direct_tab_reload';
    const freshReload=await fresh.reload({waitUntil:'domcontentloaded'});
    return {variant,initial_status:records.find(r=>r.phase==='initial').status,first_reload_status:reloadStatus,
      direct_new_tab_status:opened.status(),direct_tab_reload_status:freshReload.status(),records};
  }finally{await ctx.close();await Promise.all([close(app),close(login)]);}
}
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.JAIME_BROWSER_EXECUTABLE?{executablePath:process.env.JAIME_BROWSER_EXECUTABLE}:{})});
  let cases;
  try{cases=[await run(browser,'baseline'),await run(browser,'navigation_passthrough')];}
  finally{await browser.close();}
  const evidence={schema:'JAIME_ISOLATED_SERVICE_WORKER_AUTH_RETURN_REPRODUCTION_V1',at:new Date().toISOString(),
    production_contacted:false,real_authentication:false,model_called:false,
    owner_source_sha256:hash(owner),service_worker_sha256:hash(sw),cases};
  console.log(JSON.stringify(evidence,null,2));
  if(process.env.JAIME_REPRO_EVIDENCE)fs.writeFileSync(process.env.JAIME_REPRO_EVIDENCE,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
  assert.equal(cases[0].initial_status,200);
  assert.equal(cases[0].first_reload_status,403);
  assert.equal(cases[0].direct_new_tab_status,200);
  assert.equal(cases[0].direct_tab_reload_status,200);
  assert.equal(cases[1].first_reload_status,200);
  assert.equal(cases[1].direct_new_tab_status,200);
  assert.equal(cases[1].direct_tab_reload_status,200);
})().catch(e=>{console.error(e);process.exitCode=1;});
