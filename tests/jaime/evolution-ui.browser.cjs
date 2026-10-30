const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'../../docs/jaime');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
(async () => {
  const server = http.createServer(async (req,res) => {
    try {
      const rel = new URL(req.url,'http://localhost').pathname.replace(/^\//,'') || 'index.html';
      const file = path.resolve(root,rel);
      if (!file.startsWith(root+path.sep)) throw new Error('Outside fixture');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}); res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end('Fixture not found'); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',acceptDownloads:true});
    const external = [];
    const base = 'http://127.0.0.1:'+server.address().port;
    await context.route('**/*',route => {
      if (!route.request().url().startsWith(base+'/')) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/index.html');
    await page.locator('#helpButton').click();
    await page.locator('#personalMemory').fill('PRIVATE_SYNTHETIC_DO_NOT_EXPORT');
    await page.locator('#faithPreference').check();
    await page.locator('#preferencesForm button[type=submit]').click();
    await page.locator('#helpDialog [data-close]').click();
    await page.locator('#messageInput').fill('PRIVATE_SYNTHETIC_DRAFT_DO_NOT_EXPORT');
    await page.evaluate(() => localStorage.setItem('helene-control-fixture','OTHER_APP_SYNTHETIC'));
    await page.locator('#evolutionOpen').click();
    await assert.equal(await page.locator('#evolutionDialog').evaluate(d=>d.open),true);
    for (const id of ['Memory','Observations','Suggestions','TechnicalSharing']) assert.equal(await page.locator('#evolution'+id).isChecked(),false);
    assert.equal(await page.locator('#evolutionExport').isDisabled(),true);
    for (const id of ['Memory','Observations','Suggestions','TechnicalSharing']) await page.locator('#evolution'+id).check();
    await page.locator('#evolutionDetail').selectOption('standard');
    await page.locator('#evolutionCadence').selectOption('on_open');
    await page.locator('#evolutionConsentForm button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('evolutionProposals').children.length>0);
    const count=await page.locator('#evolutionProposals > section').count();
    await page.locator('#evolutionRefresh').click();
    await page.locator('#evolutionRefresh').click();
    assert.equal(await page.locator('#evolutionProposals > section').count(),count,'Repeated same problem must not duplicate proposal');
    await page.locator('#evolutionProposals').getByRole('button',{name:'Me interesa',exact:true}).first().click();
    assert.match(await page.locator('#evolutionStatus').innerText(),/Propuestas|propuestas/);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#evolutionExport').click();
    const download=await downloadPromise;
    const contribution=JSON.parse(await fs.readFile(await download.path(),'utf8'));
    assert.equal(JSON.stringify(contribution).includes('PRIVATE_SYNTHETIC'),false);
    assert.equal(external.length,0,'Technical contribution remains local until explicit admitted transfer');
    await page.locator('#evolutionDialog [data-close]').click();
    await page.reload();
    await page.locator('#evolutionOpen').click();
    assert.equal(await page.locator('#evolutionDetail').inputValue(),'standard');
    assert.equal(await page.locator('#evolutionCadence').inputValue(),'on_open');
    const second = await context.newPage();
    await second.goto(base+'/index.html');
    await second.locator('#evolutionOpen').click();
    await second.locator('#evolutionForget').click();
    await page.waitForFunction(() => document.getElementById('evolutionMemory').checked === false);
    await second.close();
    for (const id of ['Memory','Observations','Suggestions','TechnicalSharing']) assert.equal(await page.locator('#evolution'+id).isChecked(),false);
    const retained = await page.evaluate(() => ({jaime:JSON.parse(localStorage.getItem('ojo-jaime-space-v1')),other:localStorage.getItem('helene-control-fixture')}));
    assert.equal(retained.jaime.preferences.memoryText,'PRIVATE_SYNTHETIC_DO_NOT_EXPORT');
    assert.equal(retained.jaime.ideas[0].draft,'PRIVATE_SYNTHETIC_DRAFT_DO_NOT_EXPORT');
    assert.equal(retained.other,'OTHER_APP_SYNTHETIC');
    const corrupt = await page.evaluate(() => {
      const module = window.NovaEvolution.create({appId:'jaime',scope:'personal',storage:localStorage});
      module.setConsent({memory:true,observations:true,suggestions:true,technicalSharing:true});
      module.setPreferences({language:'es',detail:'short',cadence:'on_open'});
      const key='nova:ojo:evolution:v1:jaime:personal';
      const saved=JSON.parse(localStorage.getItem(key)); saved.preferences.language=null;
      const raw=JSON.stringify(saved); localStorage.setItem(key,raw); return raw;
    });
    await page.reload(); await page.locator('#evolutionOpen').click();
    for (const id of ['Memory','Observations','Suggestions','TechnicalSharing']) assert.equal(await page.locator('#evolution'+id).isChecked(),false);
    assert.equal(await page.evaluate(() => localStorage.getItem('nova:ojo:evolution:v1:jaime:personal')),corrupt);
    await page.locator('#evolutionMemory').check();
    await page.locator('#evolutionConsentForm button[type=submit]').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('nova:ojo:evolution:v1:jaime:personal')),corrupt,'Corrupt preferences must survive until explicit forget');
    await page.locator('#evolutionForget').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('nova:ojo:evolution:v1:jaime:personal')),null);
    assert.equal(await page.evaluate(() => localStorage.getItem('helene-control-fixture')),'OTHER_APP_SYNTHETIC');
    assert.equal(errors.length,0,errors.join('\n'));
    assert.equal(external.length,0);
    console.log(JSON.stringify({status:'PASS',viewport:'390x844',consent_default:'OFF',real_signal:'CHAT_UNAVAILABLE_FROM_EXISTING_GATEWAY',suggestions_deduplicated:true,preferences_restored:true,cross_tab_revocation_observed:true,corrupt_preferences_fail_closed_and_preserved_until_forget:true,contribution_private_payload_absent:true,external_requests:external.length,forget_preserves_notebook_and_other_app:true,conversation_activated:false}));
  } finally {await browser?.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
