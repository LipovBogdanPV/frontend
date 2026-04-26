// /netlify/functions/auth.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success:false, error:'Method not allowed' }) };
  }

  try {
    const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL || '';      // ← єдина змінна оточення
    if (!SHEETS_WEBAPP_URL) {
      return { statusCode: 500, body: JSON.stringify({ success:false, error:'SHEETS_WEBAPP_URL not set' }) };
    }

    const payload = event.body || '{}';

    const res = await fetch(SHEETS_WEBAPP_URL, {                        // проксування на GAS
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    const text = await res.text();

    if (!res.ok) {                                                      // віддати тіло помилки з GAS як є
      return { statusCode: res.status, body: text || JSON.stringify({ success:false, error:'GAS error' }) };
    }

    return { statusCode: 200, body: text };                             // успіх
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ success:false, error: String(err) }) };
  }
};
