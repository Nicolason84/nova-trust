/* Local synthetic browser qualification; no recipient session or external request. */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../docs/helene');
const KEY='nova:ojo:evolution:v1:helene:personal';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
(async()=>{
  const server=http.createServer(async(req,res)=>{
    try{
      const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'ouvrir.html';
      const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))throw Error('OUTSIDE_FIXTURE');
      const raw=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(raw);
    }catch{res.writeHead(404);res.end('Fixture missing')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const base='http://127.0.0.1:'+server.address().port,external=[],writes=[];
    await context.route('**/*',async route=>{
      const request=route.request();
      if(new URL(request.url()).origin!==base){external.push(request.url());return route.abort()}
      if(request.method()!=='GET')writes.push(request.method());
      return route.continue();
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/ouvrir.html');await page.locator('#evolution-title').waitFor();
    assert.equal(await page.locator('[data-evolution-consent]').count(),4);
    assert.equal(await page.locator('[data-evolution-consent]:checked').count(),0);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);
    await page.evaluate(async()=>{
      const {WorkspaceClient}=await import('./device-client.mjs');const {makeItem}=await import('./core.mjs');
      const client=new WorkspaceClient(),state=await client.load();
      state.items.push(await makeItem({title:'Synthetic task',text:'PRIVATE_SENTINEL_SYNTHETIC',next:'Synthetic next step'}));
      await client.save(state);
    });
    await page.reload();await page.locator('#evolution-title').waitFor();
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null,'opening private notes with consent off must not observe them');
    const openChoices=async p=>{const details=p.locator('.evolution-panel details');if(!await details.evaluate(e=>e.open))await details.locator('summary').click()};
    await openChoices(page);await page.locator('[data-evolution-consent="observations"]').check();
    await openChoices(page);await page.locator('[data-evolution-consent="suggestions"]').check();
    await page.locator('.evolution-suggestion').waitFor();
    const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);
    assert.equal(raw.includes('PRIVATE_SENTINEL'),false);assert.equal(raw.includes('Synthetic'),false);
    assert.equal(JSON.parse(raw).health.PENDING_TASK.state,'OBSERVED');
    await page.locator('[data-evolution-decision="accept"]').click();
    assert.equal(await page.getByRole('link',{name:'Retrouver mes prochains petits pas'}).getAttribute('href'),'#elements');
    await page.locator('[data-evolution-decision="refuse"]').click();
    assert.match(await page.locator('.evolution-suggestion').innerText(),/mise de côté/);
    await page.locator('[data-evolution-decision="cancel"]').click();
    assert.match(await page.locator('.evolution-suggestion').innerText(),/Choix annulé/);
    await openChoices(page);await page.locator('[data-evolution-consent="memory"]').check();
    await openChoices(page);await page.locator('#evolution-detail').selectOption('short');
    await page.locator('#evolution-preferences').getByRole('button',{name:'Garder mes préférences'}).click();
    await page.reload();await page.locator('#evolution-title').waitFor();await openChoices(page);
    assert.equal(await page.locator('#evolution-detail').inputValue(),'short');
    await page.locator('#evolution-cadence').selectOption('off');
    await page.locator('#evolution-preferences').getByRole('button',{name:'Garder mes préférences'}).click();
    assert.equal(await page.locator('.evolution-suggestion').count(),0);
    assert.match(await page.locator('.evolution-panel').innerText(),/choisi de masquer/);
    await openChoices(page);await page.locator('#evolution-cadence').selectOption('on_open');
    await page.locator('#evolution-preferences').getByRole('button',{name:'Garder mes préférences'}).click();
    const second=await context.newPage();await second.goto(base+'/ouvrir.html');await second.locator('#evolution-title').waitFor();await openChoices(second);
    await second.locator('[data-evolution-consent="observations"]').uncheck();
    await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('nova:ojo:evolution:v1:helene:personal')).consent.observations);
    assert.equal(await page.locator('[data-evolution-consent="observations"]').isChecked(),false);
    assert.equal(await page.locator('.evolution-suggestion').count(),0);
    const stored=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),KEY));assert.equal(stored.events.length,0);assert.deepEqual(stored.health,{});
    const isolated=await page.evaluate(()=>{
      const other=NovaEvolution.create({appId:'deivid',scope:'personal',storage:localStorage});other.setConsent({memory:true});other.setPreferences({language:'es'});
      return {other:other.preferences(),here:JSON.parse(localStorage.getItem('nova:ojo:evolution:v1:helene:personal')).preferences};
    });assert.equal(isolated.other.language,'es');assert.equal(isolated.here.language,'fr');
    await openChoices(page);await page.locator('[data-evolution-consent="technicalSharing"]').check();await openChoices(page);
    await page.locator('[data-evolution-review]').click();
    const report=await page.locator('.evolution-review').innerText(),value=JSON.parse(report);
    assert.equal(Object.keys(value).length,10);assert.equal(value.privacy,'TECHNICAL_ENUMS_ONLY');
    for(const forbidden of ['PRIVATE_SENTINEL','Synthetic','appId','tenant','created_at'])assert.equal(report.includes(forbidden),false);
    await openChoices(page);await page.locator('[data-evolution-forget]').click();
    assert.equal(await page.locator('[data-evolution-consent]:checked').count(),0);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);
    assert.ok(await page.evaluate(()=>localStorage.getItem('nova:ojo:evolution:v1:deivid:personal')));
    const notes=await page.evaluate(async()=>{const {WorkspaceClient}=await import('./device-client.mjs');return (await new WorkspaceClient().load()).items.map(i=>i.originalText)});
    assert.ok(notes.includes('PRIVATE_SENTINEL_SYNTHETIC'));
    await page.evaluate(async()=>{const {WorkspaceClient}=await import('./device-client.mjs');const client=new WorkspaceClient(),state=await client.load();state.items=state.items.map(item=>({...item,demo:true}));await client.save(state)});
    await page.reload();await page.locator('#evolution-title').waitFor();await openChoices(page);
    await page.locator('[data-evolution-consent="observations"]').check();await page.locator('[data-evolution-consent="suggestions"]').check();
    assert.equal(await page.locator('.evolution-suggestion').count(),0,'demo examples must not be treated as a personal pending task');
    assert.deepEqual(external,[]);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({schema:'NOVA_HELENE_EVOLUTION_BROWSER_QA_V1',status:'PASS',fixture:'SYNTHETIC_LOCAL_ONLY',viewport:'390x844',default_off:true,real_existing_note_metadata_observed_after_opt_in:true,proposal_decisions_and_cancel:true,preferences_persist_and_cadence_off:true,cross_tab_revoke:true,app_namespace_isolation:true,closed_export_without_note_content:true,forget_preserves_notes_and_other_app:true,demo_observation_excluded:true,external_requests:external.length,network_writes:writes.length,recipient_phone_usage_verified:false,owner_connection:'CANDIDATE_NOT_CONNECTED'},null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
