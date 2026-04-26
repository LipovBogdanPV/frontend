// frontend/netlify/functions/orders-list.js
// Проксі до GAS: повертає список замовлень (mode=orders)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS };
    }

    const envUrl = process.env.SHEETS_WEBAPP_URL || '';
    const q = event.queryStringParameters || {};
    const gas = (q.gas && q.gas.trim()) || envUrl;

    if (!gas) {
      return { statusCode: 500, headers: CORS,
        body: JSON.stringify({ success:false, error:'SHEETS_WEBAPP_URL не задано' }) };
    }

    const target = `${gas}${gas.includes('?') ? '&' : '?'}mode=orders`;
    const r = await fetch(target, { method: 'GET' });
    const text = await r.text();

    // діагностика, щоб ніколи не зловити Unexpected '<'
    if (!r.ok) {
      return { statusCode: r.status, headers: CORS,
        body: JSON.stringify({ success:false, error:`GAS HTTP ${r.status}`, head:text.slice(0,300) }) };
    }
    if (text.trim().startsWith('<')) {
      return { statusCode: 502, headers: CORS,
        body: JSON.stringify({ success:false, error:'GAS повернув HTML замість JSON', head:text.slice(0,300) }) };
    }

    // нормальний JSON
    return { statusCode: 200, headers: CORS, body: text };
  } catch (err) {
    return { statusCode: 500, headers: CORS,
      body: JSON.stringify({ success:false, error:String(err) }) };
  }
}
