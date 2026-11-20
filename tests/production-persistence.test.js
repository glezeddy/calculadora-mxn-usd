import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {CashStore,validateSession} from '../cash-ledger.js';
const previous='0ac0c1320d40c7a79e4e9ff4937c83a7c560c583';
const root=new URL('../',import.meta.url).href;
const oldSource=execFileSync('git',['show',previous+':cash-ledger.js'],{encoding:'utf8'}).replaceAll("from './","from '"+root);
const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
function legacySession(){
 const form={prices:['270'],mxn:'500',usd:'',currency:'MXN',rateMode:'manual',manualRate:'18'};
 let s=old.initialSession();s=old.reduceSession(s,{type:'verify',currency:'MXN',counts:{20000:1,10000:1},confirm:true});
 s=old.reduceSession(s,{type:'draft',form});s=old.reduceSession(s,{type:'receive',context:{form},counts:{MXN:{50000:1},USD:{}},confirm:true});
 return old.reduceSession(s,{type:'extra',context:{form},value:'70',counts:{5000:1,2000:1},confirm:true});
}
const defaults=form=>{for(const key of ['tdc','tdd']){assert.equal(form[key],'');assert.equal(form[key+'Approved'],false);}};
test('migración real: leer normaliza sin escribir; la primera acción guarda campos nuevos sin alterar caja ni confirmaciones',async()=>{
 const legacy=legacySession();let raw=JSON.stringify(legacy),writes=0;const original=raw;
 const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=value;writes++;}},locks={request:async(_key,fn)=>fn()};
 const store=new CashStore(storage,'test',locks);assert.equal(writes,0);assert.equal(raw,original);
 assert.equal(Object.hasOwn(JSON.parse(raw).draft,'tdc'),false);defaults(store.state.draft);defaults(store.state.pending.lock.form);
 assert.deepEqual(store.state.cash,legacy.cash);assert.deepEqual(store.state.pending.received,legacy.pending.received);assert.deepEqual(store.state.pending.extra,legacy.pending.extra);assert.equal(store.state.sales.entries.length,0);
 assert.deepEqual(store.read(),store.state);assert.equal(writes,0);assert.equal(raw,original);
 await store.dispatch({type:'limit',value:legacy.maxExtra});assert.equal(writes,1);
 const saved=JSON.parse(raw);defaults(saved.draft);defaults(saved.pending.lock.form);assert.deepEqual(saved.cash,legacy.cash);assert.deepEqual(saved.pending.received,legacy.pending.received);assert.deepEqual(saved.pending.extra,legacy.pending.extra);assert.equal(saved.revision,legacy.revision+1);assert.equal(saved.sales.entries.length,0);
 const reload=new CashStore(storage,'test',locks);assert.equal(writes,1);assert.deepEqual(reload.state,store.state);
});
test('migración real: escritura fallida conserva bytes antiguos y estado normalizado; no inventa aprobaciones',async()=>{
 const legacy=legacySession(),raw=JSON.stringify(legacy);let attempts=0;
 const storage={getItem:()=>raw,setItem:()=>{attempts++;throw Error('Disco lleno');}},locks={request:async(_key,fn)=>fn()};
 const store=new CashStore(storage,'test',locks),before=structuredClone(store.state);
 await assert.rejects(store.dispatch({type:'limit',value:'150.00'}),/guardar/);assert.equal(attempts,1);assert.equal(storage.getItem(),raw);assert.deepEqual(store.state,before);
 const corrupt=structuredClone(legacy);corrupt.draft.tdcApproved='true';assert.throws(()=>validateSession(corrupt),/Confirmación/);
});
