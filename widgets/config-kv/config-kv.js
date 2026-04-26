// frontend/widgets/config-kv/config-kv.js
// Централізоване завантаження CONFIG на фронті з LocalStorage-кешем.
// Контракт відповіді (і від /api/config/kv, і від GAS):
//   { success: true, items: [ { key, value, value1, value2 }, ... ] }

export const CONFIG_STATE = window.CONFIG_STATE || { ready: false, map: {} };

/** Отримати значення з конфіга */
export function getConfigValue(key, def = undefined) {
  return (CONFIG_STATE.map && key in CONFIG_STATE.map) ? CONFIG_STATE.map[key]
       : (window.AppConfig && key in window.AppConfig) ? window.AppConfig[key]
       : def;
}

/** Дочекатись готовності (Promise) */
export function whenConfigReady() {
  if (CONFIG_STATE.ready) return Promise.resolve(CONFIG_STATE.map);
  return new Promise(res =>
    document.addEventListener('app-config-ready', () => res(CONFIG_STATE.map), { once: true })
  );
}

/* ---------- cache ---------- */
const LS_CACHE_KEY = 'APP_CONFIG_CACHE';
const LS_CACHE_TTL = 5 * 60 * 1000; // 5 хв

function saveToCache(map) {
  try { localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ t: Date.now(), map })); } catch {}
}
function readFromCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.t || !obj.map) return null;
    if (Date.now() - obj.t > LS_CACHE_TTL) return null;
    return obj.map;
  } catch { return null; }
}

/* ---------- helpers ---------- */
function toMap(anyJson) {
  if (!anyJson) return {};
  if (Array.isArray(anyJson)) {
    const m = {};
    for (const r of anyJson) {
      if (!r) continue;
      const k = r.key ?? r.Key ?? r.KEY;
      const v = r.value ?? r.Value ?? r.VALUE;
      if (k != null) m[String(k).trim()] = v != null ? String(v) : '';
    }
    return m;
  }
  if (typeof anyJson === 'object') return { ...anyJson };
  return {};
}

// --- ДОДАНО: безпечний фетч JSON (щоб не падати на HTML-404) ---
async function fetchJsonSafe(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok || !ct.includes('application/json')) {
    const text = await r.text().catch(()=> '');
    throw new Error(`HTTP ${r.status} ${text.slice(0, 80)}`);
  }
  const j = await r.json();
  if (j && j.success === false) throw new Error(j.error || 'Error');
  return j;
}

// ЗАЛИШЕНО (не видаляю): твій попередній фетчер
async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!j)   throw new Error('Not JSON');
  if (j.success === false) throw new Error(j.error || 'Error');
  return j;
}

/* ---------- main ---------- */
export async function initConfig() {
  if (CONFIG_STATE.ready && Object.keys(CONFIG_STATE.map).length) return CONFIG_STATE.map;

  // 1) спроба з кешу
  const cached = readFromCache();
  if (cached) {
    CONFIG_STATE.map = cached;
    CONFIG_STATE.ready = true;
    window.AppConfig = cached;
    mirrorGlobals(cached); // ← ДОДАНО: прокинемо ключі у window
    document.dispatchEvent(new Event('app-config-ready'));
    return cached;
  }

  // --- ДОДАНО: визначення середовища для зручних фолбеків ---
  const isLocalHttp = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const hasFrontend = /\/frontend(\/|$)/.test(location.pathname);
  const ROOT_PREFIX = (location.protocol === 'file:' || /\/pages(\/|$)/.test(location.pathname))
    ? '..' : (hasFrontend ? '/frontend' : '');

  let map = {};

  // 2) пробуємо через сайт: /api/config/kv (Netlify proxy → GAS)
  try {
    const u = new URL('/api/config/kv', location.origin);
    u.searchParams.set('res', 'kv');
    u.searchParams.set('mode', 'list');
    u.searchParams.set('ts', Date.now());
    // заміна на безпечний парсер, але залишаю твою функцію вище без видалення
    const j = await fetchJsonSafe(u.toString());
    map = toMap(j.items ?? j);
  } catch {
    // 3) прямий запит у GAS за єдиною змінною SHEETS_WEBAPP_URL
    try {
      const base = String(window.SHEETS_WEBAPP_URL || '').replace(/\/+$/, '');
      if (!base) throw new Error('SHEETS_WEBAPP_URL not set');
      const j = await fetchJsonSafe(`${base}?res=kv&mode=list&ts=${Date.now()}`);
      map = toMap(j.items ?? j);
    } catch (e) {
      console.error('[CONFIG] load failed:', e?.message || e);
      map = {};
    }
  }

  // --- ДОДАНО: якщо досі порожньо — спробуємо нетліфай-функцію прямо ---
  if (!Object.keys(map).length) {
    try {
      const fnBase = isLocalHttp
        ? 'http://localhost:8888/.netlify/functions/config-links'
        : '/.netlify/functions/config-links';
      const data = await fetchJsonSafe(fnBase + '?ts=' + Date.now());
      map = toMap(data);
    } catch (e) {
      console.warn('[CONFIG] Netlify function failed:', e.message || e);
    }
  }

  // --- ДОДАНО: останній фолбек — локальний статичний конфіг ---
  if (!Object.keys(map).length) {
    try {
      const data = await fetchJsonSafe(`${ROOT_PREFIX}/config/app-config.json?ts=${Date.now()}`);
      map = toMap(data);
    } catch (e) {
      console.warn('[CONFIG] local app-config.json failed:', e.message || e);
    }
  }

  CONFIG_STATE.map = map;
  CONFIG_STATE.ready = true;
  window.AppConfig = map;

  // --- ДОДАНО: прокинемо важливі значення у window (щоб віджет міг ними користуватись) ---
  mirrorGlobals(map);

  saveToCache(map);
  document.dispatchEvent(new Event('app-config-ready'));
  return map;
}

// --- ДОДАНО: акуратне дзеркалювання в window, НЕ видаляє нічого з твого коду ---
export function mirrorGlobals(map) {
  if (!map || typeof window === 'undefined') return;

  // існуючі/популярні ключі
  if (map.SHEETS_WEBAPP_URL) window.SHEETS_WEBAPP_URL = map.SHEETS_WEBAPP_URL;
  if (map.RENDER_BASE)       window.RENDER_BASE       = map.RENDER_BASE;
  if (map.WRITE_BASE)        window.WRITE_BASE        = map.WRITE_BASE;
  if (map.WRITE_DIRECT != null) window.WRITE_DIRECT   = String(map.WRITE_DIRECT);

  // телеграм-аліаси (залишаю як у тебе)
  if (map.DEFAULT_TG_CHAT_ID) window.DEFAULT_TG_CHAT_ID = map.DEFAULT_TG_CHAT_ID;
  if (map.TG_CHAT_ID_DEFAULT) window.DEFAULT_TG_CHAT_ID = map.TG_CHAT_ID_DEFAULT;
  if (map.TELEGRAM_CHAT_ID)   window.DEFAULT_TG_CHAT_ID = map.TELEGRAM_CHAT_ID;

  // НОВЕ: FINANCE_API та дефолти для дев/прод (якщо в конфізі немає)
  const isLocalHttp = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  if (!window.FINANCE_API) {
    window.FINANCE_API = map.FINANCE_API
      || (isLocalHttp
          ? 'http://localhost:8888/.netlify/functions/finance' // netlify dev
          : '/.netlify/functions/finance');                    // прод/прев’ю
  }
}
