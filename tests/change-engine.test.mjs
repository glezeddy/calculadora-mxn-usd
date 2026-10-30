import test from 'node:test';
import assert from 'node:assert/strict';
import {combination,emptyCounts,initialCash,newDay,verifyCash,applyMovement,undoMovement,finishWithoutInventory,extraSuggestion,totalCounts} from '../change-engine.js';

test('combinación general exacta de $370',()=>{
 const result=combination(37000n);
 assert.deepEqual(result,{'20000':1,'10000':1,'5000':1,'2000':1});
});
test('respeta disponibilidad física y no inventa billetes',()=>{
 const counts=emptyCounts('MXN');counts[20000]=1;counts[10000]=1;
 assert.deepEqual(combination(30000n,'MXN',counts),{'20000':1,'10000':1});
 assert.equal(combination(40000n,'MXN',counts),null);
});
test('ajuste 230 + 70 = 300',()=>{
 const counts=emptyCounts('MXN');counts[20000]=1;counts[10000]=1;
 const suggestion=extraSuggestion(23000n,counts,10000n);
 assert.deepEqual(suggestion,{extra:7000n,change:30000n,combination:{'20000':1,'10000':1}});
});
test('nueva jornada ofrece cero o conservar pendiente de verificación',()=>{
 let cash=initialCash();let counts=emptyCounts('MXN');counts[50000]=2;
 cash=verifyCash(cash,'MXN',counts);
 const kept=newDay(cash,'keep');
 assert.equal(kept.MXN.counts[50000],2);
 assert.equal(kept.MXN.status,'pending');
 assert.equal(kept.USD.status,'pending');
 const reset=newDay(cash,'zero');
 assert.equal(totalCounts('MXN',reset.MXN.counts),0n);
 assert.equal(reset.MXN.status,'unverified');
});
test('movimiento atómico, MXN y USD separados, deshacer',()=>{
 let cash=initialCash();
 let mxn=emptyCounts('MXN');mxn[20000]=2;
 cash=verifyCash(cash,'MXN',mxn);
 cash=verifyCash(cash,'USD',emptyCounts('USD'));
 const received={MXN:{'50000':1},USD:{'1000':1}};
 const dispensed={MXN:{'20000':1}};
 const after=applyMovement(cash,received,dispensed);
 assert.equal(after.MXN.counts[50000],1);
 assert.equal(after.MXN.counts[20000],1);
 assert.equal(after.USD.counts[1000],1);
 const undone=undoMovement(after);
 assert.equal(undone.MXN.counts[50000],0);
 assert.equal(undone.MXN.counts[20000],2);
 assert.equal(undone.USD.counts[1000],0);
});
test('sin efectivo suficiente no hay movimiento',()=>{
 let cash=verifyCash(initialCash(),'MXN',emptyCounts('MXN'));
 assert.throws(()=>applyMovement(cash,{}, {MXN:{'50000':1}}));
 assert.equal(cash.MXN.counts[50000],0);
});
test('finalizar sin actualizar inventario suspende sugerencias de disponibilidad',()=>{
 let cash=verifyCash(initialCash(),'MXN',emptyCounts('MXN'));
 cash=finishWithoutInventory(cash,['MXN']);
 assert.equal(cash.MXN.status,'pending');
 assert.throws(()=>applyMovement(cash,{MXN:{'20000':1}},{}));
});
