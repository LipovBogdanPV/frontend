// netlify/functions/config.js
// Проксі до GAS для читання/запису конфіга через Netlify Functions.
// Використовуємо env `SHEETS_WEBAPP_URL` (або `SHEETS_WEBAPP_URL`, якщо теж заданий).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handler(event) {
  try {
    // 1) Джерело GAS-URL: ?gas=... має пріоритет, потім env-перемінні
    const q = event.queryStringParameters || {};
    const envUrl = process.env.SHEETS_WEBAPP_URL || process.env.SHEETS_WEBAPP_URL || '';
    const gasUrl = (q.gas && q.gas.trim()) || envUrl;

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_HEADERS };
    }

    if (!gasUrl) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: 'SHEETS_WEBAPP_URL (або SHEETS_WEBAPP_URL) не задано' }),
      };
    }

    const target = `${gasUrl}?action=config`;

    // 2) Роутинг методів
    if (event.httpMethod === 'GET') {
      const r = await fetch(target, { method: 'GET' });
      const text = await r.text();
      // GAS інколи повертає text/plain — спробуємо розпарсити як JSON
      try {
        const json = JSON.parse(text);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(json) };
      } catch {
        return { statusCode: 200, headers: CORS_HEADERS, body: text };
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      // Ми вже на сервері — CORS тут не впливає, тож можна 'application/json'
      const r = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        return { statusCode: r.ok ? 200 : 500, headers: CORS_HEADERS, body: JSON.stringify(json) };
      } catch {
        return { statusCode: r.ok ? 200 : 500, headers: CORS_HEADERS, body: text };
      }
    }

    // Інші методи не підтримуємо
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'METHOD_NOT_ALLOWED' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: String(err) }),
    };
  }
}
