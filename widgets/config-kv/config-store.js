// frontend/js/config-store.js
// -----------------------------------------------------------------------------
// ДЛЯ ЧОГО ЦЕЙ ФАЙЛ
// Простий варіант роботи з конфігом БЕЗ Netlify-проксі: звертаємось напряму до
// GAS WebApp (один єдиний ключ потрібний на фронті — SHEETS_WEBAPP_URL).
// Підтримує дві операції:
//   - loadConfig():   GET  <SHEETS_WEBAPP_URL>?action=config → отримати мапу ключів
//   - updateConfig(): POST <SHEETS_WEBAPP_URL>?action=config → зберегти оновлення
// Формат відповіді з GAS може бути як { success:true, config:{...} }, так і просто {KEY:VALUE}.
// -----------------------------------------------------------------------------
// ВАЖЛИВО
// - На проді уникаємо preflight: для POST ставимо Content-Type: text/plain.
// - Якщо у DOM є інпут <input name="SHEETS_WEBAPP_URL"> — беремо звідти, інакше з window.APP_CONFIG.
// - У цьому проекті ми використовуємо ТІЛЬКИ SHEETS_WEBAPP_URL.
// -----------------------------------------------------------------------------

// Глобальний кеш — тримаємо лише один ключ (можеш додати інші, якщо знадобиться)
window.APP_CONFIG = window.APP_CONFIG || {
  SHEETS_WEBAPP_URL: ''                                                                 // https://script.google.com/macros/s/.../exec
};

// Безпечне визначення GAS URL: спершу з кешу, якщо порожній — з поля у формі
function resolveGasUrl() {                                                               // → повертає рядок або ''
  const fromCache = (window.APP_CONFIG && window.APP_CONFIG.SHEETS_WEBAPP_URL) || '';    // з кешу в пам'яті
  if (fromCache) return fromCache;                                                       // якщо є — ок
  const el = document.querySelector('input[name="SHEETS_WEBAPP_URL"]');                  // як запасний варіант — з інпуту на сторінці
  return el ? String(el.value || '') : '';                                               // або ''
}

/** GET конфіг із GAS → /exec?action=config */
export async function loadConfig() {
  const SHEETS_WEBAPP_URL = resolveGasUrl();                                             // визначаємо базу
  if (!SHEETS_WEBAPP_URL) {                                                              // якщо ще нічого не задано
    return { ...window.APP_CONFIG };                                                     // повертаємо поточний кеш
  }

  const res  = await fetch(`${SHEETS_WEBAPP_URL}?action=config`, { method: 'GET' });     // простий GET
  const text = await res.text();                                                         // читаємо як текст
  let data; try { data = JSON.parse(text); } catch { data = {}; }                        // намагаємось розпарсити

  // Підтримуємо обидва формати відповіді з GAS
  const cfg = (data && data.success) ? (data.config || {}) : (data.config || data || {}); // уніфікація формату
  // Тягнемо тільки те, що нам потрібно (у цьому проекті — один ключ)
  if (cfg && typeof cfg.SHEETS_WEBAPP_URL === 'string') {
    window.APP_CONFIG.SHEETS_WEBAPP_URL = cfg.SHEETS_WEBAPP_URL;                         // оновлюємо кеш
  }
  return { ...window.APP_CONFIG };                                                       // повертаємо актуальне
}

/** POST конфіг у GAS → /exec?action=config  (без preflight!) */
export async function updateConfig(updates = {}, pin = '') {
  // Важливо: шлемо ПРЯМО в GAS, заголовок text/plain → не буде preflight
  const targetGasUrl = String(updates.SHEETS_WEBAPP_URL || resolveGasUrl() || '').trim();// пріоритет новому значенню з форми
  if (!targetGasUrl) throw new Error('SHEETS_WEBAPP_URL порожній');                      // без URL не працюємо

  // Відправляємо тільки ті ключі, які реально використовуємо (тут — один)
  const body = JSON.stringify({
    pin,                                                                                 // якщо бекенд вимагає PIN — передаємо
    updates: { SHEETS_WEBAPP_URL: String(updates.SHEETS_WEBAPP_URL || '').trim() }       // мінімізуємо пайлоад
  });

  const res  = await fetch(`${targetGasUrl}?action=config`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },                             // уникаємо preflight
    body,
    mode: 'cors',
    credentials: 'omit'
  });

  const text = await res.text();                                                         // читаємо відповідь
  let data; try { data = JSON.parse(text); } catch { data = {}; }                        // парсимо JSON якщо є

  if (!res.ok || data?.success === false) {                                              // перевірка помилок
    throw new Error(data?.error || `HTTP ${res.status}`);                                 // кидаємо зрозумілу помилку
  }

  // Якщо бекенд повернув нову конфіг-мапу — підхоплюємо лише потрібне
  const cfg = data.config || updates || {};
  if (cfg && typeof cfg.SHEETS_WEBAPP_URL === 'string') {
    window.APP_CONFIG.SHEETS_WEBAPP_URL = cfg.SHEETS_WEBAPP_URL;                         // оновлюємо кеш
  }
  return data;                                                                           // повертаємо сирий бекенд-відповідь (може згодитись)
}
