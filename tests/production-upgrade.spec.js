import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer,BASE} from '../scripts/server.js';
import {validateSession} from '../cash-ledger.js';
import {currentVersion} from './pwa-helpers.js';
const previous='0ac0c1320d40c7a79e4e9ff4937c83a7c560c583';
test('producción: actualizar versión oficial anterior conserva inventario y cobro bloqueado',{timeout:120000},async()=>{
 let legacy=true;
 const server=createServer((file,data)=>legacy?execFileSync('git',['show',previous+':'+file]):data);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
 const browser=await chromium.launch({headless:true,...(existsSync(edge)?{executablePath:edge}:{})});
 try{
  const context=await browser.newContext();await context.route('https://api.frankfurter.dev/**',r=>r.fulfill({json:{date:new Date().toISOString().slice(0,10),base:'USD',quote:'MXN',rate:18}}));
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:'+server.address().port+BASE);
  await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await p.locator('#cash-management > summary').click();await p.locator('#cash-verify-mxn').click();await p.locator('#cash-dialog [data-denom="20000"]').fill('1');await p.locator('#cash-dialog [data-denom="10000"]').fill('1');await p.locator('#physical-count').check();await p.getByRole('button',{name:'Guardar conteo verificado',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});
  await p.locator('#prices input').fill('270');await p.locator('#received-mxn').fill('500');
  await p.locator('#cash-receive').click();await p.locator('#cash-dialog [data-denom="50000"]').fill('1');await p.locator('#physical-received').check();await p.getByRole('button',{name:'Confirmar recibido pendiente',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});
  await p.locator('#prepare-change').click();await p.locator('#cash-adjust').click();await p.locator('#cash-extra-value').fill('70');await p.locator('#cash-dialog [data-denom="5000"]').fill('1');await p.locator('#cash-dialog [data-denom="2000"]').fill('1');await p.locator('#physical-extra').check();await p.getByRole('button',{name:'Aplicar adicional recibido',exact:true}).click();await p.locator('#cash-dialog').waitFor({state:'hidden'});
  const before=await p.evaluate(async()=>{localStorage.setItem('foreign-record','preservar');await caches.open('foreign-cache').then(c=>c.put('/foreign',new Response('preservar')));return JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname));});
  // Contar escrituras en la página nueva: cargar la migración no debe escribir en caja.
  await context.addInitScript(()=>{window.cashWrites=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='cuenta-clara:cash:v1:'+location.pathname)window.cashWrites.push(value);return original.call(this,key,value);};});
  legacy=false;await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await p.locator('#pwa-update').waitFor({state:'visible'});await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.locator('#apply-update').click()]);
  await p.waitForFunction(()=>document.querySelector('#received-mxn')?.disabled&&document.querySelector('#card-payments-total')?.textContent==='$0.00 MXN');
  const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname)));
  // El formato antiguo se conserva en disco; CashStore lo normaliza al leerlo.
  assert.deepEqual(after,before);assert.deepEqual(await p.evaluate(()=>window.cashWrites),[]);
  const inMemory=await p.evaluate(async()=>{const {CashStore}=await import('./cash-ledger.js');return new CashStore(localStorage,'cuenta-clara:cash:v1:'+location.pathname,navigator.locks).state;});
  assert.deepEqual(inMemory,validateSession(before));
  for(const form of [inMemory.draft,inMemory.pending.lock.form]){assert.equal(form.tdc,'');assert.equal(form.tdd,'');assert.equal(form.tdcApproved,false);assert.equal(form.tddApproved,false);}
  assert.deepEqual(inMemory.pending.received,before.pending.received);assert.deepEqual(inMemory.pending.extra,before.pending.extra);assert.equal(inMemory.sales.entries.length,0);
  for(const method of ['tdc','tdd']){assert.equal(await p.locator('#received-'+method).inputValue(),'');assert.equal(await p.locator('#approved-'+method).isChecked(),false);assert.ok(await p.locator('#received-'+method).isDisabled());}
  assert.equal(await p.locator('#change').textContent(),'$300.00 MXN');assert.equal(await p.evaluate(()=>localStorage.getItem('foreign-record')),'preservar');assert.ok((await p.evaluate(()=>caches.keys())).includes('foreign-cache'));
  await p.waitForFunction(async version=>(await caches.keys()).some(k=>k.endsWith(':'+version)),currentVersion);
  await context.setOffline(true);await p.reload();assert.equal(await p.locator('#change').textContent(),'$300.00 MXN');assert.deepEqual((await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname)))).cash,before.cash);// Finalizar el cobro migrado usa la recepción y el adicional confirmados una sola vez.
  await p.locator('#cash-finish').click();assert.equal(await p.locator('#physical-final-received').count(),0);
  const outgoing=p.getByRole('group',{name:'Cambio entregado · MXN',exact:true});for(const input of await outgoing.locator('input').all())await input.fill('0');await outgoing.locator('[data-denom="20000"]').fill('1');await outgoing.locator('[data-denom="10000"]').fill('1');await p.locator('#physical-delivered').check();
  await p.getByRole('button',{name:'Completar y confirmar movimiento',exact:true}).evaluate(button=>{button.click();button.click();});await p.locator('#cash-dialog').waitFor({state:'hidden'});
  const finished=await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname)));
  assert.equal(finished.sales.entries.length,1);assert.equal(finished.sales.entries[0].total,'27000');assert.equal(finished.sales.entries[0].parts.cashMXN,'27000');assert.equal(finished.cash.MXN.counts[50000],1);assert.equal(finished.cash.MXN.counts[5000],1);assert.equal(finished.cash.MXN.counts[2000],1);assert.equal(finished.cash.MXN.counts[20000],0);assert.equal(finished.cash.MXN.counts[10000],0);assert.equal(finished.cash.MXN.status,'verified');assert.equal(finished.pending.lock,null);assert.equal(finished.pending.received,null);assert.equal(finished.pending.extra,null);
  await p.reload();const reloaded=await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname)));assert.deepEqual(reloaded.cash,finished.cash);assert.deepEqual(reloaded.sales,finished.sales);assert.ok(await p.locator('#cash-finish').isDisabled());assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
