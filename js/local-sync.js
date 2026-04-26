import { sendOrder } from '../widgets/nova-poshta/js/api.js';

const DB_NAME = 'shifttime_local_sync';
const DB_VERSION = 1;
const META_STORE = 'meta';
const ORDERS_STORE = 'orders_queue';

const CATALOG_META_KEY = 'catalog_prices_v1';

const CATALOG_SYNC_MS = 5 * 60 * 1000;
const ORDER_SYNC_MS = 15 * 1000;

let dbPromise = null;
let fetchPatched = false;
let intervalsStarted = false;
let catalogSyncInProgress = false;
let orderSyncInProgress = false;

const state = {
  catalogSyncing: false,
  ordersSyncing: false,
  pendingOrders: 0,
  lastCatalogSyncAt: 0,
  lastOrdersSyncAt: 0,
  lastOrderSuccessAt: 0,
  lastError: '',
};

function emitState() {
  window.dispatchEvent(new CustomEvent('local-sync:state', { detail: { ...state } }));
  renderHeaderStatus();
}

function setState(patch) {
  Object.assign(state, patch || {});
  emitState();
}

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        const queue = db.createObjectStore(ORDERS_STORE, { keyPath: 'id', autoIncrement: true });
        queue.createIndex('status', 'status', { unique: false });
        queue.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });

  return dbPromise;
}

async function idbGet(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
  });
}

async function idbPut(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB put failed'));
  });
}

async function idbAdd(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB add failed'));
  });
}

async function idbDelete(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error('IndexedDB delete failed'));
  });
}

async function idbGetAllByStatus(status) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDERS_STORE, 'readonly');
    const store = tx.objectStore(ORDERS_STORE);
    const idx = store.index('status');
    const req = idx.getAll(status);
    req.onsuccess = () => {
      const list = Array.isArray(req.result) ? req.result : [];
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB getAll failed'));
  });
}

async function getCatalogSnapshot() {
  const rec = await idbGet(META_STORE, CATALOG_META_KEY);
  return rec?.value || null;
}

async function saveCatalogSnapshot(payload) {
  await idbPut(META_STORE, {
    key: CATALOG_META_KEY,
    value: {
      data: payload,
      updatedAt: Date.now(),
    },
  });
}

function getSheetsBase() {
  const cfg = window._CONFIG || {};
  return String(cfg.SHEETS_WEBAPP_URL || window.SHEETS_WEBAPP_URL || '').replace(/\/+$/, '');
}

function makePricesUrl() {
  const base = getSheetsBase();
  if (!base) return '';
  return `${base}?mode=prices&_=${Date.now()}`;
}

function isPricesRequest(url, method) {
  if (String(method || 'GET').toUpperCase() !== 'GET') return false;
  try {
    const u = new URL(url, location.origin);
    return u.searchParams.get('mode') === 'prices';
  } catch {
    return false;
  }
}

function jsonResponse(obj) {
  return new Response(JSON.stringify(obj || {}), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function fetchRemoteCatalog() {
  const url = makePricesUrl();
  if (!url) throw new Error('SHEETS_WEBAPP_URL не задано для синхронізації каталогу');

  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(txt);
}

export async function syncCatalogNow({ silent = false } = {}) {
  if (catalogSyncInProgress) return false;
  catalogSyncInProgress = true;

  if (!silent) setState({ catalogSyncing: true, lastError: '' });

  try {
    const remote = await fetchRemoteCatalog();
    await saveCatalogSnapshot(remote);
    setState({ lastCatalogSyncAt: Date.now(), lastError: '' });
    return true;
  } catch (e) {
    if (!silent) {
      setState({ lastError: String(e?.message || e || 'Помилка синхронізації каталогу') });
    }
    return false;
  } finally {
    catalogSyncInProgress = false;
    if (!silent) setState({ catalogSyncing: false });
  }
}

async function countPendingOrders() {
  const pending = await idbGetAllByStatus('pending');
  return pending.length;
}

async function refreshPendingOrders() {
  const pending = await countPendingOrders();
  setState({ pendingOrders: pending });
  return pending;
}

export async function enqueueOrderForSync(payload) {
  const id = await idbAdd(ORDERS_STORE, {
    payload,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
    lastError: '',
  });

  await refreshPendingOrders();
  void flushOrderQueueNow();

  return {
    success: true,
    queued: true,
    localQueueId: id,
  };
}

export async function flushOrderQueueNow() {
  if (orderSyncInProgress) return false;
  orderSyncInProgress = true;
  setState({ ordersSyncing: true, lastError: '' });

  try {
    const pending = await idbGetAllByStatus('pending');
    if (!pending.length) {
      setState({ lastOrdersSyncAt: Date.now() });
      return true;
    }

    for (const item of pending) {
      try {
        await sendOrder(item.payload);
        await idbDelete(ORDERS_STORE, item.id);
        setState({ lastOrderSuccessAt: Date.now(), lastError: '' });
      } catch (e) {
        await idbPut(ORDERS_STORE, {
          ...item,
          attempts: Number(item.attempts || 0) + 1,
          lastError: String(e?.message || e || 'Помилка відправки'),
          lastAttemptAt: Date.now(),
          status: 'pending',
        });

        setState({ lastError: String(e?.message || e || 'Помилка відправки замовлення') });
        break;
      }
    }

    await refreshPendingOrders();
    setState({ lastOrdersSyncAt: Date.now() });
    return true;
  } finally {
    orderSyncInProgress = false;
    setState({ ordersSyncing: false });
  }
}

function renderHeaderStatus() {
  const statusEl = document.getElementById('global-sync-status');
  const queueEl = document.getElementById('global-queue-badge');
  const lastOrderSyncEl = document.getElementById('global-last-order-sync');
  const syncBtn = document.getElementById('global-sync-now');
  if (!statusEl) return;

  let text = 'Синхронізація: готово';

  if (state.catalogSyncing && state.ordersSyncing) {
    text = 'Синхронізація: каталог і замовлення...';
  } else if (state.catalogSyncing) {
    text = 'Синхронізація каталогу...';
  } else if (state.ordersSyncing) {
    text = `Синхронізація замовлень (${state.pendingOrders})...`;
  } else if (state.pendingOrders > 0) {
    text = `Черга замовлень: ${state.pendingOrders}`;
  } else if (state.lastError) {
    text = 'Синхронізація: є помилка, триває повтор';
  } else if (state.lastCatalogSyncAt) {
    const dt = new Date(state.lastCatalogSyncAt);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    text = `Синхронізація: оновлено ${hh}:${mm}`;
  }

  statusEl.textContent = text;

  if (queueEl) {
    queueEl.textContent = `Черга: ${state.pendingOrders}`;
    queueEl.classList.toggle('bg-amber-200', state.pendingOrders > 0);
    queueEl.classList.toggle('text-amber-900', state.pendingOrders > 0);
    queueEl.classList.toggle('border-amber-300', state.pendingOrders > 0);
    queueEl.classList.toggle('bg-emerald-200', state.pendingOrders === 0);
    queueEl.classList.toggle('text-emerald-900', state.pendingOrders === 0);
    queueEl.classList.toggle('border-emerald-300', state.pendingOrders === 0);
  }

  if (lastOrderSyncEl) {
    if (state.lastOrderSuccessAt) {
      const dt = new Date(state.lastOrderSuccessAt);
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      const ss = String(dt.getSeconds()).padStart(2, '0');
      lastOrderSyncEl.textContent = `Відправка: ${hh}:${mm}:${ss}`;
    } else {
      lastOrderSyncEl.textContent = 'Відправка: --:--';
    }
  }

  if (syncBtn && !syncBtn.dataset.bound) {
    syncBtn.dataset.bound = '1';
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      try {
        setState({ catalogSyncing: true, ordersSyncing: true, lastError: '' });
        await syncCatalogNow();
        await flushOrderQueueNow();
      } finally {
        syncBtn.disabled = false;
      }
    });
  }
}

function patchFetchForCatalogCache() {
  if (fetchPatched) return;
  fetchPatched = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const reqUrl = typeof input === 'string' ? input : input?.url;
    const method = init?.method || (typeof input !== 'string' && input?.method) || 'GET';

    if (!isPricesRequest(reqUrl, method)) {
      return origFetch(input, init);
    }

    try {
      const snap = await getCatalogSnapshot();
      if (snap?.data) {
        void syncCatalogNow({ silent: true });
        return jsonResponse(snap.data);
      }
    } catch {}

    const res = await origFetch(input, init);

    try {
      const txt = await res.clone().text();
      const parsed = JSON.parse(txt);
      await saveCatalogSnapshot(parsed);
      setState({ lastCatalogSyncAt: Date.now(), lastError: '' });
    } catch {}

    return res;
  };
}

function bindOnHeaderLoaded() {
  const handler = () => renderHeaderStatus();
  document.addEventListener('component:header:loaded', handler);
  window.addEventListener('component:header:loaded', handler);
}

export async function initLocalSync() {
  await openDb();
  patchFetchForCatalogCache();
  bindOnHeaderLoaded();
  await refreshPendingOrders();
  renderHeaderStatus();

  if (!intervalsStarted) {
    intervalsStarted = true;
    window.setInterval(() => {
      void syncCatalogNow({ silent: true });
    }, CATALOG_SYNC_MS);

    window.setInterval(() => {
      void flushOrderQueueNow();
    }, ORDER_SYNC_MS);

    void syncCatalogNow({ silent: true });
    void flushOrderQueueNow();
  }

  return true;
}

export function ensureOrderSyncStarted() {
  void initLocalSync();
}
