import {
  record,
  validate,
  formatOrderNumber,
  normalizePrinterCatalog,
  normalizePrinterEntry,
  normalizeCounterTicket,
  validateCounterTicket,
  recordCounterTicket
} from './model.js';

const printersStorageKey = 'os-maneger:printers:v1';
const counterFallbackStorageKey = 'os-maneger:counter-tickets:v1';

function getSafeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function localListPrinters() {
  const store = getSafeLocalStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(printersStorageKey);
    return raw ? normalizePrinterCatalog(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function localReplacePrinters(list) {
  const normalized = normalizePrinterCatalog(list);
  const store = getSafeLocalStorage();
  if (store) {
    try {
      store.setItem(printersStorageKey, JSON.stringify(normalized));
    } catch {}
  }
  return normalized;
}

export function localSavePrinter(input) {
  const entry = normalizePrinterEntry({
    ...input,
    createdAt: input?.createdAt || new Date().toISOString()
  });
  if (!entry) throw Error('Informe o nome da impressora.');
  const current = localListPrinters().filter(
    item => item.id !== entry.id && item.name.toLocaleLowerCase('pt-BR') !== entry.name.toLocaleLowerCase('pt-BR')
  );
  current.push(entry);
  localReplacePrinters(current);
  return entry;
}

export function localDeletePrinter(idOrName) {
  const target = String(idOrName || '').trim().toLocaleLowerCase('pt-BR');
  const next = localListPrinters().filter(
    item => item.id !== idOrName && item.name.toLocaleLowerCase('pt-BR') !== target
  );
  return localReplacePrinters(next);
}
let database;
async function db() {
  if (!database) database = await new Promise((resolve,reject)=>{
    const req = indexedDB.open('os-maneger',2);
    req.onupgradeneeded = ()=>{
      const d = req.result;
      if (!d.objectStoreNames.contains('orders')) {
        d.createObjectStore('orders',{keyPath:'number'});
      }
      if (!d.objectStoreNames.contains('counter_tickets')) {
        d.createObjectStore('counter_tickets',{keyPath:'id'});
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
  return database;
}
export async function localList() {
  const database = await db();
  return new Promise((resolve,reject)=>{
    const req = database.transaction('orders').objectStore('orders').getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
export async function localSave(input) {
  input={...input,number:formatOrderNumber(input.number)};
  const error=validate(input);
  if(error)throw Error(error);
  if(!Number.isSafeInteger(input.version) || input.version<0)throw Error('Versão inválida.');
  const original=input.originalNumber ? formatOrderNumber(input.originalNumber) : input.number;
  if(!/^\d{4}-\d{6}$/.test(original))throw Error('Número original inválido.');
  const database=await db();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('orders','readwrite');
    const store=tx.objectStore('orders');
    let error='';
    const fail=message=>{error=message; tx.abort();};
    const req=store.get(original);
    req.onsuccess=()=>{
      if(input.version===0 && req.result) {
        fail('Já existe uma OS com esse número. Escolha outro número.'); return;
      }
      if((req.result?.version || 0)!==input.version || (original!==input.number && !req.result)) {
        fail('A OS mudou ou foi excluída. Atualize a fila antes de salvar.'); return;
      }
      if(original===input.number) {store.put(record(input)); return;}
      const target=store.get(input.number);
      target.onsuccess=()=>{
        if(target.result) {fail('Já existe uma OS com esse número. Escolha outro número.'); return;}
        store.delete(original); store.put(record(input));
      };
    };
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(Error(error || 'Falha ao salvar neste navegador.'));
    tx.onerror=()=>{};
  });
}
export async function localDelete(input) {
  const database=await db();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('orders','readwrite');
    const store=tx.objectStore('orders');
    let error='';
    const req=store.get(input.number);
    req.onsuccess=()=>{
      if(!req.result || req.result.version!==input.version) {
        error='A OS mudou ou foi excluída. Atualize a fila antes de excluir.'; tx.abort(); return;
      }
      store.delete(input.number);
    };
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(Error(error || 'Falha ao excluir neste navegador.'));
    tx.onerror=()=>{};
  });
}

export async function localRestore(inputs) {
  const database = await db();
  return new Promise((resolve,reject)=>{
    const tx = database.transaction('orders','readwrite');
    const store = tx.objectStore('orders');
    let error = '';
    for (const input of inputs) {
      const req = store.get(input.number);
      req.onsuccess = ()=>{
        error = validate(input) || ((req.result?.version || 0) !== input.version ? 'A fila mudou. Reabra o backup para revisar.' : '');
        if (error) { tx.abort(); return; }
        store.put(record(input));
      };
    }
    tx.oncomplete = ()=>resolve();
    tx.onabort = ()=>reject(Error(error || 'Falha ao restaurar o backup.'));
    tx.onerror = ()=>{};
  });
}

// ============================================================================
// Atendimento de Balcão — IndexedDB ('counter_tickets') com fallback seguro
// ============================================================================

function readCounterLocalFallback() {
  const store = getSafeLocalStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(counterFallbackStorageKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(normalizeCounterTicket) : [];
  } catch {
    return [];
  }
}

function writeCounterLocalFallback(list) {
  const store = getSafeLocalStorage();
  if (!store) return;
  try {
    store.setItem(counterFallbackStorageKey, JSON.stringify((list || []).map(normalizeCounterTicket)));
  } catch {}
}

export async function localListCounterTickets() {
  if (typeof indexedDB === 'undefined') return readCounterLocalFallback();
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const req = d.transaction('counter_tickets').objectStore('counter_tickets').getAll();
      req.onsuccess = () => resolve((req.result || []).map(normalizeCounterTicket));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readCounterLocalFallback();
  }
}

export async function localSaveCounterTicket(input) {
  const err = validateCounterTicket(input);
  if (err) throw Error(err);
  const next = recordCounterTicket(input);
  if (typeof indexedDB === 'undefined') {
    const list = readCounterLocalFallback().filter(t => t.id !== next.id);
    list.push(next);
    writeCounterLocalFallback(list);
    return next;
  }
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction('counter_tickets', 'readwrite');
    tx.objectStore('counter_tickets').put(next);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(Error('Falha ao salvar atendimento neste navegador.'));
    tx.onerror = () => {};
  });
  return next;
}

export async function localDeleteCounterTicket(idOrTicket) {
  const id = typeof idOrTicket === 'string' ? idOrTicket : String(idOrTicket?.id || '');
  if (!id) return;
  if (typeof indexedDB === 'undefined') {
    writeCounterLocalFallback(readCounterLocalFallback().filter(t => t.id !== id));
    return;
  }
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction('counter_tickets', 'readwrite');
    tx.objectStore('counter_tickets').delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(Error('Falha ao excluir atendimento neste navegador.'));
    tx.onerror = () => {};
  });
}

export async function localRestoreCounterTickets(inputs) {
  const list = Array.isArray(inputs) ? inputs : [];
  if (!list.length) return [];
  const saved = [];
  for (const item of list) {
    const err = validateCounterTicket(item);
    if (err) continue;
    saved.push(recordCounterTicket(item));
  }
  if (typeof indexedDB === 'undefined') {
    const map = new Map(readCounterLocalFallback().map(t => [t.id, t]));
    for (const item of saved) map.set(item.id, item);
    writeCounterLocalFallback(Array.from(map.values()));
    return saved;
  }
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction('counter_tickets', 'readwrite');
    const store = tx.objectStore('counter_tickets');
    for (const item of saved) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(Error('Falha ao restaurar atendimentos de balcão.'));
    tx.onerror = () => {};
  });
  return saved;
}
