// widgets/managers/js/managers.js
export async function initManagersWidget(root = document) {
  // 0) підключимо CSS віджета (щоб не правити index.html)
  ensureManagersCss();

  const host = root.querySelector('#managers-root') || document.getElementById('managers-root');
  if (!host) return;

  const tableBox = host.querySelector('#mgr-table');
  const yearSel  = host.querySelector('#mgr-year');
  const monthSel = host.querySelector('#mgr-month');
  const mgrSel   = host.querySelector('#mgr-manager');

  // -------- Форматування чисел (без валютного символу) --------
  const asNum = (v) => {
    const n = Number(String(v ?? '').replace(/[^\d.-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const fmtNumUA = (v) => asNum(v).toLocaleString('uk-UA');

  // -------- Базові URL (GAS) --------
  function getGAS() {
    return (
      (window.APP_CFG && (window.APP_CFG.SHEETS_WEBAPP_URL || window.APP_CFG['SHEETS_WEBAPP_URL'])) ||
      window.SHEETS_WEBAPP_URL || ''
    ).trim();
  }
  const GAS_BASE   = getGAS();
  const ORDERS_URL = GAS_BASE ? `${GAS_BASE}?mode=orders` : '';

  // -------- Акуратний getter під фактичну схему --------
  function get(field, row) {
    const alias = {
      id:              ['id'],
      id_m:            ['id_month'],     // 1) Замовлення в місяць
      id_zm:           ['id_manager'],   // 2) Номер замовлення менеджера (ID_ZM)
      imya_m:          ['manager'],
      date:            ['created_at'],
      recipient_last:  ['surname'],
      recipient_first: ['name'],
      profit:          ['profit'],
      order_group:     ['order_group'],  // альтернативний ID
    };
    const tryKeys = alias[field] || [field];
    let val;
    for (const k of tryKeys) {
      if (k in row && row[k] != null && String(row[k]) !== '') { val = row[k]; break; }
    }
    if (field === 'date' && val) { try { val = new Date(val); } catch {} }
    return val ?? '';
  }

  // -------- Дані --------
  let DATA = [];

  async function loadOrders() {
    if (!ORDERS_URL) throw new Error('SHEETS_WEBAPP_URL не налаштовано');
    const res = await fetch(`${ORDERS_URL}&_=${Date.now()}`, { cache: 'no-store' });
    const payload = await res.json();
    const rows =
      Array.isArray(payload) ? payload :
      Array.isArray(payload.orders) ? payload.orders :
      Array.isArray(payload.data) ? payload.data :
      Array.isArray(payload.items) ? payload.items :
      Array.isArray(payload.rows) ? payload.rows : [];
    DATA = rows;
  }

  // -------- Заповнення селекторів --------
  function fillYearMonthManager() {
    const years = new Set();
    const monthsByYear = new Map();
    const mgrs = new Set();

    (DATA || []).forEach(r => {
      const d = get('date', r);
      if (!(d instanceof Date) || isNaN(+d)) return;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      years.add(y);
      if (!monthsByYear.has(y)) monthsByYear.set(y, new Set());
      monthsByYear.get(y).add(m);

      const mname = get('imya_m', r);
      if (mname) mgrs.add(String(mname));
    });

    const yArr = Array.from(years).sort((a,b)=>b-a);
    yearSel.innerHTML = yArr.map(y => `<option value="${y}">${y}</option>`).join('');

    const now = new Date();
    const defYear  = yArr.includes(now.getFullYear()) ? now.getFullYear() : yArr[0];
    yearSel.value = defYear ?? '';

    const mSet = monthsByYear.get(Number(yearSel.value)) || new Set([1,2,3,4,5,6,7,8,9,10,11,12]);
    const mArr = Array.from(mSet).sort((a,b)=>a-b);
    monthSel.innerHTML = mArr.map(m => `<option value="${m}">${String(m).padStart(2,'0')}</option>`).join('');
    const defMonth = mArr.includes(now.getMonth()+1) ? (now.getMonth()+1) : (mArr[mArr.length-1] || 1);
    monthSel.value = String(defMonth);

    const mList = Array.from(mgrs).sort((a,b)=>a.localeCompare(b,'uk'));
    mgrSel.innerHTML = `<option value="">Усі</option>` + mList.map(n=>`<option value="${n}">${n}</option>`).join('');
    mgrSel.value = '';
  }

  // -------- Фільтрація --------
  function matchesFilters(r) {
    const d = get('date', r);
    if (!(d instanceof Date) || isNaN(+d)) return false;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;

    const needY = Number(yearSel.value);
    const needM = Number(monthSel.value);
    if (needY && y !== needY) return false;
    if (needM && m !== needM) return false;

    const needMgr = String(mgrSel.value || '');
    if (needMgr && String(get('imya_m', r) || '') !== needMgr) return false;

    return true;
  }

  // -------- Клієнт (ПІБ) --------
  function fmtClient(r) {
    const s = get('recipient_last', r);
    const n = get('recipient_first', r);
    return [s,n].filter(Boolean).join(' ');
  }

  // -------- Рендер таблиці --------
  function renderTable() {
    const rows = (DATA || []).filter(matchesFilters);
    const total = rows.reduce((s, r) => s + asNum(get('profit', r)), 0);

    const head = `
      <div class="mgr-grid head">
        <div>Замовлення в місяць</div>
        <div>Номер замовлення менеджера</div>
        <div>ID — Замовлення</div>
        <div>Прізвище та ім’я</div>
        <div class="text-right">Дохід</div>
      </div>
    `;

    const body = rows.map(r => {
      const idm     = get('id_m', r)  || '—';                          // 1
      const idZm    = get('id_zm', r) || '—';                          // 2
      const idOrder = get('order_group', r) || get('id', r) || '—';    // 3
      const client  = fmtClient(r)    || '—';                          // 4
      const profit  = fmtNumUA(get('profit', r));                      // 5

      return `
        <div class="mgr-grid row">
          <div>${idm}</div>
          <div>${idZm}</div>
          <div class="mono">#${idOrder}</div>
          <div>${client}</div>
          <div class="text-right strong">${profit}</div>
        </div>
      `;
    }).join('') || `<div class="text-sm text-zinc-400 py-4">Немає замовлень за вибраний період</div>`;

    const footer = `
      <div class="mgr-grid foot">
        <div></div><div></div><div></div>
        <div class="text-right text-sm text-zinc-400">Загальна сума доходу за місяць:</div>
        <div class="text-right text-base strong">${fmtNumUA(total)}</div>
      </div>
    `;

    tableBox.innerHTML = `
      <div class="mgr-card">
        ${head}
        ${body}
        ${footer}
      </div>
    `;
  }

  // -------- Події --------
  yearSel.addEventListener('change', () => {
    // перебудуємо місяці під обраний рік
    const mSet = new Set(
      (DATA||[])
        .filter(r => {
          const d = get('date', r);
          return (d instanceof Date) && d.getFullYear() === Number(yearSel.value);
        })
        .map(r => get('date', r).getMonth()+1)
    );
    const mArr = Array.from(mSet).sort((a,b)=>a-b);
    monthSel.innerHTML = mArr.map(m => `<option value="${m}">${String(m).padStart(2,'0')}</option>`).join('');
    if (!mArr.includes(Number(monthSel.value))) {
      monthSel.value = String(mArr[mArr.length-1] || 1);
    }
    renderTable();
  });
  monthSel.addEventListener('change', renderTable);
  mgrSel.addEventListener('change', renderTable);

  // -------- Старт --------
  try {
    await loadOrders();
    fillYearMonthManager();
    renderTable();
  } catch (e) {
    console.error('[managers] loadOrders failed:', e);
    tableBox.innerHTML = `<div class="text-sm text-rose-400">Помилка завантаження даних</div>`;
  }

  // -------- CSS підключення --------
  function ensureManagersCss() {
    if (document.getElementById('managers-css')) return;
    const link = document.createElement('link');
    link.id = 'managers-css';
    link.rel = 'stylesheet';
    link.href = 'widgets/managers/css/managers.css';
    document.head.appendChild(link);
  }
}