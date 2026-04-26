exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ success:false, error:'Method not allowed' }) };
  try {
    const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL;
    const SHEETS_SECRET     = process.env.SHEETS_SECRET;
    if (!SHEETS_WEBAPP_URL) return { statusCode: 500, body: 'SHEETS_WEBAPP_URL missing' };
    if (!SHEETS_SECRET)     return { statusCode: 500, body: 'SHEETS_SECRET missing' };

    const p = JSON.parse(event.body || '{}');
    const order_group = String(p.order_group ?? p.orderId ?? p.og ?? '').trim();
    const ttn         = String(p.ttn ?? '').trim();
    const post_service= String(p.post_service ?? '').trim();
    const status      = p.status ? String(p.status).trim() : '';
    if (!order_group || !ttn) return { statusCode: 400, body: JSON.stringify({ success:false, error:'order_group/ttn required' }) };

    const body = JSON.stringify({ mode:'set-ttn', secret:SHEETS_SECRET, order_group, ttn, post_service, status });
    const r = await fetch(SHEETS_WEBAPP_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body });
    const text = await r.text(); let j; try { j = JSON.parse(text); } catch {}
    if (!r.ok)       return { statusCode: r.status, body: `GAS http ${r.status}: ${text}` };
    if (!j?.success) return { statusCode: 500, body: `GAS logic error: ${text}` };
    return { statusCode: 200, body: JSON.stringify({ success:true, row:j.row || null }) };
  } catch (e) { return { statusCode: 500, body: String(e) }; }
};
