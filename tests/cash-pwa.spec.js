import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer,BASE} from '../scripts/server.js';
test('v1.4: PWA migra desde v1.3 y conserva ajuste/caja al actualizar offline',{timeout:120000},async()=>{
 let phase=0;const server=createServer((file,data)=>phase===0?execFileSync('git',['show',`981b017643c1cd377a7cecd99b960fe1f0f1ea67:${file}`]):file==='sw.js'&&phase>=2?data.toString().replace('1.4.0','1.4.0-test'+phase):data);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';const browser=await chromium.launch({headless:true,...(existsSync(edge)?{executablePath:edge}:{})});
 try{const context=await browser.newContext();await context.route('https://api.frankfurter.dev/**',r=>r.fulfill({json:{date:new Date().toISOString().slice(0,10),base:'USD',quote:'MXN',rate:18}}));const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));const url=`http://localhost:${server.address().port}${BASE}`;await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 phase=1;await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await p.locator('#pwa-update').waitFor({state:'visible'});await p.locator('#apply-update').click();await p.locator('#cash-title').waitFor();
 await p.locator('#cash-management > summary').click();await p.locator('#cash-verify-mxn').click();await p.locator('#cash-dialog [data-denom="20000"]').fill('1');await p.locator('#cash-dialog [data-denom="10000"]').fill('1');await p.locator('#physical-count').check();await p.getByRole('button',{name:'Guardar conteo verificado',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});
 await p.locator('#prices input').fill('270');await p.locator('#received-mxn').fill('500');await p.locator('#prepare-change').click();await p.locator('#cash-adjust').click();await p.locator('#cash-extra-value').fill('70');await p.locator('#cash-dialog [data-denom="5000"]').fill('1');await p.locator('#cash-dialog [data-denom="2000"]').fill('1');await p.locator('#physical-extra').check();await p.getByRole('button',{name:'Aplicar adicional recibido',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});assert.equal(await p.locator('#change').textContent(),'$300.00 MXN');
 const before=await p.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('cuenta-clara:cash:v1:')))));
 phase=2;
 await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await p.locator('#pwa-update').waitFor({state:'visible'});
 assert.equal(await p.locator('#change').textContent(),'$300.00 MXN');
 await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.locator('#apply-update').click()]);
 await p.waitForFunction(()=>document.querySelector('#received-mxn')?.disabled && document.querySelector('#received-mxn').value==='500' && document.querySelector('#cash-banner').textContent.includes('$70.00'));
 await p.waitForFunction(async()=>!(await caches.keys()).some(k=>k.endsWith('1.4.0')));
 assert.equal(await p.locator('#change').textContent(),'$300.00 MXN');
 assert.ok(await p.locator('#received-mxn').isDisabled());
 await context.setOffline(true);await p.reload();assert.equal(await p.locator('#change').textContent(),'$300.00 MXN');const after=await p.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('cuenta-clara:cash:v1:')))));assert.deepEqual(after.cash,before.cash);assert.deepEqual(after.pending,before.pending);assert.equal(after.cash.MXN.counts[5000],0);
 const cached=await p.evaluate(async()=>{const keys=await caches.keys();const c=await caches.open(keys.find(k=>k.endsWith('1.4.0-test2')));return(await c.keys()).map(x=>x.url);});for(const f of ['cash-ui.js','cash-ledger.js','change-engine.js','change-worker.js'])assert.ok(cached.includes(url+f));
 await context.setOffline(false);await p.locator('#prepare-change').click();await p.locator('#cash-cancel-extra').click();await p.locator('#physical-return-extra').check();await p.getByRole('button',{name:'Cancelar ajuste confirmado',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});await p.locator('#reset').click();await p.locator('#physical-discard').check();await p.getByRole('button',{name:'Descartar cuenta',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});
 // Una captura que no puede guardarse bloquea la actualización, en vez de perderla.
 await p.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith(':capture'))throw Error('Sin espacio');return original.call(this,k,v);};});await p.locator('#prices input').fill('12');assert.match(await p.locator('#cash-error').textContent(),/captura inmediata/);
 phase=3;await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await p.locator('#pwa-update').waitFor({state:'visible'});await p.locator('#apply-update').click();await p.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('No se aplicó'));assert.equal(await p.locator('#prices input').inputValue(),'12');assert.ok(await p.locator('#pwa-update').isVisible());
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
