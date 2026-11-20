import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptySales,addSale,undoLastSale,salesTotals,newSalesDay,validateSales} from '../sales-ledger.js';
test('cobro combinado no duplica la venta',()=>{
 let s=addSale(emptySales(),{cashMXN:'10000',cashUSD:'5000',tdc:'10000',tdd:'0'},'25000');
 assert.deepEqual(salesTotals(s),{cashMXN:10000n,cashUSD:5000n,tdc:10000n,tdd:0n,total:25000n,count:1});
 s=undoLastSale(s);assert.equal(salesTotals(s).total,0n);
});
test('tarjetas se registran completas sin comisiones',()=>{
 let s=addSale(emptySales(),{tdc:'35000'},'35000');
 s=addSale(s,{tdd:'12050'},'12050');
 assert.equal(salesTotals(s).total,47050n);
 assert.equal(salesTotals(s).tdc,35000n);
 assert.equal(salesTotals(newSalesDay(s)).count,0);
});
test('rechaza ventas incompletas y estado alterado',()=>{
 assert.throws(()=>addSale(emptySales(),{cashMXN:'100'},'200'));
 assert.throws(()=>addSale(emptySales(),{tdc:'-1'},'0'));
 const s=addSale(emptySales(),{tdc:'100'},'100');s.entries[0].total='200';assert.throws(()=>validateSales(s));
});
