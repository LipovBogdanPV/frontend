// /.netlify/functions/send-telegram.js
const KV_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 год
let KV = null, kvFetchedAt = 0;

async function loadKV(force = false) {
  const base =
    process.env.SHEETS_WEBAPP_URL ||
    process.env.SHIFTTIME_SHEETS_URL ||
    '';

  if (!base) { KV = {}; return KV; }

  const fresh = Date.now() - kvFetchedAt < KV_CACHE_TTL;
  if (!force && KV && fresh) return KV;

  try {
    const url = `${base.replace(/\/+$/, '')}?mode=kv`;
    const r = await fetch(url);
    const json = await r.json();
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
    return { statusCode: 405, body: JSON.stringify({ success:false, error:'Method not allowed' }) };
  }

  try {
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
      return { statusCode: 500, body: JSON.stringify({ success:false, error:'Telegram bot token is missing' }) };
    }

    const partnerKey = (p.partner || p.partnerKey || '').toString().trim().toUpperCase();
    const partnerChat =
      (partnerKey && (KV[`TG_CHAT_ID_${partnerKey}`] || KV[`TELEGRAM_CHAT_ID_${partnerKey}`])) || '';

    const defaultChat = (
      KV.DEFAULT_CHAT_ID || KV.TELEGRAM_CHAT_ID || KV.TG_CHAT_ID_DEFAULT || process.env.DEFAULT_CHAT_ID || ''
    ).trim();

    const chat_id = (p.chatId || partnerChat || defaultChat || '').toString().trim();
    const text = (p.text || '').toString().trim();
    const message_thread_id = p.messageThreadId || p.topicId || undefined;

    if (!chat_id)  return { statusCode:400, body: JSON.stringify({ success:false, error:'chatId is required (DEFAULT_CHAT_ID not set)' }) };
    if (!text)     return { statusCode:400, body: JSON.stringify({ success:false, error:'text is required' }) };

    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id, text, parse_mode:'HTML', disable_web_page_preview:true,
        ...(message_thread_id ? { message_thread_id } : {})
      })
    });
    const data = await resp.json();

    if (!data.ok) {
      return { statusCode: 502, body: JSON.stringify({ success:false, error:data.description || 'Telegram error', telegram:data }) };
    }

    return { statusCode:200, body: JSON.stringify({ success:true, messageId:data.result?.message_id, chatId:data.result?.chat?.id }) };
  } catch (e) {
    return { statusCode:500, body: JSON.stringify({ success:false, error:String(e) }) };
  }
};
