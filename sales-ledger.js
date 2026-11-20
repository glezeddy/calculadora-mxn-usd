// Contabilidad de ventas por jornada, independiente del dinero físico en caja.
// Todos los importes se expresan en centavos MXN como cadenas decimales.
const methods = ['cashMXN', 'cashUSD', 'tdc', 'tdd'];
const integer = value => { if (typeof value !== 'string' || !/^\d{1,15}$/.test(value)) throw Error('Importe de venta inválido'); return BigInt(value); };
export function emptySales() { return {version:1, entries:[], nextId:1}; }
export function validateSales(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.entries) || !Number.isSafeInteger(value.nextId) || value.nextId < 1 || value.entries.length > 10000) throw Error('Registro de ventas inválido');
  const ids = new Set();
  for (const entry of value.entries) {
    if (!Number.isSafeInteger(entry.id) || entry.id < 1 || entry.id >= value.nextId || ids.has(entry.id)) throw Error('Folio de venta inválido');
    ids.add(entry.id);
    if (!entry.parts || Object.keys(entry.parts).some(key => !methods.includes(key))) throw Error('Método de venta inválido');
    let sum = 0n;
    for (const method of methods) sum += integer(entry.parts[method] ?? '0');
    if (sum !== integer(entry.total) || sum <= 0n) throw Error('Venta no cuadra con sus métodos');
  }
  return structuredClone(value);
}
export function addSale(sales, parts, total) {
  const next = validateSales(sales);
  if (!parts || Object.keys(parts).some(key => !methods.includes(key))) throw Error('Método de venta inválido');
  const normalized = Object.fromEntries(methods.map(key => [key, String(integer(parts[key] ?? '0'))]));
  if (methods.reduce((sum, key) => sum + BigInt(normalized[key]), 0n) !== integer(total) || integer(total) <= 0n) throw Error('El pago no coincide con el total de la venta');
  const entry = {id:next.nextId++, total:String(total), parts:normalized};
  next.entries.push(entry);
  return validateSales(next);
}
export function undoLastSale(sales) {
  const next = validateSales(sales);
  if (!next.entries.length) throw Error('No hay venta para deshacer');
  next.entries.pop();
  return next;
}
export function salesTotals(sales) {
  const valid = validateSales(sales);
  const parts = Object.fromEntries(methods.map(key => [key, 0n]));
  for (const entry of valid.entries) for (const key of methods) parts[key] += BigInt(entry.parts[key] ?? '0');
  return {...parts, total:methods.reduce((sum,key)=>sum+parts[key],0n), count:valid.entries.length};
}
export function newSalesDay(sales) { validateSales(sales); return emptySales(); }
