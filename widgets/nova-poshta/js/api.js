// frontend/js/api.js
// ✅ Єдиний API з CONFIG, вибір ендпоінта за ENV, фолбек на GAS, дебаг-утиліти.

;(function () {
  // ---------- Cache ----------
  let _cfgPromise = null;

  // ---------- Helpers ----------
  const trimSlash = (s) => String(s || '').replace(/\/+$/, '');
  const isGasUrl  = (u) => /script\.google\.com\/macros\/s\//i.test(String(u || ''));
  const nowTs     = () => Date.now();

  // ==== ENV detection & guards ==============================================
  // Тестові та прод-хости
  const TEST_HOSTS = ['localhost', '127.0.0.1', 'shifttime-crm-test.netlify.app', 'lipovbogdanpv.github.io'];
  const PROD_HOSTS = ['crm.shifttime.com.ua'];

  const isTestHost = () => TEST_HOSTS.some(h => location.hostname.includes(h));
  const isProdHost = () => PROD_HOSTS.some(h => location.hostname.includes(h));

  // Зберігаємо ENV у localStorage('ENV'); якщо порожньо — визначаємо за доменом
  let ENV = (localStorage.getItem('ENV') || '').toLowerCase();
  if (!ENV) ENV = isTestHost() ? 'test' : 'prod';

  // НІКОЛИ не тримати 'prod' на тестовому хості
  if (ENV === 'prod' && isTestHost()) {
    console.warn('[ENV] PROD на тестовому хості — автоперемикаю на TEST');
    ENV = 'test';
    localStorage.setItem('ENV', ENV);
  }

  // Публічні геттери/сеттери (будуть доступні через window.API.env)
  function _getEnv() { return ENV; }
  function _setEnv(v) {
    ENV = String(v || '').toLowerCase();
    localStorage.setItem('ENV', ENV);
    return ENV;
  }

  // М’яка перевірка перед записами: без throw — автоматично виправляємо ENV
  function _assertEnv(kind) {
    if (kind !== 'write') return;
    if (ENV === 'prod' && isTestHost()) {
      console.warn('[WRITE] PROD заборонено на тест-хості — перемикаю на TEST автоматично');
      _setEnv('test');
    }
  }

  // Сумісний шар (раніше тут було жорстке блокування). Тепер — no-throw.
  function assertByEnv(/* url */) {
    _assertEnv('write');
    return true;
  }

  // Для сумісності з твоєю попередньою системою псевдо-аліасів
  function getEnvAliasSync() {
    const e = _getEnv();
    if (e === 'test') return 'TEST';
    if (e === 'dev')  return 'DEV';
    return 'PROD';
  }

  // ---------- CONFIG loader ----------
  async function ensureConfig() {
    if (window._CONFIG) return window._CONFIG;
    if (_cfgPromise) return _cfgPromise;

    async function fetchCfg(url) {
      const r = await fetch(url, { cache: 'no-cache' });
      const text = await r.text();
      let json; try { json = JSON.parse(text); } catch { /* text */ }
      // normalize -> plain {KEY:VALUE}
      if (Array.isArray(json)) {
        return json.reduce((a, it) => {
          if (it?.key != null) a[String(it.key)] = String(it.value ?? '');
          return a;
        }, {});
      }
      if (json && Array.isArray(json.items)) {
        return json.items.reduce((a, it) => {
          if (it?.key != null) a[String(it.key)] = String(it.value ?? '');
          return a;
        }, {});
      }
      return json || {};
    }

    _cfgPromise = (async () => {
      // 1) Netlify proxy
      try {
        return await fetchCfg(`/api/config/kv?res=kv&mode=list&ts=${nowTs()}`);
      } catch {}
      // 2) Alternative proxy
      try {
        return await fetchCfg(`/api/config/links?mode=list&ts=${nowTs()}`);
      } catch {}
      // 3) Direct GAS
      const base = trimSlash(window.SHEETS_WEBAPP_URL || '');
      if (!base) return {};
      return await fetchCfg(`${base}?res=kv&mode=list&ts=${nowTs()}`);
    })().then((obj) => {
      window._CONFIG = obj || {};
      // прокинемо найважливіше у window для сумісності
      if (obj.SHEETS_WEBAPP_URL) window.SHEETS_WEBAPP_URL = obj.SHEETS_WEBAPP_URL;
      if (obj.RENDER_BASE)        window.RENDER_BASE        = obj.RENDER_BASE;
      if (obj.WRITE_BASE)         window.WRITE_BASE         = obj.WRITE_BASE;
      if (obj.WRITE_DIRECT != null) window.WRITE_DIRECT     = String(obj.WRITE_DIRECT);
      return window._CONFIG;
    });

    return _cfgPromise;
  }

  // ---------- Endpoint selection ----------
  function pickWriteEndpoint() {
    const cfg = (window._CONFIG || {});
    const writeBase   = String(cfg.WRITE_BASE          || window.WRITE_BASE          || '').trim();
    const sheetsBase  = String(cfg.SHEETS_WEBAPP_URL   || window.SHEETS_WEBAPP_URL   || '').trim();
    const renderBase  = String(cfg.RENDER_BASE         || window.RENDER_BASE         || '').trim();
    const writeDirect = String(cfg.WRITE_DIRECT || window.WRITE_DIRECT || '') === '1';

    if (writeBase)                 { assertByEnv(writeBase);   return trimSlash(writeBase); }
    if (writeDirect && sheetsBase) { assertByEnv(sheetsBase);  return trimSlash(sheetsBase); }
    if (renderBase)                { assertByEnv(renderBase);  return trimSlash(renderBase); }
    if (sheetsBase)                { assertByEnv(sheetsBase);  return trimSlash(sheetsBase); }

    throw new Error('[WRITE] Не знайдено RENDER_BASE/WRITE_BASE/SHEETS_WEBAPP_URL');
  }

  async function postJson(url, data) {
    const isGas = /script\.google\.com\/macros\/s\//i.test(String(url || ''));

    const headers = isGas
      // ✅ для GAS уникаємо preflight
      ? { 'Content-Type': 'text/plain;charset=UTF-8' }
      // для бекенда лишаємо JSON
      : { 'Content-Type': 'application/json;charset=UTF-8' };

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data || {}),
    });

    const text = await r.text();
    try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
    catch { return { ok: r.ok, status: r.status, data: null, text }; }
  }

  // ---------- Public API ----------
  async function sendFullForm(data) {
    await ensureConfig();

    const endpoint = pickWriteEndpoint();
    const useGas   = isGasUrl(endpoint);

    console.log('[WRITE] using endpoint:', endpoint, {
      ENV: getEnvAliasSync(),
      WRITE_BASE: window._CONFIG?.WRITE_BASE || window.WRITE_BASE || null,
      RENDER_BASE: window._CONFIG?.RENDER_BASE || window.RENDER_BASE || null,
      SHEETS_WEBAPP_URL: window._CONFIG?.SHEETS_WEBAPP_URL || window.SHEETS_WEBAPP_URL || null,
      WRITE_DIRECT: window._CONFIG?.WRITE_DIRECT || window.WRITE_DIRECT || null,
      isGas: useGas,
    });

    // 1) Основний шлях
    const url = useGas ? endpoint : `${endpoint.replace(/\/+$/,'')}/send`;
    let res = await postJson(url, data);

    // 2) Фолбек на GAS, якщо бекенд упав (502/5xx/не JSON/!ok)
    if (!useGas && (!res.ok || !res.data)) {
      const gas = trimSlash(window._CONFIG?.SHEETS_WEBAPP_URL || window.SHEETS_WEBAPP_URL || '');
      if (gas) {
        console.warn('[WRITE] backend failed (status', res.status, ') → fallback to GAS:', gas);
        res = await postJson(gas, data);
      }
    }

    if (!res.ok || (res.data && res.data.success === false)) {
      const msg = res.data?.error || res.text || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.data ?? { success: true };
  }

  async function sendQuickNumber(data) {
    return sendFullForm(data);
  }

  // ---------- Debug helpers ----------
  async function printConfig() {
    await ensureConfig();
    const env = getEnvAliasSync();
    const snap = {};
    for (const k of ['SHEETS_WEBAPP_URL','RENDER_BASE','WRITE_BASE','WRITE_DIRECT','ENV','CFG_ENV','APP_ENV']) {
      snap[k] = window._CONFIG?.[k] ?? null;
    }
    console.group('%cCONFIG snapshot','color:#06f;font-weight:600');
    console.log('ENV alias:', env, '| raw ENV:', _getEnv(), '| host:', location.hostname);
    console.table(snap);
    console.groupEnd();
    return { env, snap };
  }

  // ==== Expose to window ====================================================
  window.ensureConfig = ensureConfig;
  window.API = {
    ensureConfig,
    sendFullForm,
    sendQuickNumber,
    debug: { printConfig, getEnvAlias: getEnvAliasSync },
    env: { getEnv: _getEnv, setEnv: _setEnv, assertEnv: _assertEnv, isTestHost, isProdHost }
  };

})(); // Кінець IIFE

// ===== Named exports for ESM imports =======================================
// (Використовують window.API під капотом — нічого не ламаємо)
export function sendFullForm(data){ return window.API.sendFullForm(data); }
export function sendQuickNumber(data){ return window.API.sendQuickNumber(data); }
export { sendFullForm as sendOrder };

// Експорти для роботи з ENV (опційно)
export function getEnv(){ return window.API.env.getEnv(); }
export function setEnv(v){ return window.API.env.setEnv(v); }
export function assertEnv(kind){ return window.API.env.assertEnv(kind); }
