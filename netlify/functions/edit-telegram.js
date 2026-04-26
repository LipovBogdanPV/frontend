// /.netlify/functions/edit-telegram.js
const KV_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 год
let KV = null, kvFetchedAt = 0;

const ensureFetch = async () => {
  if (typeof fetch === 'function') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
};

async function loadKV(force = false) {
  const base =
    process.env.SHEETS_WEBAPP_URL ||
    process.env.SHIFTTIME_SHEETS_URL || '';

  if (!base) { KV = {}; return KV; }

  const fresh = Date.now() - kvFetchedAt < KV_CACHE_TTL;
  if (!force && KV && fresh) return KV;

  try {
    const f = await ensureFetch();
    const url = `${base.replace(/\/+$/, '')}?mode=kv`;
    const r = await f(url);
    const json = await r.json().catch(() => ({}));
    const items = Array.isArray(json.items) ? json.items : [];
    KV = Object.fromEntries(items.map(it => [
      String(it.key || '').trim(),
      String((it.value ?? '').toString().trim())
    ]));
    kvFetchedAt = Date.now();
  } catch {
    KV = {};
  }
  return KV;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:'Method not allowed' }) };
  }

  try {
    const f = await ensureFetch();
    const p = JSON.parse(event.body || '{}');
    const force =
      p.forceRefresh === true ||
      p.forceRefresh === '1' ||
      (event.queryStringParameters && event.queryStringParameters.force === '1');

    await loadKV(!!force);

    const BOT_TOKEN = (
      KV.TELEGRAM_BOT_TOKEN || KV.TG_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || ''
    ).trim();

    if (!BOT_TOKEN) {
      return { statusCode:500, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:'Telegram bot token is missing' }) };
    }

    const chat_id   = (p.chatId || '').toString().trim();
    const messageId = Number(p.messageId);
    const text      = (p.text || '').toString().trim();
    const parseMode = (p.parseMode ?? 'HTML') || undefined;

    if (!chat_id)     return { statusCode:400, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:'chatId is required' }) };
    if (!messageId || Number.isNaN(messageId))
                      return { statusCode:400, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:'messageId is required' }) };
    if (!text)        return { statusCode:400, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:'text is required' }) };

    const payload = { chat_id, message_id: messageId, text };
    if (parseMode) payload.parse_mode = parseMode;

    const resp = await f(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(async () => ({ ok:false, description: await resp.text() }));
    if (!data.ok) {
      return { statusCode:502, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:data.description || 'Telegram error', telegram:data }) };
    }

    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:true }) };
  } catch (e) {
    return { statusCode:500, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ success:false, error:String(e) }) };
  }
};



export default async (req, res) => {
  try {
    const { chatId, messageId, text } = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!chatId || !messageId || !text) {
      return res.json({ success:false, error:'chatId/messageId/text required' }, { status:400 });
    }

    const payload = { chat_id: chatId, message_id: Number(messageId), text };
    const tg = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const j = await tg.json();

    if (!j.ok) return res.json({ success:false, error:j.description }, { status:400 });

    return res.json({ success:true });
  } catch (e) {
    return res.json({ success:false, error:String(e) }, { status:500 });
  }
}
