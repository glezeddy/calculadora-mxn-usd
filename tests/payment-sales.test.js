import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSession,validateSession,reduceSession,evaluate,CashStore} from '../cash-ledger.js';
import {salesTotals} from '../sales-ledger.js';
const form=(patch={})=>({prices:['500'],mxn:'200',usd:'',currency:'MXN',rateMode:'manual',manualRate:'18',tdd:'300',tddApproved:true,...patch});
const draft=f=>{let s=initialSession();for(const currency of ['MXN','USD'])s=reduceSession(s,{type:'verify',currency,counts:{},confirm:true});return reduceSession(s,{type:'draft',form:f});};
const finish=f=>({type:'finish',context:{form:f},received:{MXN:{20000:1}},receivedPhysical:true,dispensed:{}});
test('500 = 200 MXN + 300 TDD: caja y venta únicas, recarga y deshacer atómicos',()=>{
 const f=form(),before=draft(f),s=reduceSession(before,finish(f));
 assert.equal(s.cash.MXN.counts[20000],1);assert.equal(s.cash.USD.counts[100],0);
 assert.deepEqual(salesTotals(s.sales),{cashMXN:20000n,cashUSD:0n,tdc:0n,tdd:30000n,total:50000n,count:1});
 const reload=validateSession(JSON.parse(JSON.stringify(s)));assert.throws(()=>reduceSession(reload,finish(f)));
 const undone=reduceSession(reload,{type:'undo',confirm:true});assert.equal(salesTotals(undone.sales).count,0);assert.deepEqual(undone.cash,before.cash);
});
test('solo tarjetas no requiere tasa, conteo ni confirmaciones físicas de efectivo',()=>{
 const f=form({mxn:'',tdd:'200',tdc:'300',tdcApproved:true,manualRate:''});let s=reduceSession(initialSession(),{type:'draft',form:f});
 const before=structuredClone(s.cash);s=reduceSession(s,{type:'finish',context:{form:f}});
 assert.deepEqual(s.cash.MXN,before.MXN);assert.deepEqual(s.cash.USD,before.USD);assert.equal(salesTotals(s.sales).total,50000n);
 assert.equal(salesTotals(reduceSession(s,{type:'undo',confirm:true}).sales).count,0);
});
test('tarjetas no aprobadas, negativas, excedentes y ventas vacías bloqueadas sin mutación',()=>{
 for(const patch of [{tddApproved:false},{tdd:'-1'},{tdd:'501'},{tdc:'1',tdcApproved:false},{prices:['0'],tdd:'',mxn:'0'}]){
 const f=form(patch),s=draft(f),before=JSON.stringify(s);assert.throws(()=>reduceSession(s,finish(f)));assert.equal(JSON.stringify(s),before);
 }
});
test('MXN + USD + TDC + TDD: el cambio solo resta efectivo y los netos cuadran',()=>{
 const f=form({mxn:'200',usd:'10',currency:'combined',tdd:'100',tdc:'100',tdcApproved:true});let s=initialSession();
 for(const currency of ['MXN','USD'])s=reduceSession(s,{type:'verify',currency,counts:currency==='MXN'?{5000:1,2000:1,1000:1}:{},confirm:true});
 s=reduceSession(s,{type:'draft',form:f});
 s=reduceSession(s,{type:'finish',context:{form:f},received:{MXN:{20000:1},USD:{1000:1}},receivedPhysical:true,dispensed:{5000:1,2000:1,1000:1},dispensedPhysical:true});
 assert.equal(s.cash.MXN.counts[20000],1);assert.equal(s.cash.USD.counts[1000],1);
 assert.deepEqual(salesTotals(s.sales),{cashMXN:12000n,cashUSD:18000n,tdc:10000n,tdd:10000n,total:50000n,count:1});
});

test('sobrepago USD devuelve MXN disponible y no infla las ventas',()=>{
 const f=form({prices:['100'],mxn:'',usd:'10',currency:'combined',tdd:''});let s=initialSession();
 s=reduceSession(s,{type:'verify',currency:'MXN',counts:{5000:1,2000:1,1000:1},confirm:true});s=reduceSession(s,{type:'verify',currency:'USD',counts:{},confirm:true});s=reduceSession(s,{type:'draft',form:f});
 s=reduceSession(s,{type:'finish',context:{form:f},received:{USD:{1000:1}},receivedPhysical:true,dispensed:{5000:1,2000:1,1000:1},dispensedPhysical:true});
 assert.equal(salesTotals(s.sales).cashUSD,10000n);assert.equal(salesTotals(s.sales).cashMXN,0n);
});
test('migración de sesión v1 conserva efectivo, bloqueo, adicional y reversión antigua',()=>{
 let legacy=draft(form({tdd:'',mxn:'500'}));delete legacy.sales;delete legacy.saleUndo;delete legacy.draft.tdd;delete legacy.draft.tdc;delete legacy.draft.tddApproved;delete legacy.draft.tdcApproved;
 const original=structuredClone(legacy),next=validateSession(legacy);assert.deepEqual(next.cash,original.cash);assert.deepEqual(next.pending,original.pending);assert.equal(next.draft.tdd,'');assert.equal(salesTotals(next.sales).count,0);assert.deepEqual(legacy,original);
 let locked=reduceSession(next,{type:'extra',context:{form:next.draft},value:'20',counts:{2000:1},confirm:true});delete locked.sales;delete locked.saleUndo;
 const migrated=validateSession(locked);assert.deepEqual(migrated.cash,locked.cash);assert.deepEqual(migrated.pending,locked.pending);
});
test('corregir inventario conserva ventas; nueva jornada reinicia ventas y permite conservar efectivo',()=>{
 const f=form();let s=reduceSession(draft(f),finish(f));const sales=structuredClone(s.sales);
 s=reduceSession(s,{type:'verify',currency:'MXN',counts:{20000:2},confirm:true});assert.deepEqual(s.sales,sales);assert.throws(()=>reduceSession(s,{type:'undo',confirm:true}));
 s=reduceSession(s,{type:'day',mode:'keep',confirm:true});assert.equal(s.cash.MXN.counts[20000],2);assert.equal(s.cash.MXN.status,'pending');assert.equal(salesTotals(s.sales).count,0);
});
test('fallo de escritura no guarda caja ni venta; recuperación completada registra una sola vez',async()=>{
 const f=form(),initial=draft(f);let raw=JSON.stringify(initial),fail=true,writes=0;
 const storage={getItem:()=>raw,setItem:(_k,v)=>{if(fail)throw Error('Disco lleno');raw=v;writes++;}};
 const locks={request:async(_k,fn)=>fn()},store=new CashStore(storage,'test',locks);
 await assert.rejects(store.dispatch(finish(f)),/guardar/);assert.deepEqual(store.state,initial);assert.equal(raw,JSON.stringify(initial));
 fail=false;const reload=new CashStore(storage,'test',locks);
 await assert.rejects(reload.dispatch({type:'recover',failedFinish:{form:f},decision:'completed',counts:{MXN:{20000:1},USD:{}},confirm:false}),/Confirma/);
 assert.equal(writes,0);
 await reload.dispatch({type:'recover',failedFinish:{form:f},decision:'completed',counts:{MXN:{20000:1},USD:{}},confirm:true});
 assert.equal(writes,1);assert.equal(salesTotals(reload.state.sales).total,50000n);assert.equal(reload.state.cash.MXN.counts[20000],1);
 await assert.rejects(reload.dispatch(finish(f)));await assert.rejects(reload.dispatch({type:'recover',failedFinish:{form:f},decision:'completed',counts:{},confirm:true}));
});
test('recuperación devuelta no registra venta y recuentos posteriores no borran ventas anteriores',()=>{
 const f=form();let s=reduceSession(draft(f),finish(f));s=reduceSession(s,{type:'draft',form:f});
 s=reduceSession(s,{type:'recover',failedFinish:{form:f},decision:'returned',counts:{MXN:{20000:1},USD:{}},confirm:true});assert.equal(salesTotals(s.sales).count,1);
});
test('doble clic y otra pestaña no duplican ventas; fallo al deshacer no borra venta ni caja',async()=>{
 const f=form();let raw=JSON.stringify(draft(f)),fail=false;const storage={getItem:()=>raw,setItem:(_k,v)=>{if(fail)throw Error('Disco lleno');raw=v;}},locks={request:async(_k,fn)=>fn()};
 const a=new CashStore(storage,'test',locks),b=new CashStore(storage,'test',locks);
 const results=await Promise.allSettled([a.dispatch(finish(f)),a.dispatch(finish(f))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await assert.rejects(b.dispatch(finish(f)),/Otra pestaña/);
 const before=raw;fail=true;await assert.rejects(a.dispatch({type:'undo',confirm:true}));assert.equal(raw,before);assert.equal(salesTotals(a.state.sales).count,1);
});

test('solo tarjeta también admite selector USD o combinado sin cotización',()=>{
 for(const currency of ['USD','combined']){
 const f=form({currency,mxn:'',usd:'',tdd:'500',manualRate:''});const s=reduceSession(draft(f),{type:'finish',context:{form:f}});assert.equal(salesTotals(s.sales).tdd,50000n);assert.equal(s.cash.USD.status,'verified');
 }
});
test('recuperar Deshacer fallido concilia la venta y bloquea marcadores antiguos',()=>{
 const f=form(),s=reduceSession(draft(f),finish(f));
 const action={type:'recover',failedUndo:s.saleUndo.id,expectedRevision:s.revision,decision:'completed',counts:{MXN:{},USD:{}},confirm:true};
 const recovered=reduceSession(s,action);assert.equal(salesTotals(recovered.sales).count,0);assert.equal(recovered.cash.MXN.counts[20000],0);
 assert.throws(()=>reduceSession(recovered,action));
 assert.equal(salesTotals(reduceSession(s,{...action,decision:'returned',counts:{MXN:{20000:1},USD:{}}}).sales).count,1);
 assert.throws(()=>reduceSession(s,{...action,expectedRevision:s.revision-1}),/jornada cambió/);
});

test('finalizar sin denominaciones registra venta y suspende solo las monedas físicas afectadas',()=>{
 const f=form();const s=reduceSession(draft(f),{type:'finish',context:{form:f},withoutInventory:true,confirm:true});
 assert.equal(salesTotals(s.sales).total,50000n);assert.equal(s.cash.MXN.status,'pending');assert.equal(s.cash.USD.status,'verified');assert.equal(s.cash.MXN.counts[20000],0);
});
