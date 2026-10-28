import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('v1.3 mantiene intactos los cálculos, resumen, cotización y política del worker',()=>{
  for(const file of ['money.js','rates.js','rate-store.js','summary.js','pwa.js']){
    const current=readFileSync(new URL('../'+file,import.meta.url),'utf8').replaceAll('\r\n','\n');
    const previous=execFileSync('git',['show',`v1.2.0:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');
    assert.equal(current,previous,file);
  }
  const current=readFileSync(new URL('../keypad.js',import.meta.url),'utf8').split('export function setupKeypad')[0].replaceAll('\r\n','\n');
  assert.equal(current,execFileSync('git',['show','v1.2.0:keypad.js'],{encoding:'utf8'}).split('export function setupKeypad')[0].replaceAll('\r\n','\n'));
});
test('contraste de textos de la paleta oficial',()=>{
  const lum=hex=>{const rgb=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  for(const [fg,bg] of [['FFFFFF','24334B'],['A7BEDC','24334B'],['FFFFFF','356AE6'],['A7BEDC','294574'],['6CF0C0','193D38'],['FF858D','4B2934']]){const a=lum(fg),b=lum(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg}/${bg}`);}
});
