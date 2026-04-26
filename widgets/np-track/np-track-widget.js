// widgets/np-track/np-track-widget.js
// Мінімальний, стабільний віджет НП: mount + enable (без залежностей)

// ===== НАЛАШТУВАННЯ ==================================================
// Якщо true — при кліку відразу просимо GAS ОНОВИТИ статус у Google Sheet
const APPLY_WRITE = true; // <— автозапис увімкнено

// URL твого GAS WebApp і спільний секрет (мають бути задані глобально з index.html)
const GAS_BASE = (window.SHEETS_WEBAPP_URL || '').trim();
const GAS_SEC  = (window.SHEETS_SECRET || '').trim();

// Локальний дебаг-перемикач: в консолі виконай ->  localStorage.setItem('NP_DEBUG','1')
const NP_DEBUG = () => localStorage.getItem('NP_DEBUG') === '1';
// =====================================================================


// -------------------- UI: простий тост -------------------------------
function showNpToast({ ttn, status, error }) {
  const box = document.createElement('div');
  box.className = 'fixed z-50 px-4 py-3 rounded bg-zinc-800/95 text-zinc-100 text-sm shadow';
  box.style.left = '50%';
  box.style.top = '50%';
  box.style.transform = 'translate(-50%, -50%)';
  box.innerHTML = `
    <div class="font-semibold mb-1">Статус НП</div>
    <div class="opacity-80 text-xs mb-1">ТТН: ${ttn || '—'}</div>
    <div>Статус: <b>${status || (error ? '—' : '—')}</b>${error ? `<div class="mt-1 text-rose-300 text-xs">${error}</div>` : ''}</div>
  `;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2500);
}


// -------------------- helpers для mount -------------------------------
function findAllTelegramAnchors_(root) {
  const sels = ['.send-tpl','[data-role="tg-send"]','[data-action="send-telegram"]','.send-btn','.tg-send','#tg-send'];
  const out = new Set();
  for (const s of sels) (root || document).querySelectorAll(s)
    .forEach(el => out.add(el.closest('button, a') || el));
  return Array.from(out);
}

function createButtonEl_(id) {
  const a = document.createElement('a');
  if (id) a.id = id;
  a.href = '#';
  a.className = 'np-track-btn inline-flex items-center justify-center h-8 w-9 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200';
  a.innerHTML = '<span class="text-[10px] font-semibold leading-none">НП</span>';
  return a;
}

function mountNextTo_(anchor, btn, strategy='after') {
  const a = anchor.closest?.('.send-tpl') || anchor;
  const parent = a.parentElement || a;
  if (strategy === 'append') parent.appendChild(btn);
  else a.insertAdjacentElement('afterend', btn);
  parent.style.display = 'inline-flex';
  parent.style.gap = '8px';
  parent.style.alignItems = 'center';
  return btn;
}

function hasSiblingNpBtn_(anchor) {
  const parent = anchor.parentElement;
  if (!parent) return false;
  return !!Array.from(parent.children).find(el => el !== anchor && el.classList?.contains('np-track-btn'));
}

function extractOrderContextFromDom_(anchor) {
  const row = anchor.closest('.order-row') || anchor.closest('[data-row]');
  const ds  = row?.dataset || {};
  const og  = ds.order_group || ds.orderid || ds.orderId || '';
  return {
    orderGroup: og,
    orderId:    ds.orderId || og,
    ttn:        ds.ttn || '',
    phone:      ds.phone || ds.number || '',
    clientName: ds.clientName || '',
    idManager:  ds.idManager || ds.id_manager || ds.id_zm || '',
    createdAt:  ds.createdAt || ds.date || '',
    city:       ds.city || '',
    region:     ds.region || '',
    payment:    ds.payment || ds.post || '',
  };
}

function applyContextToDataset_(btn, ctx={}) {
  for (const [k,v] of Object.entries(ctx)) {
    if (v != null && String(v).trim() !== '') btn.dataset[k] = String(v).trim();
  }
}

function datasetToContext_(ds={}) {
  const out = { ...ds };
  out.orderGroup = out.orderGroup || out.order_group || out.orderid || out.orderId || '';
  out.orderId    = out.orderId    || out.orderid    || out.orderGroup || '';
  out.phone      = out.phone      || out.number || '';
  return out;
}


// -------------------- PUBLIC: mount ----------------------------------
// Ставитиме кнопку "НП" біля твоєї .send-tpl, і прокидатиме клік як подію np:track:open
export function mount(options = {}) {
  const {
    root = document,
    anchorSelector = '.send-tpl',  // де шукати місце для кнопки
    mountStrategy = 'after',       // 'after' | 'append'
    orderContext = null,           // { ttn, phone, orderGroup, ... } — якщо хочеш доповнити контекст
    onClick = null,                // для дебагу
    id = null,
  } = options;

  const anchors = anchorSelector
    ? Array.from((root || document).querySelectorAll(anchorSelector))
    : findAllTelegramAnchors_(root || document);

  if (!anchors.length) {
    console.warn('[NP-Track] Телеграм-іконку не знайдено (anchorSelector=.send-tpl ?).');
    return null;
  }

  const pickStrategy = (s) => (s === 'auto' ? 'after' : s);
  let lastBtn = null;

  anchors.forEach((anchor, idx) => {
    if (!anchor) return;
    if (anchor.dataset.npMounted === '1' || hasSiblingNpBtn_(anchor)) return;

    const uidBase = id || 'npTrackBtn';
    const tempBtn = createButtonEl_(`${uidBase}-${idx}`);
    const realBtn = mountNextTo_(anchor, tempBtn, pickStrategy(mountStrategy));
    if (!realBtn) return;

    // контекст беремо з рядка таблиці + опційно доповнюємо
    const ctxFromDom = extractOrderContextFromDom_(anchor);
    const ctx = { ...ctxFromDom, ...(orderContext || {}) };

    // якщо немає ttn, шукаємо елемент з ідентифікатором ttn-${orderGroup}
    if (!ctx.ttn && (ctx.orderGroup || ctx.orderId)) {
      const og = String(ctx.orderGroup || ctx.orderId);
      const ttnEl = document.getElementById(`ttn-${og}`);
      if (ttnEl) {
        const t = (ttnEl.textContent || '').trim();
        if (t && t !== '—') ctx.ttn = t;
      }
    }

    applyContextToDataset_(realBtn, ctx);

    realBtn.title = ctx?.ttn
      ? `Відстежити НП • ТТН: ${ctx.ttn}`
      : 'Відстежити посилку Нова Пошта';

    realBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const detail = datasetToContext_(realBtn.dataset);
      realBtn.dispatchEvent(new CustomEvent('np:track:open', { bubbles: true, detail }));
      if (typeof onClick === 'function') onClick(detail);
      else if (NP_DEBUG()) console.log('[NP-Track] click', detail);
    });

    anchor.dataset.npMounted = '1';
    lastBtn = realBtn;
  });

  return lastBtn;
}


// -------------------- GAS URL builder --------------------------------
// Тут важливо: якщо APPLY_WRITE (або window.NP_APPLY_WRITE) true — додаємо &apply=1
function buildNpUrl(detail, { apply } = {}) {
  const willApply = (typeof apply === 'boolean')
    ? apply
    : (typeof window.NP_APPLY_WRITE === 'boolean' ? window.NP_APPLY_WRITE : APPLY_WRITE);

  const params = new URLSearchParams({
    mode: 'np-track',
    ttn: detail.ttn || '',
    phone: detail.phone || '',
    order_group: detail.orderGroup || detail.order_group || '',
    sec: GAS_SEC
  });

  if (willApply) params.set('apply', '1');

  return `${GAS_BASE}?${params.toString()}`;
}


// -------------------- PUBLIC: enable ---------------------------------
// Слухає подію 'np:track:open', тягне статус з GAS, показує тост і викликає onApplyStatus(...)
let _enabled = false;
export function enable({ onApplyStatus } = {}) {
  if (_enabled) return;
  _enabled = true;

  document.addEventListener('np:track:open', async (ev) => {
    const detail = ev.detail || {};
    try {
      if (!GAS_BASE) {
        console.warn('[NP-Track] SHEETS_WEBAPP_URL порожній');
        showNpToast({ ttn: detail.ttn, status: '—', error: 'GAS URL не задано' });
        return;
      }

      const url  = buildNpUrl(detail); // <— тут apply додається автоматично
      if (NP_DEBUG()) console.info('[NP-Track] GET:', url);

      const resp = await fetch(url);
      const data = await resp.json();
      if (NP_DEBUG()) console.info('[NP-Track] RESP:', data);

      const text = data.statusText || data.status || data.npStatus || '—';
      showNpToast({ ttn: detail.ttn, status: text });

      // оновлюємо рядок у списку (через колбек з твого render())
      if (typeof onApplyStatus === 'function' && (data.status || data.statusText || data.npStatus)) {
        const crm = data.status || data.statusText || data.npStatus;
        onApplyStatus(detail.orderGroup || detail.order_group, crm);
      }
    } catch (err) {
      console.warn('[NP-Track] fetch error:', err);
      showNpToast({ ttn: detail.ttn, status: '—', error: String(err) });
    }
  }, { capture: true });
}


// -------------------- ESM / глобальне підключення --------------------
if (typeof window !== 'undefined') {
  window.NPTrackWidget = { mount, enable };
}
export default { mount, enable };