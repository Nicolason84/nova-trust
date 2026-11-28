'use strict';
// Static candidate acceptance only. EVERY request is intercepted. The private
// destination is a synthetic HTML fixture, never a real service or login.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(process.env.JAIME_PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(ROOT, 'docs/jaime');
const EVIDENCE = process.env.JAIME_EVIDENCE_DIR || path.join(__dirname, 'private-entry-evidence');
const PUBLIC = 'https://nicolason84.github.io';
const PREFIX = '/nova-trust/jaime/';
const PRIVATE = 'https://jaime.nova-era.fr/ojo/jaime/';
const TYPES = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml',
  '.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.mjs':'text/javascript'};

async function intercept(context, privateRequests, unexpected) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.href === PRIVATE) {
      privateRequests.push({url:url.href, method:request.method(), body:request.postData(),
        referer:request.headers().referer || null, cookie:request.headers().cookie || null});
      return route.fulfill({contentType:'text/html',
        body:'<!doctype html><html lang="es"><title>Private destination fixture only</title><p>Static navigation test. No authentication or model.</p></html>'});
    }
    if (url.origin !== PUBLIC || !url.pathname.startsWith(PREFIX) || url.search) {
      unexpected.push(url.origin + url.pathname); return route.abort();
    }
    const name = url.pathname.slice(PREFIX.length) || 'index.html';
    if (name.includes('..')) {unexpected.push(name); return route.abort();}
    try {
      return route.fulfill({contentType:TYPES[path.extname(name)] || 'application/octet-stream',
        body:await fs.readFile(path.join(ASSETS, name))});
    } catch {
      unexpected.push(name); return route.fulfill({status:404, body:'Missing static fixture'});
    }
  });
}

async function main() {
  await fs.mkdir(EVIDENCE, {recursive:true});
  const browser = await chromium.launch({headless:true,
    ...(process.env.JAIME_BROWSER_EXECUTABLE ? {executablePath:process.env.JAIME_BROWSER_EXECUTABLE} : {})});
  const checks = [], errors = [], unexpected = [];
  try {
    const sizes = [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932}];
    for (const viewport of sizes) for (const existing of [false, true]) {
      const context = await browser.newContext({viewport, isMobile:true, hasTouch:true,
        locale:'es-ES', serviceWorkers:'block'});
      const privateRequests = [];
      await context.addInitScript(({existing, origin}) => {
        if (location.origin !== origin || sessionStorage.getItem('fixture-seeded')) return;
        sessionStorage.setItem('fixture-seeded','yes');
        localStorage.setItem('jaime_local_proofs', JSON.stringify([{note:'SYNTHETIC_LOCAL_NOTE_RETAINED'}]));
        localStorage.setItem('matrix-session-fixture','SYNTHETIC_NOT_A_REAL_SESSION');
        if (existing) localStorage.setItem('ojo-jaime-profile-v1',
          JSON.stringify({version:1,name:'Jaime',account_status:'created_local'}));
      }, {existing, origin:PUBLIC});
      await intercept(context, privateRequests, unexpected);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(PUBLIC + PREFIX + 'start.html');
      await page.locator('#privateAccessChoice').waitFor({state:'visible'});
      assert.equal(page.url(), PUBLIC + PREFIX + 'start.html');
      assert.equal(privateRequests.length, 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const initial = await page.evaluate(() => ({
        note:localStorage.getItem('jaime_local_proofs'),
        other:localStorage.getItem('matrix-session-fixture'),
        profile:localStorage.getItem('ojo-jaime-profile-v1')
      }));
      if (viewport.width === 390 && !existing)
        await page.screenshot({path:path.join(EVIDENCE, 'start-390.png'), fullPage:true});
      const popupWait = page.waitForEvent('popup');
      await page.locator('#privateAssistantEntry').click();
      const popup = await popupWait;
      await popup.waitForLoadState('domcontentloaded');
      assert.equal(popup.url(), PRIVATE);
      assert.deepEqual(privateRequests, [{url:PRIVATE, method:'GET', body:null, referer:null, cookie:null}]);
      assert.equal(await popup.evaluate(() => localStorage.length), 0);
      assert.deepEqual(await page.evaluate(() => ({
        note:localStorage.getItem('jaime_local_proofs'),
        other:localStorage.getItem('matrix-session-fixture'),
        profile:localStorage.getItem('ojo-jaime-profile-v1')
      })), initial);
      await popup.close();
      await page.locator('#entryForm button[type=submit]').click();
      await page.waitForURL(PUBLIC + PREFIX + 'index.html');
      await page.locator('#privateAssistantFromNotebook').waitFor({state:'visible'});
      assert.equal(await page.locator('#privateAssistantFromNotebook').getAttribute('href'), PRIVATE);
      assert.equal(await page.locator('a[href="mensajes.html"]').count(), 1);
      assert.equal(await page.locator('a[href="universos.html"]').count(), 1);
      assert.equal(await page.evaluate(() => localStorage.getItem('jaime_local_proofs')), initial.note);
      assert.equal(await page.evaluate(() => localStorage.getItem('matrix-session-fixture')), initial.other);
      const layout = await page.evaluate(() => {
        const ids = ['privateAssistantFromNotebook','messageInput','sendButton','appNav'];
        const boxes = Object.fromEntries(ids.map(id => {
          const el = document.getElementById(id), r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
          return [id,{left:r.left,top:r.top,right:r.right,bottom:r.bottom,
            height:r.height,visible:r.width>0 && r.height>0 && r.left>=0 && r.right<=innerWidth+1 &&
              r.top>=0 && r.bottom<=innerHeight+1,centerUncovered:!!hit && (hit===el || el.contains(hit))}];
        }));
        return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
          conversationHeight:document.getElementById('conversation').getBoundingClientRect().height,boxes};
      });
      assert.equal(layout.horizontalOverflow, false);
      for (const [id, box] of Object.entries(layout.boxes)) {
        assert.equal(box.visible, true, id+' visible at '+viewport.width);
        assert.equal(box.centerUncovered, true, id+' uncovered at '+viewport.width);
      }
      assert.ok(layout.boxes.privateAssistantFromNotebook.height>=44);
      if (viewport.width===320 && !existing)
        await page.screenshot({path:path.join(EVIDENCE,'notebook-320.png'),fullPage:true});
      assert.ok(layout.conversationHeight>=60, 'conversation retains a usable scroll area: '+JSON.stringify({viewport,layout}));
      const draft = 'Prueba local: comparar dos ganaderías. No enviar automáticamente.';
      await page.locator('#messageInput').fill(draft);
      await page.reload();
      await page.locator('#messageInput').waitFor({state:'visible'});
      assert.equal(await page.locator('#messageInput').inputValue(), draft);
      assert.equal(privateRequests.length, 1);
      if (viewport.width===390 && existing)
        await page.screenshot({path:path.join(EVIDENCE,'notebook-390.png'),fullPage:true});
      await page.locator('#helpButton').click();
      await page.locator('#installGuideButton').click();
      assert.match(await page.locator('#installGuide').innerText(), /abre primero tu asistente privado/);
      await page.locator('#helpDialog [data-close="helpDialog"]').click();
      await page.goto(PUBLIC+PREFIX+'instalar.html');
      assert.equal(await page.locator('#install-url').inputValue(), PRIVATE);
      assert.equal(await page.locator('#privateInstallEntry').getAttribute('href'), PRIVATE);
      assert.match(await page.locator('#steps-title').innerText(), /espacio privado/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), true);
      if (viewport.width===390 && !existing)
        await page.screenshot({path:path.join(EVIDENCE,'install-390.png'),fullPage:true});
      checks.push({viewport,profile:existing?'returning':'new',
        explicit_navigation_only:true,no_referrer_payload_cookie_or_local_data_transferred:true,
        notes_and_unrelated_storage_preserved:true,draft_survives_reload:true,
        private_installation_instructions:true,layout});
      await context.close();
    }
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    await context.addInitScript(() => Object.defineProperty(navigator,'standalone',{get:() => true}));
    const privateRequests = [];
    await intercept(context,privateRequests,unexpected);
    const page = await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
    await page.goto(PUBLIC+PREFIX+'instalar.html');
    assert.match(await page.locator('#device-note').innerText(), /libreta local/);
    assert.equal(await page.locator('#installed-card').isVisible(), false);
    assert.equal(await page.locator('#privateInstallEntry').isVisible(), true);
    assert.equal(privateRequests.length,0);
    await context.close();
    assert.deepEqual(errors,[]); assert.deepEqual(unexpected,[]);
    const result = {schema:'JAIME_PUBLIC_PRIVATE_ENTRY_BROWSER_ACCEPTANCE_V2',status:'PASS',
      observed_at:new Date().toISOString(),browser:'Chromium desktop with mobile viewport',
      profile_viewport_cases:checks.length,checks,old_public_standalone_case:true,
      every_network_request_intercepted:true,real_private_service_contacted:false,
      live_model_calls:0,authentication_tested:false,physical_iphone_tested:false,
      source_candidate_only:true,page_errors:errors,unexpected_requests:unexpected};
    await fs.writeFile(path.join(EVIDENCE,'browser-result.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({status:result.status,cases:checks.length+1,
      every_network_request_intercepted:true,real_private_service_contacted:false,
      evidence:EVIDENCE,physical_iphone_tested:false}));
  } finally {await browser.close();}
}
main().catch(error => {console.error(error); process.exitCode=1;});
