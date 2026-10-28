// Motor puro de Cambio inteligente v1.4. Importes en centavos enteros.
export const DENOMINATIONS = Object.freeze({
  MXN: Object.freeze([100000,50000,20000,10000,5000,2000,1000,500,200,100,50,20,10]),
  USD: Object.freeze([10000,5000,2000,1000,500,100,50,25,10,5,1])
});
export const STATES = Object.freeze(['unverified','verified','pending']);
export function emptyCounts(currency) {
  if (!DENOMINATIONS[currency]) throw new Error('Moneda inválida');
  return Object.fromEntries(DENOMINATIONS[currency].map(v => [v,0]));
}
export function normalizeCounts(currency, counts) {
  const result=emptyCounts(currency);
  for (const [key,value] of Object.entries(counts ?? {})) {
    if (!(key in result) || !Number.isSafeInteger(value) || value<0 || value>1000000) throw new Error('Cantidad de piezas inválida');
    result[key]=value;
  }
  return result;
}
export function totalCounts(currency,counts) {
  const valid=normalizeCounts(currency,counts);
  return DENOMINATIONS[currency].reduce((sum,d)=>sum+BigInt(d)*BigInt(valid[d]),0n);
}
export function combination(amount,currency='MXN',available=null) {
  if (typeof amount!=='bigint'||amount<0n) throw new Error('Importe inválido');
  const denoms=DENOMINATIONS[currency];
  if (!denoms) throw new Error('Moneda inválida');
  const limits=available===null?null:normalizeCounts(currency,available);
  // Backtracking acotado con memoización; no asume que greedy encuentre una solución.
  const memo=new Set();
  function find(i,remaining) {
    if (remaining===0n) return {};
    if (i===denoms.length) return null;
    const key=i+':'+remaining;
    if (memo.has(key)) return null;
    const unit=BigInt(denoms[i]);
    const cap=remaining/unit;
    const maximum=limits===null?cap:(cap<BigInt(limits[denoms[i]])?cap:BigInt(limits[denoms[i]]));
    for(let count=maximum;count>=0n;count--) {
      const rest=find(i+1,remaining-count*unit);
      if(rest!==null) return count?{[denoms[i]]:Number(count),...rest}:rest;
    }
    memo.add(key);
    return null;
  }
  return find(0,amount);
}
export function initialCash() {
  return {version:1,MXN:{counts:emptyCounts('MXN'),status:'unverified'},USD:{counts:emptyCounts('USD'),status:'unverified'},lastMovement:null};
}
export function validateCash(cash) {
  if(!cash||cash.version!==1) throw new Error('Estado de caja inválido');
  const next={version:1,lastMovement:null};
  for(const currency of ['MXN','USD']) {
    if(!STATES.includes(cash[currency]?.status)) throw new Error('Verificación inválida');
    next[currency]={counts:normalizeCounts(currency,cash[currency].counts),status:cash[currency].status};
  }
  return next;
}
export function newDay(cash,mode) {
  const next=validateCash(cash);
  if(mode!=='zero'&&mode!=='keep') throw new Error('Opción de jornada inválida');
  for(const currency of ['MXN','USD']) {
    if(mode==='zero') next[currency].counts=emptyCounts(currency);
    next[currency].status=mode==='zero'?'unverified':'pending';
  }
  return next;
}
export function verifyCash(cash,currency,counts) {
  const next=validateCash(cash);
  next[currency].counts=normalizeCounts(currency,counts);
  next[currency].status='verified';
  return next;
}
export function applyMovement(cash,received,dispensed) {
  const before=validateCash(cash);
  const next=validateCash(cash);
  for(const currency of ['MXN','USD']) {
    const incoming=normalizeCounts(currency,received?.[currency]??{});
    const outgoing=normalizeCounts(currency,dispensed?.[currency]??{});
    const changed=DENOMINATIONS[currency].some(d=>incoming[d]||outgoing[d]);
    if(changed&&before[currency].status!=='verified') throw new Error('Verifica primero el efectivo '+currency);
    for(const d of DENOMINATIONS[currency]) {
      const count=next[currency].counts[d]+incoming[d]-outgoing[d];
      if(count<0||!Number.isSafeInteger(count)) throw new Error('Efectivo insuficiente o cantidad inválida');
      next[currency].counts[d]=count;
    }
  }
  next.lastMovement={before:{MXN:before.MXN,USD:before.USD}};
  return next;
}
export function undoMovement(cash) {
  if(!cash?.lastMovement?.before) throw new Error('No existe movimiento reversible');
  const before=validateCash({version:1,...cash.lastMovement.before});
  return before;
}
export function finishWithoutInventory(cash,affectedCurrencies) {
  const next=validateCash(cash);
  for(const currency of affectedCurrencies) {
    if(!DENOMINATIONS[currency]) throw new Error('Moneda inválida');
    next[currency].status='pending';
  }
  return next;
}
export function extraSuggestion(change,counts,maxExtra=10000n) {
  if(typeof change!=='bigint'||change<0n||typeof maxExtra!=='bigint'||maxExtra<0n) throw new Error('Importe inválido');
  if(combination(change,'MXN',counts)!==null) return null;
  const cap=maxExtra>100000n?100000n:maxExtra;
  for(let extra=1n;extra<=cap;extra++) {
    const selected=combination(change+extra,'MXN',counts);
    if(selected!==null) return {extra,change:change+extra,combination:selected};
  }
  return null;
}
