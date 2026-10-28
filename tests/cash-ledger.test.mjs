import test from 'node:test';
import assert from 'node:assert/strict';
import {combination,combinations,emptyCounts,totalCounts,extraSuggestion,verifyCash,initialCash,validateCash,applyMovement,undoMovement} from '../change-engine.js';
import {initialSession,reduceSession,CashStore,validateSession,availableCounts} from '../cash-ledger.js';
const form=(patch={})=>({prices:['270'],mxn:'500',usd:'',currency:'MXN',rateMode:'manual',manualRate:'18',...patch});
const context=f=>({form:f,record:null});
function prepared(f=form()){
 let s=initialSession();s=reduceSession(s,{type:'verify',currency:'MXN',counts:{20000:1,10000:1},confirm:true});s=reduceSession(s,{type:'verify',currency:'USD',counts:{},confirm:true});return reduceSession(s,{type:'draft',form:f});
}
test('alternativas exactas y búsqueda grande acotada',()=>{
 const r=combinations(30000n);assert.equal(r.combinations.length,3);assert.equal(new Set(r.combinations.map(x=>JSON.stringify(x))).size,3);
 for(const c of r.combinations)assert.equal(Object.entries(c).reduce((a,[d,n])=>a+BigInt(d)*BigInt(n),0n),30000n);
 const start=performance.now();assert.equal(combination(999999999999n),null);const large=combination(999999999990n);assert.ok(large);assert.ok(performance.now()-start<2000);
 const scarce=emptyCounts('MXN');scarce[20000]=1000000;assert.equal(combination(999999999999n,'MXN',scarce),null);
});
test('solución coincide con fuerza bruta para inventarios pequeños, incluidos no greedy',()=>{
 for(let a=0;a<=3;a++)for(let b=0;b<=3;b++)for(let c=0;c<=3;c++){
  const stock={50:a,20:b,10:c};const reachable=new Set();for(let i=0;i<=a;i++)for(let j=0;j<=b;j++)for(let k=0;k<=c;k++)reachable.add(i*50+j*20+k*10);
  for(let amount=0;amount<=250;amount+=10)assert.equal(combination(BigInt(amount),'MXN',stock)!==null,reachable.has(amount));
 }
});
test('límites, negativos, moneda y claves desconocidas',()=>{
 assert.throws(()=>totalCounts('MXN',{50:-1}));assert.throws(()=>totalCounts('MXN',{50:1.2}));assert.throws(()=>totalCounts('MXN',{'toString':1}));assert.throws(()=>combination(-1n));
 let cash=verifyCash(initialCash(),'MXN',{100:1000000});assert.throws(()=>applyMovement(cash,{MXN:{100:1}},{}));
 assert.throws(()=>verifyCash(cash,'EUR',{}));
});
test('ajuste 70 confirmado, finalización atómica y no duplicación después de recarga',()=>{
 let s=prepared();const f=form();const before=JSON.stringify(s.cash);
 assert.equal(extraSuggestion(23000n,s.cash.MXN.counts,6900n),null);
 assert.equal(extraSuggestion(23000n,s.cash.MXN.counts,10000n).extra,7000n);
 assert.throws(()=>reduceSession(s,{type:'extra',context:context(f),value:'70',counts:{5000:1,2000:1},confirm:false}));
 s=reduceSession(s,{type:'extra',context:context(f),value:'70',counts:{5000:1,2000:1},confirm:true});assert.equal(JSON.stringify(s.cash),before);
 s=validateSession(JSON.parse(JSON.stringify(s)));assert.equal(s.pending.extra.amount,'7000');
 assert.throws(()=>reduceSession(s,{type:'extra',context:context(f),value:'70',counts:{5000:1,2000:1},confirm:true}));
 s=reduceSession(s,{type:'finish',context:context(f),received:{MXN:{50000:1}},receivedPhysical:true,dispensed:{20000:1,10000:1},dispensedPhysical:true});
 assert.equal(s.cash.MXN.counts[50000],1);assert.equal(s.cash.MXN.counts[5000],1);assert.equal(s.cash.MXN.counts[2000],1);assert.equal(s.cash.MXN.counts[20000],0);assert.equal(s.pending.extra,null);
 assert.throws(()=>reduceSession(s,{type:'finish',context:context(f),received:{MXN:{50000:1}},receivedPhysical:true,dispensed:{20000:1,10000:1},dispensedPhysical:true}));
 s=validateSession(JSON.parse(JSON.stringify(s)));s=reduceSession(s,{type:'undo',confirm:true});assert.equal(JSON.stringify(s.cash),before);
});
test('ajuste manual supera límite, cancelar requiere devolución y nunca altera inventario',()=>{
 const f=form({prices:['100'],mxn:'100'});let s=prepared(f);const before=JSON.stringify(s.cash);
 s=reduceSession(s,{type:'extra',context:context(f),value:'500',counts:{50000:1},confirm:true});
 assert.throws(()=>reduceSession(s,{type:'verify',currency:'MXN',counts:{},confirm:true}));
 assert.throws(()=>reduceSession(s,{type:'cancel-extra',returned:false}));
 assert.throws(()=>reduceSession(s,{type:'draft',form:form({mxn:'200'})}));
 s=reduceSession(s,{type:'cancel-extra',returned:true});assert.equal(s.pending.extra,null);assert.equal(JSON.stringify(s.cash),before);
});
test('recibido confirmado está disponible provisionalmente y se contabiliza solo al finalizar',()=>{
 const f=form({prices:['270'],mxn:'500'});let s=prepared(f);
 s=reduceSession(s,{type:'receive',context:context(f),counts:{MXN:{50000:1}},confirm:true});
 assert.equal(availableCounts(s)[50000],1);assert.equal(s.cash.MXN.counts[50000],0);
 assert.throws(()=>reduceSession(s,{type:'receive',context:context(f),counts:{MXN:{50000:1}},confirm:true}));
 const json=JSON.stringify(s);assert.throws(()=>reduceSession(s,{type:'finish',context:context(f),dispensed:{50000:1},dispensedPhysical:true}));assert.equal(JSON.stringify(s),json);
});
test('combinado: recibido USD solo a USD y cambio solo MXN',()=>{
 const f=form({prices:['350.05'],mxn:'200.10',usd:'10',currency:'combined'});let s=prepared(f);
 // Recontar inventario físicamente a las piezas exactas de cambio, antes de confirmar recibido.
 s=reduceSession(s,{type:'verify',currency:'MXN',counts:{2000:1,500:1,200:2,50:1,20:2,10:1},confirm:true});
 // 30.05 MXN no tiene combinación de monedas MXN: no se inventa ni redondea.
 assert.equal(combination(3005n,'MXN'),null);
 assert.throws(()=>reduceSession(s,{type:'finish',context:context(f),received:{MXN:{20000:1,10:1},USD:{1000:1}},receivedPhysical:true,dispensed:{2000:1,1000:1},dispensedPhysical:true}));
 const f2=form({prices:['350'],mxn:'200',usd:'10',currency:'combined'});s=reduceSession(s,{type:'draft',form:f2});s=reduceSession(s,{type:'verify',currency:'MXN',counts:{2000:1,1000:1},confirm:true});
 s=reduceSession(s,{type:'finish',context:context(f2),received:{MXN:{20000:1},USD:{1000:1}},receivedPhysical:true,dispensed:{2000:1,1000:1},dispensedPhysical:true});
 assert.equal(s.cash.USD.counts[1000],1);assert.equal(s.cash.MXN.counts[20000],1);assert.equal(s.cash.MXN.counts[2000],0);
});
test('finalizar incompleto suspende solo monedas afectadas y se puede deshacer físicamente',()=>{
 const f=form({mxn:'',usd:'25',currency:'USD',prices:['450']});let s=prepared(f);
 s=reduceSession(s,{type:'finish',context:context(f),withoutInventory:true,confirm:true});assert.equal(s.cash.USD.status,'pending');assert.equal(s.cash.MXN.status,'verified');
 s=reduceSession(s,{type:'undo',confirm:true});assert.equal(s.cash.USD.status,'verified');
});
test('jornada nunca verifica automáticamente y confirmación/cancelación no mutan parcialmente',()=>{
 let s=prepared();const before=JSON.stringify(s);
 assert.throws(()=>reduceSession(s,{type:'day',mode:'zero',confirm:false}));assert.equal(JSON.stringify(s),before);
 s=reduceSession(s,{type:'day',mode:'keep',confirm:true});assert.equal(s.cash.MXN.status,'pending');assert.equal(s.cash.USD.status,'pending');assert.equal(s.cash.MXN.counts[20000],1);
 s=reduceSession(s,{type:'day',mode:'zero',confirm:true});assert.equal(s.cash.MXN.status,'unverified');assert.equal(totalCounts('MXN',s.cash.MXN.counts),0n);
});
test('deshacer persiste, se invalida por conteo y el siguiente movimiento reemplaza al anterior',()=>{
 const f=form({prices:['500'],mxn:'500'});let s=prepared(f);
 s=reduceSession(s,{type:'finish',context:context(f),received:{MXN:{50000:1}},receivedPhysical:true,dispensed:{},dispensedPhysical:true});
 assert.ok(validateCash(s.cash).lastMovement);s=reduceSession(s,{type:'verify',currency:'USD',counts:{},confirm:true});assert.equal(s.cash.lastMovement,null);
});
const locks={request:async(_name,fn)=>fn()};
test('persistencia única, fallo de escritura deja caja intacta y revisión evita otra pestaña',async()=>{
 let raw=null,fail=false;const storage={getItem:()=>raw,setItem:(_key,v)=>{if(fail)throw Error('Sin espacio');raw=v;}};
 const a=new CashStore(storage,'test',locks),b=new CashStore(storage,'test',locks);
 await a.dispatch({type:'verify',currency:'MXN',counts:{50000:1},confirm:true});
 await assert.rejects(b.dispatch({type:'day',mode:'zero',confirm:true}),/Otra pestaña/);
 const before=raw;fail=true;await assert.rejects(a.dispatch({type:'day',mode:'zero',confirm:true}));assert.equal(raw,before);assert.equal(a.state.cash.MXN.counts[50000],1);
 fail=false;const reload=new CashStore(storage,'test',locks);assert.equal(reload.state.cash.MXN.counts[50000],1);
});
test('almacenamiento corrupto o bloqueo no disponible no reinicia ni permite escribir',async()=>{
 assert.throws(()=>new CashStore({getItem:()=>'{'},'test',locks));let writes=0;
 const s=new CashStore({getItem:()=>null,setItem:()=>writes++},'test',null);
 await assert.rejects(s.dispatch({type:'verify',currency:'MXN',counts:{},confirm:true}));assert.equal(writes,0);
});
