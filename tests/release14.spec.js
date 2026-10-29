import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer,BASE} from '../scripts/server.js';

test('publicación v1.4: actualización desde v1.2 conserva datos locales y separa la caja por ruta',{timeout:120000},async()=>{
 let legacy=true,apiCalls=0,releaseQuote;
 const nextQuote=new Promise(resolve=>{releaseQuote=resolve;});
 const today=new Date().toISOString().slice(0,10);
 const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const server=createServer((file,data)=>legacy?execFileSync('git',['show',`5cecb17da1044e5aacbf72588754f9c973afa5ae:${file}`]):data);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
 const browser=await chromium.launch({headless:true,...(existsSync(edge)?{executablePath:edge}:{})});
 try{
  const context=await browser.newContext();
  await context.route('https://api.frankfurter.dev/**',async r=>{
   apiCalls++;
   const original=legacy;
   if(!original)await nextQuote;
   await r.fulfill({json:{date:original?yesterday:today,base:'USD',quote:'MXN',rate:original?18:19}});
  });
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://localhost:${server.address().port}${BASE}`);
  await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await p.waitForFunction(()=>localStorage.getItem('cuenta-clara:last-valid-rate:v1'));
  const saved=await p.evaluate(()=>{
   localStorage.setItem('cuenta-clara:cash:v1:/calculadora-mxn-usd-pruebas/','referencia de otra ruta');
   localStorage.setItem('release-verification-foreign','no borrar');
   return localStorage.getItem('cuenta-clara:last-valid-rate:v1');
  });
  // v1.2 guarda solo la tasa; terminar el cobro antes de aceptar la recarga.
  legacy=false;await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
  await p.locator('#pwa-update').waitFor({state:'visible'});
  await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.locator('#apply-update').click()]);
  await p.locator('#cash-title').waitFor();
  await p.waitForFunction(()=>document.querySelector('#rate-status').textContent.includes('Consultando'));
  await p.waitForFunction(async()=>!(await caches.keys()).some(k=>k.endsWith(':1.2.0')));
  // La API nueva aún está pendiente: verificar la migración antes de otra consulta exitosa.
  assert.equal(await p.evaluate(()=>localStorage.getItem('cuenta-clara:last-valid-rate:v1')),saved);
  assert.equal(await p.evaluate(()=>localStorage.getItem('release-verification-foreign')),'no borrar');
  assert.equal(await p.evaluate(()=>localStorage.getItem('cuenta-clara:cash:v1:/calculadora-mxn-usd-pruebas/')),'referencia de otra ruta');
  await p.locator('input[value=combined]').check();
  await p.locator('#prices input').fill('350');await p.locator('#received-mxn').fill('200');await p.locator('#received-usd').fill('10');
  assert.equal(await p.locator('#change').textContent(),'—');
  await p.locator('#rate-mode').selectOption('saved');
  assert.equal(await p.locator('#change').textContent(),'$30.00 MXN');
  assert.match(await p.locator('#payment-rate').textContent(),/Referencia anterior/);
  const originalRecord=JSON.parse(saved);
  assert.match(await p.locator('#rate-reference').textContent(),new RegExp(yesterday));
  const originalDates=await p.locator('#rate-dates').textContent();
  // Una respuesta nueva actualiza la última referencia, sin mutar la seleccionada.
  releaseQuote();
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('cuenta-clara:last-valid-rate:v1')).value==='19');
  const updated=await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:last-valid-rate:v1')));
  assert.equal(updated.date,today);assert.equal(updated.source,originalRecord.source);
  assert.ok(Date.parse(updated.fetchedAt)>Date.parse(originalRecord.fetchedAt));
  assert.equal(await p.locator('#change').textContent(),'$30.00 MXN');
  assert.equal(await p.locator('#rate-value').textContent(),'1 USD = $18 MXN');
  assert.equal(await p.locator('#rate-dates').textContent(),originalDates);
  console.log('Migración: referencia original conservada; nueva consulta registra su propia fecha/hora sin modificar la tasa seleccionada.');
  await context.setOffline(true);await p.reload();
  // Sin dinero confirmado, una recarga recupera la última referencia disponible.
  assert.equal(await p.locator('#change').textContent(),'$40.00 MXN');
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:last-valid-rate:v1'))),updated);
  assert.match(await p.locator('#rate-status').textContent(),/No es una cotización actual/);
  assert.equal(await p.evaluate(()=>localStorage.getItem('release-verification-foreign')),'no borrar');
  assert.equal(await p.evaluate(()=>localStorage.getItem('cuenta-clara:cash:v1:/calculadora-mxn-usd-pruebas/')),'referencia de otra ruta');
  const callsOffline=apiCalls;
  await p.locator('#prices input').fill('350.05');
  assert.equal(await p.locator('#change').textContent(),'$39.95 MXN');assert.equal(apiCalls,callsOffline);
  const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:/calculadora-mxn-usd/')));
  assert.equal(state.cash.MXN.status,'unverified');assert.equal(state.cash.USD.status,'unverified');
  assert.ok(Object.values(state.cash.MXN.counts).every(n=>n===0));
  const manifest=await p.evaluate(async()=>(await fetch('./manifest.webmanifest')).json());
  assert.equal(manifest.short_name,'Cuenta clara');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
  assert.ok((await p.evaluate(()=>caches.keys())).some(k=>k.endsWith(':1.4.0')));
  assert.deepEqual(errors,[]);
 }finally{releaseQuote();await browser.close();await new Promise(r=>server.close(r));}
});
