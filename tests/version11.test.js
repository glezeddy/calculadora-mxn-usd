import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receivedMXN, addBill, rateFraction } from '../money.js';
import { loadRate, saveRate, RATE_KEY } from '../rate-store.js';
test('pagos combinados: ejemplo, decimales, faltantes y entradas inválidas', () => {
  const rate = rateFraction('18');
  assert.equal(receivedMXN('combined', '200', '10', rate) - 35000n, 3000n);
  assert.equal(receivedMXN('combined', '200.10', '8.33', rate) - 35005n, -1n);
  assert.equal(receivedMXN('combined', '', '10', rate), 18000n);
  assert.equal(receivedMXN('combined', '200', '', rate), 20000n);
  assert.equal(receivedMXN('combined', '', '', rate), null);
  assert.equal(receivedMXN('combined', '200', '', null), null);
  assert.equal(receivedMXN('combined', '-1', '10', rate), null);
  assert.equal(receivedMXN('combined', '200', 'abc', rate), null);
  assert.equal(receivedMXN('USD', 'texto ignorado', '10', rate), 18000n);
  assert.equal(receivedMXN('MXN', '200.05', 'texto ignorado', null), 20005n);
});
test('billetes acumulables, decimales exactos y protección del límite', () => {
  assert.equal(addBill(addBill('', '20'), '20'), '40.00');
  assert.equal(addBill('0.10', '1000'), '1000.10');
  for (const bill of ['20','50','100','200','500','1000','1','5','10']) assert.equal(addBill('', bill), `${bill}.00`);
  for (const value of ['-1', 'abc', '1.001', '9999999999.99']) assert.equal(addBill(value, '20'), null);
});
test('tasa guardada: conserva fechas reales; rechaza corrupción y almacenamiento inaccesible', () => {
  const data = {source:'Frankfurter',value:'18.25',date:'2026-01-02',fetchedAt:'2026-01-03T12:00:00Z'};
  let content = null;
  const storage = {getItem: key => {assert.equal(key,RATE_KEY);return content;}, setItem: (key,value)=>{assert.equal(key,RATE_KEY);content=value;}};
  assert.equal(loadRate(storage),null);
  assert.ok(saveRate(storage,data));
  assert.deepEqual(loadRate(storage),data); // Referencias antiguas son válidas solo bajo selección explícita.
  for(const patch of [{value:'0'},{value:'NaN'},{source:'otra'},{date:'2026-02-30'},{fetchedAt:'texto'},{fetchedAt:'2999-01-01T00:00:00Z'},{date:'2026-01-04'}]) {
    content=JSON.stringify({...data,...patch}); assert.equal(loadRate(storage),null);
  }
  content='{'; assert.equal(loadRate(storage),null);
  const blocked={getItem(){throw Error('Bloqueado');},setItem(){throw Error('Lleno');}};
  assert.equal(loadRate(blocked),null);assert.equal(saveRate(blocked,data),false);
});
