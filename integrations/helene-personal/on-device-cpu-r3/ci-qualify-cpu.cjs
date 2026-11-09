// One-shot real-browser qualification on the existing public CI infrastructure.
// Refuses the Mac. No model, browser, daemon or server is started there.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
assert.equal(process.platform,'linux','CI_LINUX_REQUIRED');assert.equal(process.env.GITHUB_ACTIONS,'true','EXISTING_GITHUB_CI_REQUIRED');
const root=path.resolve(process.argv[2]),out=fs.mkdtempSync(path.join(os.tmpdir(),'helene-cpu-real-'));
const names=new Set(fs.readdirSync(root)),logs=[],writes=[],network=[],errors=[],timings={},checks=[];
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.split('/').pop()||'index.html';if(req.method!=='GET'||!names.has(name)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',name.endsWith('.mjs')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,name)))});
let chrome,id=0,buffer='',pending=new Map();
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT:'+method))},360000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})})+'\0')})}
function check(name,value){assert.ok(value,name);checks.push({name,pass:true});console.log('CHECK_PASS '+name)}
async function evaluate(s,expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true},s);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(s,expression,seconds=330){const start=Date.now();for(;;){const r=await evaluate(s,`({ok:!!(${expression}),error:document.getElementById('error')?.textContent||'',progress:document.getElementById('download')?.textContent||''})`);if(r.ok)return;if(r.error)throw Error(r.error);if(errors.length)throw Error(errors[0]);if(Date.now()-start>seconds*1000)throw Error('WAIT_FAILED '+expression+' '+JSON.stringify(r));await delay(500)}}
async function tab(url){const t=await send('Target.createTarget',{url:'about:blank'}),s=(await send('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;await send('Page.enable',{},s);await send('Runtime.enable',{},s);await send('Network.enable',{},s);await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},s);await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);await send('Page.navigate',{url},s);await wait(s,"!!document.querySelector('#local-consent')",30);return {id:t.targetId,session:s}}
async function submit(s,message,count){const at=Date.now();await evaluate(s,`document.getElementById('message').value=${JSON.stringify(message)};document.getElementById('composer').requestSubmit();true`);await wait(s,`document.querySelectorAll('.bubble.assistant').length===${count}`);timings['turn_'+count+'_ms']=Date.now()-at;return evaluate(s,'[...document.querySelectorAll(".bubble.assistant p")].at(-1).textContent')}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 const binary=cp.execFileSync('which',['google-chrome'],{encoding:'utf8'}).trim();
 chrome=cp.spawn(binary,['--headless=new','--disable-gpu','--disable-features=WebGPU,Vulkan','--disable-blink-features=WebGPU','--no-sandbox','--remote-debugging-pipe','--user-data-dir='+out+'/profile','--disk-cache-dir='+out+'/http-cache','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions'],{stdio:['ignore',fs.openSync(out+'/chrome.log','a'),fs.openSync(out+'/chrome.log','a'),'pipe','pipe']});
 chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!raw)continue;const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);if(!p)continue;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else{
  if(m.method==='Target.attachedToTarget'){const s=m.params.sessionId;Promise.resolve().then(()=>send('Network.enable',{},s)).then(()=>send('Runtime.enable',{},s)).then(()=>send('Runtime.runIfWaitingForDebugger',{},s)).catch(e=>errors.push(e.message));}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  if(m.method==='Runtime.consoleAPICalled')for(const a of m.params.args??[])if(typeof a.value==='string')logs.push(a.value.slice(0,1600));
  if(m.method==='Network.requestWillBeSent'){const r=m.params.request;network.push({method:r.method,url:r.url.split('?')[0]});if(!['GET','HEAD'].includes(r.method))writes.push({method:r.method,url:r.url.split('?')[0]});}
 }} });
 const browser=await send('Browser.getVersion'),a=await tab(url),s=a.session;
 const gpu=await evaluate(s,'!!navigator.gpu');check('no_webgpu_api_in_browser',!gpu);
 check('cross_origin_isolation_not_required',await evaluate(s,'!crossOriginIsolated'));
 check('mobile_no_horizontal_overflow',await evaluate(s,'document.documentElement.scrollWidth<=innerWidth+1'));
 await evaluate(s,"document.getElementById('local-consent').checked=true;document.getElementById('connect').click();true");
 const init=Date.now();await wait(s,"document.getElementById('connection').textContent==='Assistant sur ce téléphone'");timings.initial_load_ms=Date.now()-init;
 const marker='TILLEUL-'+crypto.randomBytes(3).toString('hex').toUpperCase();
 const first=await submit(s,'Mon code est '+marker+' et ma promenade est dimanche. Réponds en une courte phrase en français.',1);
 check('first_true_cpu_response_nonempty',first.trim().length>2);
 const second=await submit(s,'Rappelle uniquement mon code et le jour de ma promenade.',2);
 check('second_true_cpu_response_recalls_context',second.includes(marker)&&second.toLowerCase().includes('dimanche'));
 const raw=await evaluate(s,"localStorage.getItem('helene.on-device.conversation.v1')"),hash=crypto.createHash('sha256').update(raw).digest('hex');
 await send('Target.closeTarget',{targetId:a.id});await delay(1000);
 const b=await tab(url),t=b.session;
 await wait(t,"document.querySelectorAll('.bubble.assistant').length===2");
 check('history_after_actual_tab_close',await evaluate(t,"localStorage.getItem('helene.on-device.conversation.v1')")==raw);
 await wait(t,"document.getElementById('connection').textContent==='Assistant sur ce téléphone'");
 const third=await submit(t,'Quel était mon code et quel jour avions-nous choisi ?',3);
 check('third_true_cpu_response_after_reopen',third.includes(marker)&&third.toLowerCase().includes('dimanche'));
 const record=JSON.parse(await evaluate(t,"localStorage.getItem('helene.on-device.conversation.v1')"));
 check('all_rows_actual_cpu_provenance',record.data.rows.length===3&&record.data.rows.every(r=>r.provider_backend==='wasm'&&r.usage.completion_tokens>0&&r.engine_fingerprint==='fa631e0762d75ac6a0d873b2073ced3ad1f5ded1b009835cbce2c2b0146503ec'));
 check('no_network_writes',writes.length===0);check('no_javascript_exception',errors.length===0);
 check('no_cloudflare_or_mac_endpoint',!network.some(r=>/tony\.nova-era|localhost:11434|127\.0\.0\.1:11434|cloudflareaccess/.test(r.url)));
 const result={schema:'HELENE_REAL_CPU_BROWSER_ACCEPTANCE_R3',status:'PASS',browser:browser.product,gpu_available:gpu,cross_origin_isolated:false,real_generation_calls:3,backend:'wasm',threads:1,physical_android_tested:false,all_data_synthetic:true,history_before_reopen_sha256:hash,synthetic_replies:[first,second,third],timings,checks,network_methods:[...new Set(network.map(r=>r.method))],worker_errors:errors};
 console.log('BEGIN_HELENE_REAL_CPU_RESULT\n'+JSON.stringify(result,null,2)+'\nEND_HELENE_REAL_CPU_RESULT');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Hélène — vraie génération CPU sans WebGPU\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n');
}
main().catch(error=>{console.error('HELENE_REAL_CPU_FAILED '+error.stack);console.error('BROWSER_ERRORS '+JSON.stringify(errors));console.error('BROWSER_LOG '+JSON.stringify(logs.slice(-12)));if(fs.existsSync(out+'/chrome.log'))console.error(fs.readFileSync(out+'/chrome.log','utf8').slice(-3000));process.exitCode=1}).finally(async()=>{if(chrome){try{await send('Browser.close')}catch{}chrome.kill('SIGTERM')}server.close();for(const p of pending.values())clearTimeout(p.timer)});
