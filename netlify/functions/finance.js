// netlify/functions/finance.js
// Проксі до GAS WebApp для фінансових записів.
// Приймає JSON з фронта і форвардить його на
// SHEETS_WEBAPP_URL_FINANCE | SHEETS_WEBAPP_URL  з query ?res=<...>&mode=<...>
// де <res> і <mode> можна задати через ENV: FINANCE_RES, FINANCE_ACTION.

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*"; // або твій домен

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return jsonOut(
      400,
      { ok: false, error: "Bad JSON", details: String(e) },
    );
  }

  // URL GAS: пріоритетом окремий для фінансів, потім загальний, потім із тіла (fallback)
  const sheetsUrl = [
    process.env.SHEETS_WEBAPP_URL_FINANCE,
    process.env.SHEETS_WEBAPP_URL,
    payload.SHEETS_WEBAPP_URL,
    payload.sheetsUrl,
  ]
    .map(v => (v || "").trim())
    .find(Boolean);

  if (!sheetsUrl) {
    return jsonOut(500, { ok: false, error: "SHEETS_WEBAPP_URL is missing" });
  }

  // Роутинг до GAS задаємо через ENV (за замовчуванням finance/add)
  const RES    = (process.env.FINANCE_RES || "finance").trim();
  const ACTION = (process.env.FINANCE_ACTION || "add").trim();

  const target =
    `${sheetsUrl.replace(/\/+$/, "")}`
    + `?res=${encodeURIComponent(RES)}`
    + `&mode=${encodeURIComponent(ACTION)}`
    + (payload.DEBUG_FINANCE ? `&debug=1` : "");

  try {
    // Лог у Netlify Logs — зручно для діагностики
    console.log("→ POST to GAS", { target });

    const r = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-By": "netlify-finance-proxy",
      },
      body: JSON.stringify(payload),
    });

    // GAS інколи відповідає text/plain → читаємо як текст і пробуємо розпарсити
    const text = await r.text();
    const maybeJson = safeParseJson(text);

    const responseBody = {
      ok: r.ok,
      upstreamStatus: r.status,
      upstreamUrl: target,
      upstreamBody: maybeJson ?? text,
    };

    return jsonOut(r.ok ? 200 : r.status, responseBody);
  } catch (e) {
    return jsonOut(502, {
      ok: false,
      error: "Upstream fetch failed",
      details: String(e),
      upstreamUrl: target,
    });
  }
};

function safeParseJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function jsonOut(status, body) {
  return {
    statusCode: status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
