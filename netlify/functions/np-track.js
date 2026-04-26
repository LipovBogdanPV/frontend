// frontend/netlify/functions/np-track.js
// Трекінг ТТН через API Нової Пошти.
// КЛЮЧ тягнемо з Google Sheets через ваш GAS-вебапп (mode=secret),
// захищено токеном. Є кешування в пам'яті функції на 10 хв.

// ─────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// URL вашого GAS-вебаппа (той самий, що ви вже використовуєте у фронті для orders)
const GAS_BASE = process.env.SHEETS_WEBAPP_URL || ''; // ← ДОДАЙТЕ В Netlify Environment

// Токен, який ви записали у GAS Script Properties як GAS_SECRET_TOKEN
const GAS_SECRET_TOKEN = process.env.GAS_SECRET_TOKEN || ''; // ← ДОДАЙТЕ В Netlify Environment

// Назва секрету в аркуші Secrets!A:B
const SECRET_NAME_NP = 'NP_API_KEY';

// Кеш ключа в пам'яті (щоб не дергати GAS кожен раз)
let _cachedKey = null;
let _cachedAt  = 0;
const KEY_TTL_MS = 10 * 60 * 1000; // 10 хв

async function getNpKey() {
  // 1) Фолбек: якщо хтось все ж поклав ключ напряму в ENV — використаємо його
  if (process.env.NP_API_KEY) return process.env.NP_API_KEY;

  // 2) Якщо в кеші ще свіжий — вертаємо
  const now = Date.now();
  if (_cachedKey && (now - _cachedAt) < KEY_TTL_MS) return _cachedKey;

  // 3) Тягнемо з GAS (mode=secret)
  if (!GAS_BASE) throw new Error('SHEETS_WEBAPP_URL missing');
  if (!GAS_SECRET_TOKEN) throw new Error('GAS_SECRET_TOKEN missing');

  const url = `${GAS_BASE}?mode=secret&name=${encodeURIComponent(SECRET_NAME_NP)}&token=${encodeURIComponent(GAS_SECRET_TOKEN)}`;
  const r   = await fetch(url, { method: 'GET' });
  const j   = await r.json();

  if (!j?.success || !j?.value) {
    throw new Error('NP key not found in Google Sheet');
  }

  _cachedKey = String(j.value);
  _cachedAt  = now;
  return _cachedKey;
}

// ─────────────────────────────────────────────

// netlify/functions/np-track.js
export async function handler(event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const gasUrl = process.env.SHEETS_WEBAPP_URL
      || (globalThis.SHEETS_WEBAPP_URL)  // на випадок локального тесту
      || '<<PUT_YOUR_GAS_URL_HERE>>';

    const payload = {
      mode: 'np_track',
      ttn: body.ttn || '',
      orderGroup: body.orderGroup || '',
      phone: body.phone || '',
      clientName: body.clientName || '',
      secret: process.env.SHEETS_SECRET || 'super-secret-123'
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: String(err) })
    };
  }
}

