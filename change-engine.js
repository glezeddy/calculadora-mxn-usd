// Motor puro. Todos los importes son centavos BigInt; ninguna búsqueda depende del importe en memoria.
export const DENOMINATIONS = Object.freeze({
  MXN: Object.freeze([100000,50000,20000,10000,5000,2000,1000,500,200,100,50,20,10]),
  USD: Object.freeze([10000,5000,2000,1000,500,100,50,25,10,5,1])
});
export const STATES = Object.freeze(['unverified','verified','pending']);
export const MAX_COUNT = 1000000;
export class SearchLimitError extends Error { constructor(){super('La búsqueda alcanzó su límite seguro. Prueba otra combinación o un ajuste manual.');this.name='SearchLimitError';} }
export function emptyCounts(currency) {
  if (!DENOMINATIONS[currency]) throw new Error('Moneda inválida');
  return Object.fromEntries(DENOMINATIONS[currency].map(v => [v,0]));
}
export function normalizeCounts(currency, counts) {
  const result=emptyCounts(currency);
  if(counts!==null && counts!==undefined && (typeof counts!=='object'||Array.isArray(counts))) throw new Error('Cantidades inválidas');
  for (const [key,value] of Object.entries(counts ?? {})) {
    if (!Object.hasOwn(result,key) || !Number.isSafeInteger(value) || value<0 || value>MAX_COUNT) throw new Error('Cantidad de piezas inválida (0 a 1,000,000)');
    result[key]=value;
  }
  return result;
}
export function totalCounts(currency,counts) {
  const valid=normalizeCounts(currency,counts);
  return DENOMINATIONS[currency].reduce((sum,d)=>sum+BigInt(d)*BigInt(valid[d]),0n);
}
const gcd=(a,b)=>{while(b){[a,b]=[b,a%b];}return a;};
function search(amount,currency,available,limit,budget) {
  if(typeof amount!=='bigint'||amount<0n||amount>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Importe fuera del rango seguro');
  const denoms=DENOMINATIONS[currency];if(!denoms)throw Error('Moneda inválida');
  const limits=available===null?null:normalizeCounts(currency,available);
  const suffixGCD=Array(denoms.length+1).fill(0n),capacity=Array(denoms.length+1).fill(0n);
  for(let i=denoms.length-1;i>=0;i--){const d=denoms[i],present=!limits||limits[d]>0;suffixGCD[i]=present?gcd(BigInt(d),suffixGCD[i+1]):suffixGCD[i+1];capacity[i]=capacity[i+1]+(limits?BigInt(d)*BigInt(limits[d]):amount);}
  const found=[];let truncated=false;
  const visit=(i,remaining,parts)=>{
    if(--budget.left<0){truncated=true;return;}
    if(remaining===0n){found.push({...parts});return;}
    if(i===denoms.length||!suffixGCD[i]||remaining%suffixGCD[i]||remaining>capacity[i])return;
    const d=denoms[i],unit=BigInt(d);let max=remaining/unit;
    if(limits && max>BigInt(limits[d]))max=BigInt(limits[d]);
    if(!suffixGCD[i+1]){if(remaining%unit===0n&&remaining/unit<=max){found.push({...parts,[d]:Number(remaining/unit)});}return;}
    const capAfter=capacity[i+1];const minimum=remaining>capAfter?(remaining-capAfter+unit-1n)/unit:0n;
    const step=suffixGCD[i+1]/gcd(unit,suffixGCD[i+1]);
    while(max>=minimum && (remaining-max*unit)%suffixGCD[i+1]){max--;if(--budget.left<0){truncated=true;return;}}
    for(let count=max;count>=minimum;count-=step){
      if(count)parts[d]=Number(count);else delete parts[d];
      visit(i+1,remaining-count*unit,parts);
      delete parts[d];
      if(found.length>=limit||truncated)return;
    }
  };
  visit(0,amount,{});
  return {combinations:found,limited:truncated,exhaustive:!truncated&&found.length<limit};
}
export function combinations(amount,currency='MXN',available=null,limit=3){
  if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('Límite inválido');
  return search(amount,currency,available,limit,{left:60000});
}
export function combination(amount,currency='MXN',available=null){
  const result=combinations(amount,currency,available,1);
  if(result.combinations.length)return result.combinations[0];
  if(result.limited)throw new SearchLimitError();return null;
}
export function initialCash(){return {version:1,MXN:{counts:emptyCounts('MXN'),status:'unverified'},USD:{counts:emptyCounts('USD'),status:'unverified'},lastMovement:null};}
export function validateCash(cash){
  if(!cash||cash.version!==1)throw Error('Estado de caja inválido');
  const next={version:1,lastMovement:null};
  for(const currency of ['MXN','USD']){
    if(!STATES.includes(cash[currency]?.status))throw Error('Verificación inválida');
    next[currency]={counts:normalizeCounts(currency,cash[currency].counts),status:cash[currency].status};
  }
  if(cash.lastMovement){
    const b=cash.lastMovement.before;
    if(!b)throw Error('Movimiento reversible inválido');
    const before=validateCash({version:1,MXN:b.MXN,USD:b.USD});
    next.lastMovement={before:{MXN:before.MXN,USD:before.USD}};
  }
  return next;
}
export function newDay(cash,mode){
  const next=validateCash(cash);if(!['zero','keep'].includes(mode))throw Error('Opción de jornada inválida');
  for(const currency of ['MXN','USD']){if(mode==='zero')next[currency].counts=emptyCounts(currency);next[currency].status=mode==='zero'?'unverified':'pending';}
  next.lastMovement=null;return next;
}
export function verifyCash(cash,currency,counts){
  if(!DENOMINATIONS[currency])throw Error('Moneda inválida');const next=validateCash(cash);
  next[currency]={counts:normalizeCounts(currency,counts),status:'verified'};next.lastMovement=null;return next;
}
export function applyMovement(cash,received,dispensed){
  const before=validateCash(cash),next=validateCash(cash);
  for(const currency of ['MXN','USD']){
    const incoming=normalizeCounts(currency,received?.[currency]??{}),outgoing=normalizeCounts(currency,dispensed?.[currency]??{});
    const changed=DENOMINATIONS[currency].some(d=>incoming[d]||outgoing[d]);
    if(changed&&before[currency].status!=='verified')throw Error('Verifica primero el efectivo '+currency);
    for(const d of DENOMINATIONS[currency]){
      const count=next[currency].counts[d]+incoming[d]-outgoing[d];
      if(count<0||!Number.isSafeInteger(count)||count>MAX_COUNT)throw Error('Efectivo insuficiente o cantidad fuera de rango');
      next[currency].counts[d]=count;
    }
  }
  next.lastMovement={before:{MXN:before.MXN,USD:before.USD}};return next;
}
export function undoMovement(cash){
  const valid=validateCash(cash);if(!valid.lastMovement)throw Error('No existe movimiento reversible');
  return validateCash({version:1,...valid.lastMovement.before});
}
export function finishWithoutInventory(cash,affectedCurrencies){
  const before=validateCash(cash),next=validateCash(cash);
  for(const currency of affectedCurrencies){if(!DENOMINATIONS[currency])throw Error('Moneda inválida');next[currency].status='pending';}
  next.lastMovement={before:{MXN:before.MXN,USD:before.USD}};return next;
}
export function extraSuggestion(change,counts,maxExtra=10000n){
  if(typeof change!=='bigint'||change<0n||typeof maxExtra!=='bigint'||maxExtra<0n||maxExtra>999999999999n)throw Error('Importe inválido');
  const budget={left:60000};const exact=search(change,'MXN',counts,1,budget);
  if(exact.combinations.length)return null;if(exact.limited)throw new SearchLimitError();
  const limits=normalizeCounts('MXN',counts);let step=0n;
  for(const d of DENOMINATIONS.MXN)if(limits[d])step=gcd(step,BigInt(d));
  if(!step)return null;
  const total=totalCounts('MXN',limits),end=change+maxExtra<total?change+maxExtra:total;
  let target=(change/step+1n)*step,candidates=0;
  for(;target<=end;target+=step){
    if(++candidates>5000)throw new SearchLimitError();
    const result=search(target,'MXN',limits,1,budget);
    if(result.combinations.length)return {extra:target-change,change:target,combination:result.combinations[0]};
    if(result.limited)throw new SearchLimitError();
  }
  return null;
}

