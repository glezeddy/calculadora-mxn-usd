import {CashStore,initialSession,evaluate,extraAmount,isLocked,availableCounts,hasDraftMoney,validateForm} from './cash-ledger.js';
import {DENOMINATIONS,normalizeCounts,totalCounts,emptyCounts} from './change-engine.js';
import {decimal,money,amountText} from './money.js';
const statusNames={verified:'Verificado',pending:'Pendiente de verificar',unverified:'Sin verificar'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createCashUI(hooks){
 const $=id=>document.getElementById(id);const key='cuenta-clara:cash:v1:'+location.pathname.replace(/index\.html$/,'');
 let localDraft=null,localSerialized='',recovery=null;
 try{recovery=JSON.parse(sessionStorage.getItem(key+':recovery'));}catch{recovery={type:'unknown'};}
 try{const raw=sessionStorage.getItem(key+':capture');if(raw){localDraft=JSON.parse(raw);localDraft.form=validateForm(localDraft.form);localSerialized=JSON.stringify(localDraft);}}catch{localDraft=null;}
 let store=null,blocked='',transientMessage='',ctx=null,lastForm='',busy=false,job=0,searchKey='',selected={},results=[],suggestion=null,worker=null;
 try{store=new CashStore(localStorage,key,navigator.locks);if(!navigator.locks?.request)blocked='Administración deshabilitada: este navegador no admite escrituras protegidas entre pestañas.';}catch{blocked='No se pudo cargar el efectivo guardado. No se reinició ni sobrescribió. Usa cálculos generales y revisa el almacenamiento del navegador.';}
 if(recovery)blocked='Hubo un fallo de guardado. No repitas entregas ni continúes el cobro. Resuelve físicamente los movimientos y usa Recuperar tras fallo para recontar ambas monedas.';
 const state=()=>store?.state||initialSession();
 const error=message=>{transientMessage=message;$('cash-error').textContent=message;};
 const dialog=$('cash-dialog');let dialogBusy=false;
 function closeDialog(){if(!dialogBusy)dialog.close();}
 dialog.addEventListener('cancel',event=>{if(dialogBusy)event.preventDefault();});
 function modal(title){
   if(dialog.open)dialog.close();dialog.replaceChildren();const heading=document.createElement('h2');heading.id='cash-dialog-title';heading.textContent=title;dialog.append(heading);
   const body=document.createElement('div');body.className='cash-dialog-body';dialog.append(body);
   body.addEventListener('input',event=>{if(event.target.type!=='checkbox')body.querySelectorAll('input[type=checkbox]').forEach(input=>input.checked=false);});
   const alert=document.createElement('p');alert.className='error';alert.id='cash-dialog-error';alert.setAttribute('role','alert');dialog.append(alert);
   const actions=document.createElement('div');actions.className='cash-dialog-actions';dialog.append(actions);
   const cancel=button('Cancelar',()=>closeDialog(),'secondary');actions.append(cancel);
   dialog.showModal();return{body,actions,alert};
 }
 function button(text,handler,css=''){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=css;b.addEventListener('click',handler);return b;}
 function paragraph(host,text,css='muted'){const p=document.createElement('p');p.textContent=text;p.className=css;host.append(p);return p;}
 function checkbox(host,label,id){const wrapper=document.createElement('label');wrapper.className='physical-confirm';const input=document.createElement('input');input.type='checkbox';input.id=id;wrapper.append(input,document.createTextNode(label));host.append(wrapper);return input;}
 function countsEditor(host,currency,values={},label='Denominaciones'){
   const section=document.createElement('fieldset');section.className='counts-editor';const legend=document.createElement('legend');legend.textContent=label+' · '+currency;section.append(legend);
   const grid=document.createElement('div');grid.className='counts-grid';section.append(grid);const inputs={};
   for(const d of DENOMINATIONS[currency]){const l=document.createElement('label');const span=document.createElement('span');span.textContent=money(BigInt(d),currency);const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.autocomplete='off';input.value=String(values[d]||0);input.setAttribute('aria-label',`${label}: piezas de ${span.textContent}`);input.dataset.denom=String(d);l.append(span,input);grid.append(l);inputs[d]=input;}
   const total=document.createElement('p');total.className='count-total';section.append(total);host.append(section);
   const get=()=>{const counts={};for(const [d,input]of Object.entries(inputs)){const value=input.value.trim();if(!/^\d{0,7}$/.test(value)||Number(value)>1000000)throw Error('Escribe cantidades enteras de 0 a 1,000,000');counts[d]=Number(value||0);}return normalizeCounts(currency,counts);};
   const update=()=>{for(const input of Object.values(inputs))input.setAttribute('aria-invalid',String(!/^\d{0,7}$/.test(input.value.trim())||Number(input.value)>1000000));try{total.textContent='Total contado: '+money(totalCounts(currency,get()),currency);}catch{total.textContent='Cantidades inválidas';}};
   for(const input of Object.values(inputs))input.addEventListener('input',update);update();
   return{get,set(values){for(const [d,input]of Object.entries(inputs))input.value=String(values[d]||0);update();}};
 }
 function paint(){
   const s=state(),locked=isLocked(s);
   $('cash-error').textContent=blocked||transientMessage;
   for(const cur of ['MXN','USD']){
     $(`cash-status-${cur}`).textContent=blocked?'Disponibilidad suspendida':statusNames[s.cash[cur].status];$(`cash-status-${cur}`).dataset.status=blocked?'pending':s.cash[cur].status;
     $(`cash-total-${cur}`).textContent=blocked&&!store?'No disponible':money(totalCounts(cur,s.cash[cur].counts),cur);
   }
   $('cash-undo').disabled=!!blocked||busy||!s.cash.lastMovement||locked;
   for(const id of ['cash-verify-mxn','cash-verify-usd','cash-day','cash-receive','cash-finish','cash-adjust'])$(id).disabled=!!blocked||busy;
   $('cash-receive').disabled ||= !ctx?.ready||ctx.change<0n||!!s.pending.received;
   $('cash-finish').disabled ||= !ctx?.ready||ctx.change+extraAmount(s)<0n;
   $('cash-adjust').disabled ||= !ctx?.ready||ctx.change<0n||s.cash.MXN.status!=='verified'||!!s.pending.extra;
   $('cash-cancel-extra').hidden=!s.pending.extra;$('cash-cancel-extra').disabled=!!blocked||busy;
   $('cash-recover').hidden=!recovery;$('cash-recover').disabled=!store||busy;
   $('cash-banner').hidden=!locked;
   $('cash-banner').textContent=s.pending.extra?`Adicional recibido físicamente: ${money(extraAmount(s))}. Incluido una sola vez en el cambio. Inventario aún sin actualizar. La cuenta y la tasa quedan bloqueadas hasta finalizar o cancelar.`:locked?'Denominaciones recibidas confirmadas, pendientes de finalizar. La cuenta y la tasa están bloqueadas para evitar inconsistencias.':'';
   const selector='#prices input, #prices button, #add, input[name=currency], #received-mxn, #received-usd, #mxn-bills button, #usd-bills button, #clear-mxn, #clear-usd, #manual-rate, #rate-mode, .received-box > .amount-control button';
   document.querySelectorAll(selector).forEach(e=>{e.disabled=locked;});
   if(locked){$('refresh').disabled=true;document.dispatchEvent(new Event('cash-lock'));}
   $('cash-limit').value=s.maxExtra;
   $('cash-limit').disabled=!!blocked||busy;
   const option=$('cash-available-option');option.disabled=!!blocked||s.cash.MXN.status!=='verified';
   if(option.disabled&&$('combination-mode').value==='available')$('combination-mode').value='general';
   $('cash-stock-note').textContent=!blocked&&s.cash.MXN.status==='verified'?'Disponibilidad MXN verificada. Las entradas confirmadas de esta cuenta se consideran provisionalmente; se registran una sola vez al finalizar.':'Sugerencias por disponibilidad suspendidas: verifica MXN y resuelve los avisos de guardado. Los cálculos generales siguen disponibles.';
   $('cash-pending').textContent=locked?'Hay un movimiento pendiente de confirmación final. No está aplicado al inventario.':s.draft&&(decimal(s.draft.mxn)>0n||decimal(s.draft.usd)>0n)?'Cuenta en curso. Recibido y entregado aún no registrados.':'Sin movimientos pendientes confirmados.';
   calculate();
 }
 function drawCombination(){
   const board=$('denomination-board');board.replaceChildren();
   for(const d of DENOMINATIONS.MXN){
     const count=selected[d]||0,card=document.createElement('div');
     card.className='denomination'+(count?' used':'');
     card.setAttribute('aria-label',`${money(BigInt(d))}: ${count} piezas`);
     const value=document.createElement('strong');
     value.textContent=d%100===0?'$'+(BigInt(d)/100n).toLocaleString('es-MX'):money(BigInt(d)).replace(' MXN','');
     const qty=document.createElement('span');qty.textContent=`${count} ${count===1?'pieza':'piezas'}`;
     card.append(value,qty);board.append(card);
   }
   const sum=Object.entries(selected).reduce((n,[d,q])=>n+BigInt(d)*BigInt(q),0n),pieces=Object.values(selected).reduce((a,b)=>a+b,0);
   $('combination-total').textContent=results.length?`Total exacto: ${money(sum)} · ${pieces} piezas`:'No hay combinación seleccionada.';
 }
 try{worker=new Worker(new URL('./change-worker.js',import.meta.url),{type:'module'});}catch{}
 function calculate(){
   if(!ctx?.ready||ctx.change+extraAmount(state())<0n){searchKey='';++job;results=[];selected={};suggestion=null;$('combination-choice').replaceChildren();$('combination-choice').disabled=true;$('combination-status').textContent='Completa un pago válido para preparar el cambio.';$('cash-suggestion').textContent='';drawCombination();return;}
   let available=null,availabilityError='';try{available=blocked?null:availableCounts(state());}catch(e){availabilityError=e.message;error(e.message);}
   const change=ctx.change+extraAmount(state()),mode=$('combination-mode').value;
   if(mode==='available'&&(!available||availabilityError)){++job;results=[];selected={};suggestion=null;$('combination-status').textContent='Disponibilidad suspendida: '+(availabilityError||'verifica primero el efectivo MXN');drawCombination();return;}
   const params={change:String(change),available:mode==='available'?available:null,suggestionAvailable:available,maxExtra:String(decimal(state().maxExtra)),suggest:!state().pending.extra};
   const signature=JSON.stringify(params);if(signature===searchKey)return;searchKey=signature;results=[];selected={};suggestion=null;$('combination-status').textContent='Buscando combinaciones exactas…';drawCombination();
   if(!worker){$('combination-status').textContent='El navegador no admite el motor en segundo plano. Puedes registrar denominaciones manualmente al finalizar.';return;}
   worker.postMessage({id:++job,...params});
 }
 if(worker){worker.onmessage=({data})=>{
   if(data.id!==job)return;results=data.combinations||[];selected=results[0]||{};suggestion=data.suggestion||null;
   const select=$('combination-choice');select.replaceChildren();results.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`Combinación ${i+1} · ${Object.values(c).reduce((a,b)=>a+b,0)} piezas`;select.append(o);});select.disabled=results.length<2;
   $('combination-status').textContent=data.error|| (results.length?($('combination-mode').value==='available'?'Combinaciones exactas con efectivo verificado.':'Combinaciones generales: no garantizan disponibilidad física.')+(data.limited?' Búsqueda limitada; podrían existir más alternativas.':''):data.limited?'La búsqueda llegó a su límite seguro; no se afirma que sea imposible.':'No existe combinación exacta en este modo. No se redondeará el cambio.');
   $('cash-suggestion').textContent=state().pending.extra?'Ya existe un adicional recibido. Cancélalo con devolución física antes de aplicar otro.':blocked||state().cash.MXN.status!=='verified'?'Verifica MXN y resuelve los avisos antes de proponer ajustes por disponibilidad.':data.suggestError|| (suggestion?`Puedes pedir ${money(BigInt(suggestion.extra))} adicionales: cambio final ${money(BigInt(suggestion.change))}. No se aplica hasta confirmar recepción física.`:'No hay ajuste automático propuesto dentro del límite. Puedes introducir uno manual.');drawCombination();
 };worker.onerror=()=>{$('combination-status').textContent='No se pudo ejecutar el motor. Los importes y el registro manual siguen disponibles.';};}
 async function perform(action,clear=false){
   if(blocked&&!(action.type==='recover'&&recovery&&store))throw Error(blocked);if(busy)throw Error('Espera a que termine la operación');busy=true;paint();
   try{await store.dispatch(action);if(action.type==='recover'){sessionStorage.removeItem(key+':recovery');recovery=null;blocked='';}if(clear){try{sessionStorage.removeItem(key+':capture');}catch{blocked='El movimiento sí quedó guardado, pero no se pudo limpiar la captura local. Revisa el efectivo antes de continuar.';}localDraft=null;localSerialized='';}transientMessage='';lastForm=JSON.stringify(store.state.draft);searchKey='';if(clear)hooks.clear();else hooks.render();paint();}
   catch(e){if(e.code==='cash-storage-write'){recovery={type:action.type};try{sessionStorage.setItem(key+':recovery',JSON.stringify(recovery));}catch{}blocked='No se guardó el movimiento. No repitas entregas. Mantén esta pantalla y, después de resolver físicamente el cobro, usa Recuperar tras fallo para contar ambas monedas.';e.message=blocked;}throw e;}
   finally{busy=false;paint();}
 }
 async function submit(panel,action,clear=false){
   if(dialogBusy)return;dialogBusy=true;panel.actions.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await perform(action,clear);dialog.close();}catch(e){panel.alert.textContent=e.message;panel.alert.tabIndex=-1;panel.alert.focus();}
   finally{dialogBusy=false;panel.actions.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 const capture=()=>({form:ctx.form,record:ctx.record});
 function verify(currency){
   if(isLocked(state())||hasDraftMoney(state())){error('Finaliza o descarta la cuenta con dinero recibido antes de verificar efectivo. Cuenta el fondo de caja antes de recibir el pago para no duplicarlo.');return;}
   const p=modal('Verificar mi efectivo · '+currency);paragraph(p.body,'Cuenta físicamente el efectivo. Los campos vacíos representan cero. Cancelar no cambia el inventario.');
   const label=document.createElement('label');label.textContent='Método de verificación';label.htmlFor='cash-verify-mode';const select=document.createElement('select');select.id='cash-verify-mode';select.innerHTML='<option value="zero">Conteo completo desde cero</option><option value="correct">Corrección rápida de cantidades existentes</option>';p.body.append(label,select);
   const editor=countsEditor(p.body,currency,{},'Conteo físico');select.addEventListener('change',()=>editor.set(select.value==='zero'?{}:state().cash[currency].counts));
   const confirmed=checkbox(p.body,'Confirmo que conté físicamente estas denominaciones.','physical-count');
   p.actions.append(button('Guardar conteo verificado',()=>{try{submit(p,{type:'verify',currency,counts:editor.get(),confirm:confirmed.checked});}catch(e){p.alert.textContent=e.message;}}));
 }
 function receipt(){
   if(!ctx?.ready||ctx.change<0n)return;const context=capture(),p=modal('Registrar efectivo recibido');paragraph(p.body,'Se confirma el dinero físico de la compra original. El adicional, si existe, se muestra por separado y no se vuelve a capturar. El inventario se actualiza solo al finalizar.');
   const editors={};for(const cur of ['MXN','USD']){const expected=cur==='MXN'?ctx.mxn:ctx.usd;if(expected>0n){paragraph(p.body,'Recibido esperado: '+money(expected,cur));editors[cur]=countsEditor(p.body,cur,{},'Recibido');}}
   const confirmed=checkbox(p.body,'Confirmo que recibí físicamente las denominaciones indicadas.','physical-received');
   p.actions.append(button('Confirmar recibido pendiente',()=>{try{const counts={MXN:editors.MXN?.get()||{},USD:editors.USD?.get()||{}};submit(p,{type:'receive',context,counts,confirm:confirmed.checked});}catch(e){p.alert.textContent=e.message;}}));
 }
 function adjust(){
   if(!ctx?.ready)return;const context=capture(),p=modal('Ajustar cambio');paragraph(p.body,'Pide el adicional al cliente. Este ajuste es solo MXN; no cambia el total de la compra. Puedes superar el límite automático manualmente.');
   const label=document.createElement('label');label.htmlFor='cash-extra-value';label.textContent='Adicional a recibir en MXN';const value=document.createElement('input');value.id='cash-extra-value';value.type='text';value.inputMode='decimal';value.value=suggestion?amountText(BigInt(suggestion.extra)):'';p.body.append(label,value);
   const editor=countsEditor(p.body,'MXN',{},'Adicional recibido');
   const confirmed=checkbox(p.body,'Confirmo que el cliente entregó físicamente este adicional y estas denominaciones.','physical-extra');
   p.actions.append(button('Aplicar adicional recibido',()=>{try{submit(p,{type:'extra',context,value:value.value,counts:editor.get(),confirm:confirmed.checked});}catch(e){p.alert.textContent=e.message;}}));
 }
 function cancelExtra(){
   const p=modal('Cancelar ajuste adicional');paragraph(p.body,'Devuelve al cliente '+money(extraAmount(state()))+' usando las mismas denominaciones que recibiste como adicional. La compra original se conserva.');
   const confirmed=checkbox(p.body,'Confirmo que devolví físicamente el adicional con las mismas denominaciones.','physical-return-extra');
   p.actions.append(button('Cancelar ajuste confirmado',()=>submit(p,{type:'cancel-extra',returned:confirmed.checked})));
 }
 function finalize(){
   if(!ctx?.ready||ctx.change+extraAmount(state())<0n){const message='Completa un pago suficiente y válido antes de finalizar. Cancela este diálogo para corregir la cuenta.';if(dialog.open&&$('cash-dialog-error'))$('cash-dialog-error').textContent=message;else error(message);return;}
   const context=capture(),p=modal('Finalizar cobro'),change=ctx.change+extraAmount(state());
   paragraph(p.body,'Cambio que debes entregar: '+money(change)+'. El guardado de entradas y salidas será una sola operación.');
   const editors={};if(state().pending.received)paragraph(p.body,'Las denominaciones de la compra original ya están confirmadas. No se contabilizarán de nuevo.');
   else for(const cur of ['MXN','USD']){const expected=cur==='MXN'?ctx.mxn:ctx.usd;if(expected>0n){paragraph(p.body,'Recibido esperado: '+money(expected,cur));editors[cur]=countsEditor(p.body,cur,{},'Recibido');}}
   if(state().pending.extra)paragraph(p.body,'Adicional ya confirmado: '+money(extraAmount(state()))+'. Se incluirá una sola vez.');
   const received=state().pending.received?null:checkbox(p.body,'Confirmo las denominaciones recibidas físicamente.','physical-final-received');
   const outgoing=countsEditor(p.body,'MXN',selected,'Cambio entregado');
   const delivered=checkbox(p.body,'Confirmo que entregué físicamente estas denominaciones de cambio.','physical-delivered');
   paragraph(p.body,'Si faltan denominaciones o el efectivo no está verificado: completa el registro, o finaliza sin actualizar inventario y la moneda afectada quedará pendiente de verificar.');
   p.actions.append(button('Completar y confirmar movimiento',()=>{try{submit(p,{type:'finish',context,received:{MXN:editors.MXN?.get()||{},USD:editors.USD?.get()||{}},receivedPhysical:received?.checked||false,dispensed:outgoing.get(),dispensedPhysical:delivered.checked},true);}catch(e){p.alert.textContent=e.message;}}));
   p.actions.append(button('Finalizar sin actualizar inventario',()=>finishWithout(context),'secondary'));
 }
 function finishWithout(context){
   const p=modal('Finalizar sin actualizar inventario');paragraph(p.body,'No se sumarán ni restarán piezas. Las monedas afectadas quedarán pendientes de verificar y sus sugerencias de disponibilidad se suspenderán.');
   const confirmed=checkbox(p.body,'Confirmo que el cobro y el cambio fueron realizados físicamente, aunque falte el registro de denominaciones.','physical-without');
   p.actions.append(button('Confirmar finalización sin inventario',()=>submit(p,{type:'finish',context,withoutInventory:true,confirm:confirmed.checked},true)));
   p.actions.append(button('Volver a completar el registro',()=>finalize(),'secondary'));
 }
 function newAccount(){
   if(recovery){recover();return;}
   if(blocked&&!isLocked(state())){hooks.clear();return;}
   const s=state(),hasMoney=ctx&&(ctx.mxn>0n||ctx.usd>0n)||isLocked(s);
   if(!hasMoney){perform({type:'discard'},true).catch(e=>error(e.message));return;}
   const p=modal('Nueva cuenta · Movimientos pendientes');paragraph(p.body,'Elige confirmar el cobro, descartar la cuenta o cancelar para seguir revisándola. Nada cambia al cancelar.');
   const returned=checkbox(p.body,'No hubo movimiento físico, o ya devolví los importes recibidos (incluido cualquier adicional con sus mismas denominaciones).','physical-discard');
   p.actions.append(button('Confirmar / finalizar cobro',()=>finalize()));p.actions.append(button('Descartar cuenta',()=>{if(!returned.checked){p.alert.textContent='Confirma la situación física del efectivo antes de descartar.';return;}submit(p,{type:'discard',returned:true},true);},'secondary'));
 }
 function day(){
   if(isLocked(state())||ctx&&(ctx.mxn>0n||ctx.usd>0n)){error('Resuelve los movimientos de la cuenta actual antes de comenzar otra jornada.');return;}
   const p=modal('Nueva jornada');paragraph(p.body,'Ninguna opción marca el efectivo como verificado. Tendrás que contarlo físicamente de nuevo. Se invalida Deshacer último movimiento.');
   const options=document.createElement('fieldset');options.innerHTML='<legend>Cómo comenzar</legend><label class="physical-confirm"><input type="radio" name="cash-day-mode" value="zero" checked>Comenzar en cero</label><p class="metadata">Reiniciar cantidades y marcar el efectivo como no verificado.</p><label class="physical-confirm"><input type="radio" name="cash-day-mode" value="keep">Conservar efectivo anterior</label><p class="metadata">Mantener cantidades y exigir nueva verificación física.</p>';p.body.append(options);
   const confirmed=checkbox(p.body,'Confirmo iniciar una nueva jornada con la opción seleccionada.','physical-day');
   p.actions.append(button('Comenzar jornada',()=>submit(p,{type:'day',mode:options.querySelector('input:checked').value,confirm:confirmed.checked})));
 }
 function undo(){
   const p=modal('Deshacer último movimiento');paragraph(p.body,'Antes de confirmar, revierte físicamente la entrada y salida del último movimiento. Se restaurarán ambas monedas y sus estados anteriores. No se puede deshacer un movimiento anterior a este.');
   const before=state().cash.lastMovement?.before;
   if(before)for(const cur of ['MXN','USD'])for(const d of DENOMINATIONS[cur]){const delta=before[cur].counts[d]-state().cash[cur].counts[d];if(delta)paragraph(p.body,`${cur} ${money(BigInt(d),cur)}: ${delta>0?'recuperar':'devolver'} ${Math.abs(delta)} piezas.`,'metadata');}
   const confirmed=checkbox(p.body,'Confirmo que revertí físicamente el último movimiento.','physical-undo');p.actions.append(button('Deshacer movimiento confirmado',()=>submit(p,{type:'undo',confirm:confirmed.checked})));
 }
 function recover(){
   const p=modal('Recuperar tras fallo de guardado');paragraph(p.body,'El intento no quedó confirmado digitalmente. Primero resuelve físicamente todos los cobros y adicionales pendientes: complétalos o devuélvelos sin repetir entregas. Después cuenta TODO el efectivo actual de ambas monedas. Estos conteos sustituyen lo registrado, descartan la cuenta pendiente y desactivan Deshacer; no se vuelve a sumar ni restar el intento fallido.');
   const mxn=countsEditor(p.body,'MXN',{},'Recuento de recuperación'),usd=countsEditor(p.body,'USD',{},'Recuento de recuperación');
   const confirmed=checkbox(p.body,'Confirmo que resolví físicamente todos los movimientos pendientes y que conté todo el efectivo actual en MXN y USD.','physical-recovery');
   p.actions.append(button('Confirmar recuento y recuperar',()=>{try{submit(p,{type:'recover',counts:{MXN:mxn.get(),USD:usd.get()},confirm:confirmed.checked},true);}catch(e){p.alert.textContent=e.message;}}));
 }
 $('cash-recover').addEventListener('click',recover);
 $('cash-verify-mxn').addEventListener('click',()=>verify('MXN'));$('cash-verify-usd').addEventListener('click',()=>verify('USD'));$('cash-day').addEventListener('click',day);$('cash-undo').addEventListener('click',undo);$('cash-receive').addEventListener('click',receipt);$('cash-finish').addEventListener('click',finalize);$('cash-adjust').addEventListener('click',adjust);$('cash-cancel-extra').addEventListener('click',cancelExtra);
 $('prepare-change').addEventListener('click',()=>{const open=$('cash-tools').hidden;$('cash-tools').hidden=!open;$('prepare-change').setAttribute('aria-expanded',String(open));if(open)calculate();});
 $('combination-mode').addEventListener('change',()=>{searchKey='';calculate();});$('combination-choice').addEventListener('change',()=>{selected=results[Number($('combination-choice').value)]||{};drawCombination();});
 $('cash-limit').addEventListener('change',()=>perform({type:'limit',value:$('cash-limit').value}).catch(e=>error(e.message)));
 window.addEventListener('storage',event=>{if(event.key===key){blocked='Otra pestaña modificó la jornada. Recarga antes de administrar efectivo; no se sobrescribirán sus cambios.';paint();}});
 document.addEventListener('before-app-update',event=>{event.detail.wait.push((store?.queue||Promise.resolve()).then(()=>{if(blocked)throw Error(blocked);}));});
 window.addEventListener('beforeunload',event=>{if(blocked&&ctx&&(ctx.mxn>0n||ctx.usd>0n)){event.preventDefault();event.returnValue='';}});
 return{
   state,locked:()=>isLocked(state()),lockContext:()=>state().pending.lock,extra:()=>extraAmount(state()),
   restore(){const stamp=JSON.stringify([state().cash,state().pending]);const draft=isLocked(state())?state().draft:localDraft?.stamp===stamp?localDraft.form:state().draft;if(localDraft&&localDraft.stamp!==stamp&&!isLocked(state()))transientMessage='El efectivo cambió desde tu captura local. Se recuperó la cuenta compartida; no se mezclaron movimientos.';lastForm=JSON.stringify(state().draft);if(draft)hooks.restore(draft);paint();},
   update(form,record){
     try{ctx=evaluate(form,record);}catch(e){ctx=null;error(e.message);paint();return;}
     try{const capture={form,stamp:JSON.stringify([state().cash,state().pending])},raw=JSON.stringify(capture);if(raw!==localSerialized){sessionStorage.setItem(key+':capture',raw);localDraft=capture;localSerialized=raw;}}catch{blocked='No se puede guardar la captura inmediata. Administración suspendida; no cierres esta cuenta sin revisar el efectivo.';}
     const json=JSON.stringify(form);if(json!==lastForm&&!blocked&&store){lastForm=json;store.dispatch({type:'draft',form}).then(()=>paint()).catch(e=>{blocked='No se guardó la operación: '+e.message;paint();});}
     paint();
   },newAccount,
   flush:()=>store?.queue
 };
}
