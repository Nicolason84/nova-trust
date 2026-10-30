'use strict';
// Source acceptance only: every HTTP request is intercepted. No Cloudflare
// session, recipient identity, production conversation or model is used.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require(process.env.JAIME_PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..'), ASSETS = path.join(ROOT, 'docs/jaime');
const GATEWAY = process.env.TUV5_PRIVATE_GATEWAY;
if (!GATEWAY) throw Error('TUV5_PRIVATE_GATEWAY must name the reviewed candidate source, never a service URL.');
const OUTPUT = process.env.TUV5_EVIDENCE_DIR || path.join(__dirname, 'identity-evidence');
const ORIGIN = 'https://jaime.nova-era.fr', PREFIX = '/ojo/jaime/';
const BASE = {ok:true,authenticated:true,tenant:'JAIME',native_execution:false,external_actions_permitted:false};
const CID = '6fb764c5-d6a6-4b5d-bf15-9715f3d31f37';
const TYPES = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function scenario(browser, name, mode, run, {width=390, interrupted=false}={}) {
  const context = await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,
    serviceWorkers:'block',locale:'es-ES'});
  const calls=[], errors=[], unexpected=[]; let afterChat=false, nextTurn=1;
  const state={mode};
  await context.addInitScript(({interrupted}) => {
    if (sessionStorage.getItem('identity-fixture-seeded')) return;
    sessionStorage.setItem('identity-fixture-seeded','yes');
    localStorage.setItem('ojo-jaime-profile-v1',JSON.stringify({version:1,name:'Prueba',account_status:'created_local'}));
    localStorage.setItem('unrelated-fixture','SYNTHETIC_UNRELATED_STORAGE');
    if (interrupted) localStorage.setItem('ojo-jaime-space-v1',JSON.stringify({version:1,activeId:'idea-fixture',preferences:{},ideas:[{
      id:'idea-fixture',title:'Prueba interrumpida',draft:'BORRADOR DE PRUEBA',messages:[{id:'message-fixture',role:'user',text:'ENVÍO SINTÉTICO INTERRUMPIDO',deliveryState:'sending',attachments:[]}],pending:[],scenarios:[]
    }]}));
  },{interrupted});
  await context.route('**/*', async route => {
    const req=route.request(), url=new URL(req.url());
    if(url.origin!==ORIGIN||!url.pathname.startsWith(PREFIX)){unexpected.push(url.origin+url.pathname);return route.abort();}
    if(url.pathname.startsWith(PREFIX+'v1/ojo/personal/')) {
      const operation=url.pathname.split('/').at(-1);
      calls.push({operation,method:req.method(),xhr:req.headers()['x-requested-with']||null});
      const respond=(status,value,type='application/json')=>route.fulfill({status,contentType:type,body:typeof value==='string'?value:JSON.stringify(value)});
      if(state.mode==='expired'||state.mode==='accepted403'&&afterChat&&operation==='status')return respond(401,'<html>Login fixture</html>','text/html');
      if(state.mode==='denied')return respond(403,'<html>Denied fixture</html>','text/html');
      if(state.mode==='html')return respond(200,'<html>Unexpected HTML fixture</html>','text/html');
      if(operation==='status')return respond(200,{...BASE,model_source_verified:true,provider_available:state.mode!=='model-unavailable'});
      if(operation==='session')return respond(200,{...BASE,csrf:'a'.repeat(64),next_turn:nextTurn,conversation_id:CID});
      if(operation==='chat') {
        const body=JSON.parse(req.postData());afterChat=true;
        if(state.mode==='accepted403')return respond(403,{...BASE,ok:false,authenticated:false,accepted:true});
        const value={...BASE,csrf:'a'.repeat(64),next_turn:++nextTurn,conversation_id:CID,turn:body.turn,
          request_id:body.request_id,messageId:body.messageId,text:'Respuesta sintética de receta. No procede de un modelo real.',
          provider:'OLLAMA_LOCAL',provider_response_complete:true,reply_origin:'LOCAL_MODEL_INFERENCE',attachmentsAnalyzed:[]};
        value.receipt={request_sha256:'b'.repeat(64),response_sha256:hash(JSON.stringify({request_id:value.request_id,
          conversation_id:CID,turn:value.turn,reply:value.text,provider:value.provider,complete:true}))};
        return respond(200,value);
      }
      unexpected.push(operation);return route.abort();
    }
    const name=url.pathname.slice(PREFIX.length)||'index.html';
    try{return route.fulfill({contentType:TYPES[path.extname(name)]||'application/octet-stream',body:await fs.readFile(name==='gateway.js'?GATEWAY:path.join(ASSETS,name))});}
    catch{unexpected.push(name);return route.fulfill({status:404,body:'Missing fixture asset'});}
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(ORIGIN+PREFIX+'index.html');
    await page.locator('#messageInput').waitFor({state:'visible'});
    await run({page,context,calls,state});
    assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-fixture')),'SYNTHETIC_UNRELATED_STORAGE');
    assert.ok(calls.every(x=>x.xhr==='XMLHttpRequest'));
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    return {name,pass:true,viewport_width:width,requests:calls.length,chat_posts:calls.filter(x=>x.operation==='chat').length};
  } finally {await context.close();}
}

async function main() {
  await fs.mkdir(OUTPUT,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.JAIME_BROWSER_EXECUTABLE?{executablePath:process.env.JAIME_BROWSER_EXECUTABLE}:{})});
  const cases=[];
  try {
    for(const width of [320,390]) cases.push(await scenario(browser,'expiration and canonical reconnect '+width,'expired',async({page,calls,state})=>{
      await page.getByRole('button',{name:'Verifica tu acceso',exact:true}).waitFor();
      await page.locator('#messageInput').fill('BORRADOR SINTÉTICO CONSERVADO');
      await page.locator('#statusButton').click();
      await page.locator('#privateReconnect').waitFor({state:'visible'});
      assert.equal(await page.locator('#privateReconnect').getAttribute('href'),ORIGIN+PREFIX);
      assert.ok((await page.locator('#privateReconnect').boundingBox()).height>=44);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(width===390)await page.screenshot({path:path.join(OUTPUT,'reconnect-390.png'),fullPage:true});
      state.mode='ready';await page.locator('#privateReconnect').click();
      await page.getByRole('button',{name:'SUPRA local · conversación privada',exact:true}).waitFor();
      assert.equal(await page.locator('#messageInput').inputValue(),'BORRADOR SINTÉTICO CONSERVADO');
      assert.equal(calls.filter(x=>x.method==='POST').length,0);
      assert.equal(await page.locator('#privateAssistantDelivery').isVisible(),false);
    },{width}));
    cases.push(await scenario(browser,'forbidden request is not an assistant reply','denied',async({page,calls})=>{
      await page.getByRole('button',{name:'Acceso no autorizado',exact:true}).waitFor();
      await page.locator('#messageInput').fill('PREGUNTA SINTÉTICA RECHAZADA');await page.locator('#sendButton').click();
      await page.getByText('El servicio no ha autorizado esta solicitud.',{exact:false}).first().waitFor();
      assert.equal(calls.filter(x=>x.method==='POST').length,0);
      assert.ok(await page.evaluate(()=>localStorage.getItem('ojo-jaime-space-v1').includes('PREGUNTA SINTÉTICA RECHAZADA')));
    }));
    cases.push(await scenario(browser,'accepted 403 cannot be replayed after reconnect','accepted403',async({page,calls,state})=>{
      await page.getByRole('button',{name:'SUPRA local · conversación privada',exact:true}).waitFor();
      await page.locator('#jaimePrivateConversationConsent').check();
      await page.locator('#messageInput').fill('ENVÍO SINTÉTICO ACEPTADO SIN RESPUESTA');await page.locator('#sendButton').click();
      await page.getByText('Este envío necesita una comprobación antes de repetirse.',{exact:false}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Reintentar análisis',exact:true}).count(),0);
      state.mode='ready';await page.reload();await page.locator('#messageInput').waitFor();
      assert.equal(await page.getByRole('button',{name:'Reintentar análisis',exact:true}).count(),0);
      assert.equal(calls.filter(x=>x.operation==='chat').length,1);
      const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('ojo-jaime-space-v1')));
      assert.equal(record.ideas[0].messages.find(x=>x.role==='user').deliveryState,'uncertain');
      await page.screenshot({path:path.join(OUTPUT,'uncertain-message-390.png'),fullPage:true});
    }));
    cases.push(await scenario(browser,'interrupted send restored without replay','ready',async({page,calls})=>{
      await page.getByText('La aplicación se cerró durante un envío.',{exact:false}).waitFor();
      assert.equal(await page.locator('#messageInput').inputValue(),'BORRADOR DE PRUEBA');
      assert.equal(calls.filter(x=>x.method==='POST').length,0);
      assert.equal(await page.getByRole('button',{name:'Reintentar análisis',exact:true}).count(),0);
      const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('ojo-jaime-space-v1')));
      assert.equal(record.ideas[0].messages[0].deliveryState,'uncertain');
      await page.reload();assert.equal((await page.getByText('La aplicación se cerró durante un envío.',{exact:false}).all()).length,1);
    },{interrupted:true}));
    cases.push(await scenario(browser,'offline and online preserve draft without POST','ready',async({page,context,calls})=>{
      await page.getByRole('button',{name:'SUPRA local · conversación privada',exact:true}).waitFor();
      await page.locator('#messageInput').fill('BORRADOR SIN RED');await context.setOffline(true);
      await page.getByRole('button',{name:'Sin conexión',exact:true}).waitFor();
      assert.equal(await page.locator('#messageInput').inputValue(),'BORRADOR SIN RED');
      await context.setOffline(false);await page.getByRole('button',{name:'SUPRA local · conversación privada',exact:true}).waitFor();
      assert.equal(calls.filter(x=>x.method==='POST').length,0);
    }));
    cases.push(await scenario(browser,'HTML success cannot authenticate','html',async({page,calls})=>{
      await page.getByRole('button',{name:'Respuesta no verificada',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>JaimeGateway.access().authenticated),false);
      assert.equal(calls.filter(x=>x.method==='POST').length,0);
    }));
    cases.push(await scenario(browser,'model outage does not demand new login','model-unavailable',async({page})=>{
      await page.getByRole('button',{name:'Asistente temporalmente no disponible',exact:true}).waitFor();
      await page.locator('#statusButton').click();
      assert.equal(await page.locator('#privateReconnect').isVisible(),false);
      assert.match(await page.locator('#healthExplanation').textContent(),/No necesitas volver/);
      assert.equal(await page.evaluate(()=>JaimeGateway.access().authenticated),true);
    }));
    cases.push(await scenario(browser,'synthetic response and local reload preserve transcript','ready',async({page,calls})=>{
      await page.getByRole('button',{name:'SUPRA local · conversación privada',exact:true}).waitFor();
      await page.locator('#jaimePrivateConversationConsent').check();
      await page.locator('#messageInput').fill('PREGUNTA DE RECETA, SIN DATOS PERSONALES');await page.locator('#sendButton').click();
      await page.getByText('Respuesta sintética de receta. No procede de un modelo real.',{exact:true}).waitFor();
      await page.reload();await page.getByText('Respuesta sintética de receta. No procede de un modelo real.',{exact:true}).waitFor();
      assert.equal(calls.filter(x=>x.operation==='chat').length,1);
      const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('ojo-jaime-space-v1')));
      assert.equal(record.ideas[0].messages.find(x=>x.role==='user').deliveryState,'confirmed');
    }));
    const result={schema:'JAIME_ACCESS_SESSION_BROWSER_FIXTURE_V1',at:new Date().toISOString(),producer:'CHATGPT_TEST_RUNNER',
      pass:true,cases,all_network_intercepted:true,real_authentication:false,real_model:false,physical_device:false,service_worker_tested:false};
    await fs.writeFile(path.join(OUTPUT,'browser-result.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
