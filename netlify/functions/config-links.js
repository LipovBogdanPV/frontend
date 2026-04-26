// frontend/netlify/functions/config-links.js
// Проксі до твого GAS WebApp. Використовуємо ТІЛЬКИ env SHEETS_WEBAPP_URL.

export const handler = async (event) => {
  try {
    const base = (process.env.SHEETS_WEBAPP_URL || '').trim(); // ← єдина змінна
    if (!base) {
      return json(500, { success: false, error: 'SHEETS_WEBAPP_URL is not set' });
    }

    // прокидуємо всі query-параметри (res, mode тощо)
    const qs = new URLSearchParams(event.queryStringParameters || {});
    const target = base + (base.includes('?') ? '&' : '?') + qs.toString();

    // опційний дебаг: /.netlify/functions/config-links?debug=1&res=kv&mode=list
    if (qs.get('debug') === '1') {
      return json(200, { success: true, debug: { base, target, method: event.httpMethod } });
    }

    // прозорий проксі
    const r = await fetch(target, {
      method: event.httpMethod === 'POST' ? 'POST' : 'GET',
      headers: { accept: 'application/json' },
      body: event.httpMethod === 'POST' ? event.body : undefined,
    });

    const text = await r.text();
    return {
      statusCode: r.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: text,
    };
  } catch (e) {
    return json(500, { success: false, error: String(e) });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}
