import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {createServer,BASE} from '../scripts/server.js';
import {initialSession,reduceSession} from '../cash-ledger.js';
async function fixture(run,init,initData){
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';const browser=await chromium.launch({headless:true,...(existsSync(edge)?{executablePath:edge}:{})});
 try{const context=await browser.newContext({viewport:{width:390,height:844}});if(init)await context.addInitScript(init,initData);
 await context.route('https://api.frankfurter.dev/**',r=>r.fulfill({json:{date:new Date().toISOString().slice(0,10),base:'USD',quote:'MXN',rate:18}}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:'+server.address().port+BASE);await page.waitForFunction(()=>document.querySelector('#rate-value').textContent.includes('$18'));await run({page,context});assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname)));
async function settled(page){await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname));return s?.draft?.tdd===document.querySelector('#received-tdd').value&&s?.draft?.tdc===document.querySelector('#received-tdc').value&&s?.draft?.tddApproved===document.querySelector('#approved-tdd').checked&&s?.draft?.tdcApproved===document.querySelector('#approved-tdc').checked;});}
async function verify(page,cur,counts={}){await page.locator('#cash-management').evaluate(e=>e.open=true);await page.locator('#cash-verify-'+cur.toLowerCase()).click();for(const[d,n]of Object.entries(counts))await page.locator('#cash-dialog [data-denom="'+d+'"]').fill(String(n));await page.locator('#physical-count').check();await page.getByRole('button',{name:'Guardar conteo verificado',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});}
async function fillCard(page,method,value){await page.locator('#received-'+method).fill(value);await page.locator('#approved-'+method).check();}
async function confirm(page){await page.getByRole('button',{name:'Completar y confirmar movimiento',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});}
async function undo(page){await page.locator('#cash-management').evaluate(e=>e.open=true);await page.locator('#cash-undo').click();await page.locator('#physical-undo').check();await page.getByRole('button',{name:'Deshacer movimiento confirmado',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});}

test('ventas UI: 200 MXN + 300 TDD, persistencia, doble clic, deshacer y nueva jornada',{timeout:120000},()=>fixture(async({page})=>{
 await verify(page,'MXN');await page.locator('#prices input').fill('500');await page.locator('#received-mxn').fill('200');await fillCard(page,'tdd','300');await settled(page);
 assert.equal(await page.locator('#change').textContent(),'$0.00 MXN');await page.locator('#cash-finish').click();assert.match(await page.locator('#cash-dialog').textContent(),/TDD aprobada: \$300.00/);
 await page.locator('#cash-dialog [data-denom="20000"]').fill('1');await page.locator('#physical-final-received').check();
 await page.getByRole('button',{name:'Completar y confirmar movimiento',exact:true}).evaluate(b=>{b.click();b.click();});await page.locator('#cash-dialog').waitFor({state:'hidden'});
 let s=await read(page);assert.equal(s.sales.entries.length,1);assert.equal(s.sales.entries[0].parts.tdd,'30000');assert.equal(s.cash.MXN.counts[20000],1);
 await page.reload();assert.match(await page.locator('#sales-totals').textContent(),/500.00/);assert.equal((await read(page)).sales.entries.length,1);
 await undo(page);assert.equal((await read(page)).sales.entries.length,0);assert.equal((await read(page)).cash.MXN.counts[20000],0);
 await page.locator('#prices input').fill('500');await page.locator('#received-mxn').fill('200');await fillCard(page,'tdd','300');await page.locator('#cash-finish').click();await page.locator('#cash-dialog [data-denom="20000"]').fill('1');await page.locator('#physical-final-received').check();await confirm(page);
 await page.locator('#cash-day').click();await page.locator('input[name="cash-day-mode"][value="keep"]').check();await page.locator('#physical-day').check();await page.getByRole('button',{name:'Comenzar jornada',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});s=await read(page);assert.equal(s.sales.entries.length,0);assert.equal(s.cash.MXN.counts[20000],1);assert.equal(s.cash.MXN.status,'pending');
}));

test('ventas UI: solo tarjetas, aprobación obligatoria, cambio de importe y móvil sin desbordamiento',{timeout:120000},()=>fixture(async({page,context})=>{
 await page.locator('#prices input').fill('500');await page.locator('#received-tdd').fill('200');await fillCard(page,'tdc','300');assert.ok(await page.locator('#cash-finish').isDisabled());await page.locator('#approved-tdd').check();assert.ok(await page.locator('#cash-finish').isEnabled());
 await page.locator('#received-tdd').fill('201');assert.equal(await page.locator('#approved-tdd').isChecked(),false);await page.locator('#approved-tdd').check();assert.ok(await page.locator('#cash-finish').isDisabled());await fillCard(page,'tdd','200');await settled(page);await page.reload();assert.ok(await page.locator('#approved-tdd').isChecked());
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390||width===1280)await page.screenshot({path:'test-results/cards-'+width+'.png',fullPage:true});}
 await page.locator('#cash-finish').click();assert.equal(await page.locator('#physical-final-received').count(),0);assert.equal(await page.locator('#physical-delivered').count(),0);await confirm(page);
 let s=await read(page);assert.equal(s.sales.entries.length,1);assert.equal(s.sales.entries[0].parts.tdc,'30000');assert.equal(s.cash.MXN.status,'unverified');assert.ok(Object.values(s.cash.MXN.counts).every(n=>n===0));
 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload();assert.equal((await read(page)).sales.entries.length,1);assert.match(await page.locator('#sales-totals').textContent(),/500.00/);
}));

test('ventas UI: combinación MXN, USD y tarjetas conserva Cambio inteligente y caja separada',{timeout:120000},()=>fixture(async({page})=>{
 await verify(page,'MXN',{5000:1,2000:1,1000:1});await verify(page,'USD');await page.locator('#prices input').fill('500');await page.locator('input[value="combined"]').check();await page.locator('#received-mxn').fill('200');await page.locator('#received-usd').fill('10');await fillCard(page,'tdd','100');await fillCard(page,'tdc','100');
 assert.equal(await page.locator('#change').textContent(),'$80.00 MXN');await page.locator('#prepare-change').click();await page.waitForFunction(()=>document.querySelector('#combination-total').textContent.includes('80.00'));
 await page.locator('#cash-finish').click();const mxn=page.getByRole('group',{name:'Recibido · MXN',exact:true}),usd=page.getByRole('group',{name:'Recibido · USD',exact:true}),change=page.getByRole('group',{name:'Cambio entregado · MXN',exact:true});await mxn.locator('[data-denom="20000"]').fill('1');await usd.locator('[data-denom="1000"]').fill('1');
 for(const input of await change.locator('input').all())await input.fill('0');for(const d of ['5000','2000','1000'])await change.locator('[data-denom="'+d+'"]').fill('1');await page.locator('#physical-final-received').check();await page.locator('#physical-delivered').check();await confirm(page);
 const s=await read(page);assert.equal(s.sales.entries[0].total,'50000');assert.deepEqual(s.sales.entries[0].parts,{cashMXN:'12000',cashUSD:'18000',tdc:'10000',tdd:'10000'});assert.equal(s.cash.USD.counts[1000],1);assert.equal(s.cash.MXN.counts[20000],1);assert.equal(s.cash.MXN.counts[5000],0);
}));

test('ventas UI: fallo al guardar finalización y recuperación tras recarga no duplica cobro',{timeout:120000},()=>fixture(async({page})=>{
 await verify(page,'MXN');await page.locator('#prices input').fill('500');await page.locator('#received-mxn').fill('200');await fillCard(page,'tdd','300');await settled(page);await page.locator('#cash-finish').click();await page.locator('#cash-dialog [data-denom="20000"]').fill('1');await page.locator('#physical-final-received').check();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('cuenta-clara:cash:v1:')&&!k.endsWith(':capture')&&!k.endsWith(':recovery'))throw Error('Disco lleno');return original.call(this,k,v);};});
 await page.getByRole('button',{name:'Completar y confirmar movimiento',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#cash-dialog-error').textContent.includes('No se guardó'));let s=await read(page);assert.equal(s.sales.entries.length,0);assert.equal(s.cash.MXN.counts[20000],0);
 await page.reload();await page.locator('#cash-recover').click();await page.locator('#recovery-decision').selectOption('completed');await page.getByRole('group',{name:'Recuento de recuperación · MXN',exact:true}).locator('[data-denom="20000"]').fill('1');await page.locator('#physical-recovery').check();await page.getByRole('button',{name:'Confirmar recuento y recuperar',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});
 s=await read(page);assert.equal(s.sales.entries.length,1);assert.equal(s.cash.MXN.counts[20000],1);await page.reload();assert.equal((await read(page)).sales.entries.length,1);assert.ok(await page.locator('#cash-finish').isDisabled());assert.ok(await page.locator('#cash-recover').isHidden());
}));

test('ventas UI: migra caja y captura inmediata antiguas sin borrar efectivo ni cuenta',{timeout:120000},async()=>{
 let legacy=initialSession();legacy=reduceSession(legacy,{type:'verify',currency:'MXN',counts:{50000:2},confirm:true});delete legacy.sales;delete legacy.saleUndo;
 const captured={prices:['500'],mxn:'200',usd:'',currency:'MXN',rateMode:'manual',manualRate:'18'};
 await fixture(async({page})=>{assert.equal(await page.locator('#prices input').inputValue(),'500');assert.equal(await page.locator('#received-mxn').inputValue(),'200');const s=await read(page);assert.equal(s.cash.MXN.counts[50000],2);assert.equal(s.sales.entries.length,0);},({legacy,form})=>{if(!localStorage.getItem('cuenta-clara:cash:v1:'+location.pathname)){localStorage.setItem('cuenta-clara:cash:v1:'+location.pathname,JSON.stringify(legacy));sessionStorage.setItem('cuenta-clara:cash:v1:'+location.pathname+':capture',JSON.stringify({form,stamp:JSON.stringify([legacy.cash,legacy.pending])}));}},{legacy,form:captured});

});

test('ventas UI: recuperación de Deshacer fallido anula una sola venta tras devolución confirmada',{timeout:120000},()=>fixture(async({page})=>{
 await page.locator('#prices input').fill('500');await fillCard(page,'tdd','500');await page.locator('#cash-finish').click();await confirm(page);await settled(page);
 await page.locator('#cash-management').evaluate(e=>e.open=true);await page.locator('#cash-undo').click();await page.locator('#physical-undo').check();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('cuenta-clara:cash:v1:')&&!k.endsWith(':capture')&&!k.endsWith(':recovery'))throw Error('Disco lleno');return original.call(this,k,v);};});
 await page.getByRole('button',{name:'Deshacer movimiento confirmado',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#cash-dialog-error').textContent.includes('No se guardó'));assert.equal((await read(page)).sales.entries.length,1);
 await page.reload();await page.locator('#cash-recover').click();await page.locator('#physical-recovery').check();await page.getByRole('button',{name:'Confirmar recuento y recuperar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#cash-dialog-error').textContent.includes('Revisa'));assert.equal((await read(page)).sales.entries.length,1);
 await page.locator('#recovery-decision').selectOption('completed');await page.locator('#physical-recovery').check();await page.getByRole('button',{name:'Confirmar recuento y recuperar',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});assert.equal((await read(page)).sales.entries.length,0);await page.reload();assert.equal((await read(page)).sales.entries.length,0);
}));

test('ventas UI: migra recepción antigua bloqueada y finaliza sin duplicar efectivo',{timeout:120000},async()=>{
 const form={prices:['100'],mxn:'200',usd:'',currency:'MXN',rateMode:'manual',manualRate:'18'};
 let legacy=initialSession();legacy=reduceSession(legacy,{type:'verify',currency:'MXN',counts:{10000:1},confirm:true});legacy=reduceSession(legacy,{type:'draft',form});legacy=reduceSession(legacy,{type:'receive',context:{form},counts:{MXN:{20000:1},USD:{}},confirm:true});delete legacy.sales;delete legacy.saleUndo;
 for(const f of [legacy.draft,legacy.pending.lock.form])for(const key of ['tdc','tdd','tdcApproved','tddApproved'])delete f[key];
 await fixture(async({page})=>{
 assert.ok(await page.locator('#received-mxn').isDisabled());assert.equal((await read(page)).cash.MXN.counts[20000],0);
 await page.locator('#cash-finish').click();assert.equal(await page.locator('#physical-final-received').count(),0);await page.getByRole('group',{name:'Cambio entregado · MXN',exact:true}).locator('[data-denom="10000"]').fill('1');await page.locator('#physical-delivered').check();await confirm(page);
 const s=await read(page);assert.equal(s.cash.MXN.counts[20000],1);assert.equal(s.cash.MXN.counts[10000],0);assert.equal(s.sales.entries.length,1);assert.equal(s.sales.entries[0].total,'10000');
 },legacy=>{const key='cuenta-clara:cash:v1:'+location.pathname;if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(legacy));},legacy);
});

test('cuadro de tarjetas: comparte totales, persiste, deshace, reinicia jornada y adapta tres cuadros',{timeout:120000},()=>fixture(async({page})=>{
 const check=async(total,tdd,tdc)=>{
  assert.equal(await page.locator('#card-payments-total').textContent(),total);
  assert.equal(await page.locator('#card-payments-tdd').textContent(),tdd);
  assert.equal(await page.locator('#card-payments-tdc').textContent(),tdc);
  const rows=await page.locator('#sales-totals').evaluate(dl=>Object.fromEntries([...dl.querySelectorAll('dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent])));
  assert.equal(rows['Ventas TDD'],tdd);assert.equal(rows['Ventas TDC'],tdc);
 };
 await page.locator('#cash-management').evaluate(e=>e.open=true);
 await check('$0.00 MXN','$0.00 MXN','$0.00 MXN');
 assert.equal(await page.locator('.cash-balances>div').count(),3);
 assert.equal(await page.locator('#card-payments-balance button, #card-payments-balance input').count(),0);
 const cashBefore=(await read(page)).cash;
 for(const [tdc,tdd] of [['200','300'],['100','400']]){
  await page.locator('#prices input').fill('500');await fillCard(page,'tdd',tdd);await fillCard(page,'tdc',tdc);await page.locator('#cash-finish').click();await confirm(page);
 }
 await check('$1,000.00 MXN','$700.00 MXN','$300.00 MXN');
 let cash=(await read(page)).cash;assert.deepEqual(cash.MXN,cashBefore.MXN);assert.deepEqual(cash.USD,cashBefore.USD);
 await page.reload();await page.locator('#cash-management').evaluate(e=>e.open=true);await check('$1,000.00 MXN','$700.00 MXN','$300.00 MXN');
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  const rects=await page.locator('.cash-balances>div').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1280){assert.equal(rects[0].top,rects[1].top);assert.equal(rects[1].top,rects[2].top);assert.ok(rects[0].right<=rects[1].left&&rects[1].right<=rects[2].left);}
  if(width<=390)assert.ok(rects[0].bottom<=rects[1].top&&rects[1].bottom<=rects[2].top);
  if(width===390||width===1280)await page.locator('#cash-management').screenshot({path:'test-results/card-balances-'+width+'.png'});
 }
 await undo(page);await check('$500.00 MXN','$300.00 MXN','$200.00 MXN');
 await page.locator('#cash-day').click();await page.locator('input[name="cash-day-mode"][value="keep"]').check();await page.locator('#physical-day').check();await page.getByRole('button',{name:'Comenzar jornada',exact:true}).click();await page.locator('#cash-dialog').waitFor({state:'hidden'});
 await check('$0.00 MXN','$0.00 MXN','$0.00 MXN');
 cash=(await read(page)).cash;assert.deepEqual(cash.MXN.counts,cashBefore.MXN.counts);assert.deepEqual(cash.USD.counts,cashBefore.USD.counts);
}));
