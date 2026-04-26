// netlify/functions/set-status.js
//
// Приймає POST { order_group, status } і оновлює статус у GAS.
// Повертає завжди JSON виду { success: true } або { success:false, error: ... }.
//
// ВАЖЛИВО: у змінних середовища Netlify мають бути:
//   SHEETS_WEBAPP_URL = https://script.google.com/macros/s/XXXXX/exec
//   SHEETS_SECRET     = <твій секрет для GAS>
//
// У netlify.toml має бути редірект:
// [[redirects]]
//   from = "/api/orders/set-status"
//   to   = "/.netlify/functions/set-status"
//   status = 200
//   force = true

// На Netlify (Node 18+) fetch уже глобальний, node-fetch не потрібен.
// Якщо запускаєш локально на старому Node, можеш розкоментувати наступні 2 рядки:
// const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.handler = async (event) => {
  // CORS preflight — щоб браузер не блокував POST із фронта
  if (event.httpMethod === 'OPTIONS') {
    return json({}, 204);
  }

  if (event.httpMethod !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    // 1) Парс параметрів
    const { order_group, status } = JSON.parse(event.body || '{}');

    // Нормалізація: прибираємо ведучі нулі з order_group (AW)
    const ogRaw = String(order_group ?? '').trim();
    const og    = ogRaw.replace(/^0+/, '');
    const st    = String(status ?? '').trim();

    if (!og || !st) {
      return json({ success: false, error: 'order_group/status required' }, 400);
    }

    // 2) ENV-перевірка
    const url    = (process.env.SHEETS_WEBAPP_URL || '').trim();
    const secret = (process.env.SHEETS_SECRET || '').trim();

    if (!url)    return json({ success: false, error: 'SHEETS_WEBAPP_URL env not set' }, 500);
    if (!secret) return json({ success: false, error: 'SHEETS_SECRET env not set' }, 500);

    // 3) Виклик GAS
    // Узгодь на своєму GAS, щоб він приймав JSON POST:
    //   { action:'setStatus', orderId:'...', status:'...', secret:'...' }
    // і у відповідь повертав JSON { success:true }.
    const payload = {
      action:  'setStatus',
      orderId: og,
      status:  st,
      secret
    };

    // (необов’язково) таймаут, щоб не висіти вічно
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);

    let gasResp;
    try {
      gasResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(id);
    }

    // 4) Обережний парс відповіді GAS (вона може бути текстом)
    const text = await gasResp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // 5) Нормалізуємо відповідь для фронтенда
    // Якщо GAS повернув success:true — віддамо success:true.
    // Якщо ні — пояснюємо помилку.
    if (!gasResp.ok || data?.success === false) {
      return json({
        success: false,
        error: data?.error || data?.message || `GAS HTTP ${gasResp.status}`,
        gas: data
      }, 502);
    }

    // Все ок
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
};

/* ---------- утиліта відповіді з CORS ---------- */
function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}
