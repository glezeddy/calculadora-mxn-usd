import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editAmount} from '../keypad.js';
import {buildSummary} from '../summary.js';
test('teclado: selección, decimales, borrado, límites y valores inválidos',()=>{
  assert.deepEqual(editAmount('', '.'),{value:'0.',caret:2});
  assert.equal(editAmount('12.34','5'),null);
  assert.equal(editAmount('12.34','.',2),null);
  assert.deepEqual(editAmount('12.34','5',0,5),{value:'5',caret:1});
  assert.deepEqual(editAmount('12.34','backspace'),{value:'12.3',caret:4});
  assert.deepEqual(editAmount('texto','clear'),{value:'',caret:0});
  assert.equal(editAmount('9999999999','1'),null);
  assert.equal(editAmount('','-'),null);
  assert.equal(editAmount('1,2','3').value,'1.23');
});
test('resumen: combinado, insuficiente, inválido y solo monedas aplicables',()=>{
  const state={ready:true,total:35000n,currency:'combined',mxn:20000n,usd:1000n,rateDescription:'Manual · 1 USD = $18 MXN',converted:38000n};
  const summary=buildSummary(state);
  assert.match(summary.text,/Cambio a entregar: \$30.00 MXN/);
  assert.match(summary.text,/Recibido en USD: \$10.00 USD/);
  assert.match(summary.text,/Estado: Pago completo/);
  assert.match(buildSummary({...state,total:38001n}).text,/Cantidad faltante: \$0.01 MXN/);
  assert.equal(buildSummary({...state,ready:false}),null);
  assert.equal(buildSummary({...state,converted:null}),null);
  assert.doesNotMatch(buildSummary({...state,currency:'MXN'}).text,/USD|Tipo de cambio/);
  assert.doesNotMatch(buildSummary({...state,currency:'USD'}).text,/Recibido en MXN/);
});
