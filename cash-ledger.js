import {initialCash,validateCash,verifyCash,newDay,applyMovement,undoMovement,finishWithoutInventory,normalizeCounts,emptyCounts,totalCounts,DENOMINATIONS,MAX_COUNT} from './change-engine.js';
import {decimal,receivedMXN,rateFraction} from './money.js';
import {validSavedRate} from './rate-store.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const blankPending=()=>({lock:null,received:null,extra:null});
export function initialSession(){return {version:1,revision:0,cash:initialCash(),draft:null,pending:blankPending(),maxExtra:'100.00'};}
export function validateForm(form){
  if(!form||!Array.isArray(form.prices)||form.prices.length<1||form.prices.length>500||!['MXN','USD','combined'].includes(form.currency)||!['auto','manual','saved'].includes(form.rateMode))throw Error('Operación guardada inválida');
  const text=value=>{if(typeof value!=='string'||value.length>100)throw Error('Campo guardado inválido');return value;};
  return {prices:form.prices.map(text),mxn:text(form.mxn),usd:text(form.usd),currency:form.currency,rateMode:form.rateMode,manualRate:text(form.manualRate)};
}
export function evaluate(form,record=null){
  form=validateForm(form);
  let total=0n,hasPrice=false,invalid=false;
  for(const value of form.prices){const n=decimal(value);if(value.trim()&&n===null)invalid=true;if(n!==null){hasPrice=true;total+=n;}}
  const validRecord=record&&validSavedRate(record)?clone(record):null;
  const rate=form.rateMode==='manual'?rateFraction(form.manualRate):validRecord&&rateFraction(validRecord.value);
  const converted=receivedMXN(form.currency,form.mxn,form.usd,rate);
  const ready=hasPrice&&!invalid&&converted!==null;
  return {form,record:validRecord,ready,total,mxn:form.currency==='USD'?0n:decimal(form.mxn)||0n,usd:form.currency==='MXN'?0n:decimal(form.usd)||0n,converted,change:ready?converted-total:null};
}
export function extraAmount(session){return session.pending.extra?BigInt(session.pending.extra.amount):0n;}
export function isLocked(session){return !!session.pending.lock;}
export function validateSession(value){
  if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0)throw Error('Estado persistente inválido');
  const result={version:1,revision:value.revision,cash:validateCash(value.cash),draft:value.draft===null?null:validateForm(value.draft),pending:blankPending(),maxExtra:value.maxExtra};
  if(decimal(result.maxExtra)===null)throw Error('Límite automático inválido');
  const p=value.pending;if(!p||!Object.hasOwn(p,'lock')||!Object.hasOwn(p,'received')||!Object.hasOwn(p,'extra'))throw Error('Movimiento pendiente inválido');
  if(p.lock){
    const context=evaluate(p.lock.form,p.lock.record);
    if(!context.ready||context.change<0n||!equal(context.form,result.draft))throw Error('Movimiento pendiente no corresponde a la cuenta');
    result.pending.lock={form:context.form,record:context.record};
  }
  if(p.received){
    if(!p.lock)throw Error('Recepción sin operación');
    const ctx=evaluate(p.lock.form,p.lock.record);result.pending.received=validateReceipt(ctx,p.received);
  }
  if(p.extra){
    if(!p.lock||typeof p.extra.amount!=='string'||!/^\d{1,12}$/.test(p.extra.amount)||BigInt(p.extra.amount)<=0n)throw Error('Ajuste guardado inválido');
    const counts=normalizeCounts('MXN',p.extra.counts);
    if(totalCounts('MXN',counts)!==BigInt(p.extra.amount))throw Error('Denominaciones de ajuste inválidas');
    result.pending.extra={amount:p.extra.amount,counts};
  }
  return result;
}
function validateReceipt(ctx,counts){
  const result={};for(const cur of ['MXN','USD']){result[cur]=normalizeCounts(cur,counts?.[cur]);if(totalCounts(cur,result[cur])!==(cur==='MXN'?ctx.mxn:ctx.usd))throw Error('Las denominaciones recibidas no coinciden con '+cur);}
  return result;
}
function verified(cash,currencies){for(const cur of currencies)if(cash[cur].status!=='verified')throw Error('Verifica primero el efectivo '+cur);}
function contextFor(state,action){
  if(!state.draft)throw Error('No existe una cuenta pendiente');
  const input=state.pending.lock||action.context;
  const ctx=evaluate(input?.form,input?.record);
  if(!ctx.ready||ctx.change<0n||!equal(ctx.form,state.draft))throw Error('La cuenta cambió o está incompleta. Revisa el cobro');return ctx;
}
export function availableCounts(state){
  if(state.cash.MXN.status!=='verified')return null;
  const result={...state.cash.MXN.counts};
  for(const d of DENOMINATIONS.MXN)result[d]+=(state.pending.received?.MXN[d]||0)+(state.pending.extra?.counts[d]||0);
  return normalizeCounts('MXN',result);
}
const affected=(ctx,extra)=>['MXN','USD'].filter(cur=>cur==='MXN'?ctx.mxn+extra>0n||ctx.change+extra>0n:ctx.usd>0n);
export function reduceSession(input,action){
  const s=validateSession(input);
  switch(action.type){
    case 'draft':{
      const form=action.form===null?null:validateForm(action.form);
      if(isLocked(s)&&!equal(form,s.draft))throw Error('Resuelve el movimiento pendiente antes de editar la cuenta');s.draft=form;break;
    }
    case 'limit':if(decimal(action.value)===null)throw Error('Límite inválido');s.maxExtra=action.value;break;
    case 'verify':
      if(isLocked(s))throw Error('Finaliza o descarta el movimiento pendiente antes de verificar');
      if(action.confirm!==true)throw Error('Confirma el conteo físico');
      s.cash=verifyCash(s.cash,action.currency,action.counts);break;
    case 'day':
      if(isLocked(s))throw Error('Resuelve primero el movimiento pendiente');
      if(action.confirm!==true)throw Error('Confirma la nueva jornada');s.cash=newDay(s.cash,action.mode);break;
    case 'receive':{
      if(s.pending.received)throw Error('El recibido ya fue confirmado para esta cuenta');
      const ctx=contextFor(s,action);const currencies=['MXN','USD'].filter(c=>c==='MXN'?ctx.mxn>0n:ctx.usd>0n);
      verified(s.cash,currencies);if(action.confirm!==true)throw Error('Confirma las denominaciones recibidas físicamente');
      s.pending.received=validateReceipt(ctx,action.counts);s.pending.lock={form:ctx.form,record:ctx.record};break;
    }
    case 'extra':{
      if(s.pending.extra)throw Error('Ya existe un ajuste: cancélalo antes de aplicar otro');
      const ctx=contextFor(s,action);verified(s.cash,['MXN']);
      const amount=decimal(action.value),counts=normalizeCounts('MXN',action.counts);
      if(amount===null||amount<=0n||totalCounts('MXN',counts)!==amount)throw Error('El adicional y sus denominaciones no coinciden');
      if(action.confirm!==true)throw Error('Confirma recepción física del adicional');
      s.pending.extra={amount:String(amount),counts};s.pending.lock={form:ctx.form,record:ctx.record};break;
    }
    case 'cancel-extra':
      if(!s.pending.extra)throw Error('No existe ajuste');if(action.returned!==true)throw Error('Confirma que devolviste físicamente el adicional con las mismas denominaciones');
      s.pending.extra=null;if(!s.pending.received)s.pending.lock=null;break;
    case 'discard':
      if(isLocked(s)&&action.returned!==true)throw Error('Confirma la devolución física de los importes pendientes');
      s.pending=blankPending();s.draft=null;break;
    case 'finish':{
      const ctx=contextFor(s,action),extra=extraAmount(s),change=ctx.change+extra;
      if(action.withoutInventory){
        if(action.confirm!==true)throw Error('Confirma finalización física sin actualizar inventario');
        s.cash=finishWithoutInventory(s.cash,affected(ctx,extra));
      }else{
        const received=s.pending.received||validateReceipt(ctx,action.received);
        if(!s.pending.received&&action.receivedPhysical!==true)throw Error('Confirma denominaciones recibidas físicamente');
        const outgoing=normalizeCounts('MXN',action.dispensed);
        if(totalCounts('MXN',outgoing)!==change)throw Error('Las denominaciones entregadas no suman el cambio exacto');
        if(change>0n&&action.dispensedPhysical!==true)throw Error('Confirma el cambio entregado físicamente');
        const incoming=clone(received);
        for(const d of DENOMINATIONS.MXN)incoming.MXN[d]+=s.pending.extra?.counts[d]||0;
        s.cash=applyMovement(s.cash,incoming,{MXN:outgoing});
      }
      s.pending=blankPending();s.draft=null;break;
    }
    case 'undo':
      if(isLocked(s))throw Error('Resuelve el movimiento pendiente antes de deshacer');
      if(action.confirm!==true)throw Error('Confirma reversión física del último movimiento');s.cash=undoMovement(s.cash);break;
    default:throw Error('Acción inválida');
  }
  s.revision++;return validateSession(s);
}
export class CashStore{
  constructor(storage,key,locks){this.storage=storage;this.key=key;this.locks=locks;this.queue=Promise.resolve();this.state=this.read();}
  read(){const raw=this.storage.getItem(this.key);return raw===null?initialSession():validateSession(JSON.parse(raw));}
  dispatch(action){
    const run=async()=>{
      if(!this.locks?.request)throw Error('Este navegador no permite bloquear escrituras entre pestañas. Usa cálculos generales; administración deshabilitada');
      return this.locks.request('cuenta-clara:'+this.key,()=>{
        const disk=this.read();if(disk.revision!==this.state.revision)throw Error('Otra pestaña cambió la jornada. Recarga antes de continuar');
        const next=reduceSession(disk,action);
        // Un único setItem es el punto de confirmación: caja, pendiente y deshacer se escriben juntos.
        this.storage.setItem(this.key,JSON.stringify(next));this.state=next;return clone(next);
      });
    };
    const result=this.queue.then(run);this.queue=result.catch(()=>{});return result;
  }
}
