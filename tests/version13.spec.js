import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer,BASE} from '../scripts/server.js';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('v1.3: desplegables accesibles, teclado alternativo y PWA desde v1.2',{timeout:120000},async()=>{
  let legacy=true;
  const server=createServer((file,data)=>legacy?execFileSync('git',['show',`v1.2.0:${file}`]):data);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({headless:true,...(existsSync(edge)?{executablePath:edge}:{})});
  try{
    const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});
    await context.route('https://api.frankfurter.dev/**',r=>r.fulfill({json:{date:new Date().toISOString().slice(0,10),base:'USD',quote:'MXN',rate:18}}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=`http://localhost:${server.address().port}${BASE}`;
    await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.locator('#prices input').fill('350');await page.locator('#received-mxn').fill('400');
    legacy=false;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
    await page.locator('#pwa-update').waitFor({state:'visible'});
    assert.equal(await page.locator('#change').textContent(),'$50.00 MXN');
    await page.locator('#apply-update').click();await page.locator('#quote-toggle').waitFor();
    await page.waitForFunction(async()=>!(await caches.keys()).some(k=>k.endsWith(':1.2.0')));
    await page.waitForFunction(()=>document.querySelector('#rate-value').textContent.includes('$18'));
    assert.ok(await page.locator('#keypad').isHidden());
    for(const prefix of ['quote','summary']){
      assert.equal(await page.locator(`#${prefix}-toggle`).getAttribute('aria-expanded'),'false');
      assert.ok(await page.locator(`#${prefix}-panel`).isHidden());
      assert.equal(await page.locator(`#${prefix}-toggle`).getAttribute('aria-controls'),`${prefix}-panel`);
    }
    assert.ok(await page.locator('#rate-reference').isVisible());assert.match(await page.locator('#rate-reference').textContent(),/Fecha de referencia:/);
    assert.equal(await page.locator('#result-state').textContent(),'Por completar');
    const key=k=>page.locator(`#keypad button[data-key="${k}"]`).click();
    await page.locator('#prices input').focus();
    assert.equal(await page.locator('#prices input').getAttribute('inputmode'),'none');
    const priceID=await page.locator('#prices input').getAttribute('id');
    assert.equal(await page.locator(`[data-input="${priceID}"]`).getAttribute('aria-expanded'),'true');
    for(const k of ['3','5','0','.','0','5'])await key(k);
    await page.locator('#keypad-done').click();assert.ok(await page.locator('#keypad').isHidden());
    assert.equal(await page.locator('#prices input').inputValue(),'350.05');
    assert.equal(await page.locator(`[data-input="${priceID}"]`).getAttribute('aria-expanded'),'false');
    await page.locator(`[data-input="${priceID}"]`).click();await key('backspace');await key('5');
    await page.locator('#keypad-native').click();assert.ok(await page.locator('#keypad').isHidden());
    assert.equal(await page.locator('#prices input').getAttribute('inputmode'),'decimal');
    await page.locator('#prices input').press('End');await page.locator('#prices input').press('Backspace');await page.locator('#prices input').press('5');
    assert.equal(await page.locator('#prices input').inputValue(),'350.05');
    await page.locator(`[data-input="${priceID}"]`).click();assert.equal(await page.locator('#prices input').getAttribute('inputmode'),'none');
    await page.locator('#keypad-done').focus();await page.locator('#keypad-done').press('Escape');assert.ok(await page.locator('#keypad').isHidden());
    await page.locator('input[value=combined]').check();await page.locator('#rate-mode').selectOption('manual');await page.locator('#manual-rate').fill('18');
    await page.locator('#received-mxn').focus();for(const k of ['2','0','0','.','1','0'])await key(k);
    await page.locator('#received-usd').focus();for(const k of ['8','.','3','3'])await key(k);
    assert.equal(await page.locator('#received-mxn').inputValue(),'200.10');
    assert.match(await page.locator('#keypad-target').textContent(),/USD/);
    await page.locator('#keypad-done').click();assert.equal(await page.locator('#result-state').textContent(),'Pago insuficiente');
    assert.equal(await page.locator('#change').textContent(),'$0.01 MXN');assert.ok(await page.locator('#change').isVisible());
    await page.locator('#summary-toggle').focus();await page.locator('#summary-toggle').press('Enter');
    assert.equal(await page.locator('#summary-toggle').getAttribute('aria-expanded'),'true');
    await page.locator('#copy-summary').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Cantidad faltante: \$0.01 MXN/);
    await page.locator('#summary-toggle').click();assert.ok(await page.locator('#summary-panel').isHidden());assert.ok(await page.locator('#change').isVisible());
    await page.getByRole('button',{name:'Agregar 1 USD',exact:true}).click();assert.equal(await page.locator('#result-state').textContent(),'Pago completo');
    assert.equal(await page.locator('#change').textContent(),'$17.99 MXN');
    const bill=page.getByRole('button',{name:'Agregar 1 USD',exact:true});assert.equal(await bill.getAttribute('aria-pressed'),null);
    await page.locator('#quote-toggle').focus();await page.locator('#quote-toggle').press('Space');assert.ok(await page.locator('#rate-dates').isVisible());
    await page.locator('#quote-toggle').click();assert.ok(await page.locator('#quote-panel').isHidden());assert.ok(await page.locator('#rate-reference').isVisible());
    for(const width of [320,360,390,768,1280]){
      await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`desbordamiento a ${width}`);
      await page.locator('#received-usd').focus();
      const geometry=await page.evaluate(()=>{const p=document.querySelector('#keypad').getBoundingClientRect(),i=document.querySelector('#received-usd').getBoundingClientRect(),r=document.querySelector('.change').getBoundingClientRect();return {inputBefore:p.top>=i.bottom,resultAfter:r.top>=p.bottom,position:getComputedStyle(document.querySelector('#keypad')).position};});
      assert.ok(geometry.inputBefore&&geometry.resultAfter);assert.notEqual(geometry.position,'fixed');
      assert.ok(await page.locator('#keypad-done').evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;}));
      await page.locator('#keypad-done').click();await page.screenshot({path:`test-results/v13-${width}.png`,fullPage:true});
    }
    assert.equal(await page.locator('#summary-toggle').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    // La API falla, pero el error queda visible aunque los detalles estén cerrados.
    await context.unroute('https://api.frankfurter.dev/**');await context.route('https://api.frankfurter.dev/**',r=>r.abort());
    await page.locator('#rate-mode').selectOption('auto');await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#rate-status').textContent.includes('No se pudo'));
    assert.ok(await page.locator('#rate-status').isVisible());assert.equal(await page.locator('#result-state').textContent(),'Por completar');
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('Sin conexión'));
    assert.ok(await page.locator('#rate-status').isVisible());assert.ok(await page.locator('#refresh').isDisabled());
    await page.locator('input[value=combined]').check();await page.locator('#rate-mode').selectOption('saved');assert.match(await page.locator('#rate-reference').textContent(),/Fecha de referencia:/);assert.match(await page.locator('#payment-rate').textContent(),/Referencia anterior/);
    await page.locator('#prices input').fill('350');await page.locator('#received-mxn').fill('200');await page.locator('#received-usd').fill('10');
    assert.equal(await page.locator('#change').textContent(),'$30.00 MXN');
    await page.locator('#summary-toggle').click();await page.locator('#copy-summary').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Cambio a entregar: \$30.00 MXN/);
    const urls=await page.evaluate(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.endsWith('1.3.0-dev.1')));return(await c.keys()).map(r=>r.url);});
    assert.ok(urls.includes(url+'icons.js')&&urls.includes(url+'ui.js'));
    await context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#connection').textContent==='Con conexión');assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
