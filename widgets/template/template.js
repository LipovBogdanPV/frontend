// Ізолюємо у неймспейс, щоб не конфліктуватиfunction getAvailableKeys()
export const TemplateWidget = (() => {
  const LS_KEY = 'stTemplates';
  let state = {
    templates: [],
    activeId: null,
    activeActionIdx: null, // <— додано
    keys: [],
  };

  // ===== Helpers: storage =====
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      state.templates = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('❌ Помилка читання шаблонів із localStorage', e);
      state.templates = [];
    }
  }
  function persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(state.templates));
  }

  // ===== Keys from Google Sheet (static list + extensible) =====
  function getAvailableKeys() {
   return [
    // Загальні
    { key: 'orderId',      label: 'Номер замовлення' },
    { key: 'idManager',    label: 'ID-M (ідентифікатор менеджера)' },                    // ID замовлення менеджера
    { key: 'createdAt',    label: 'Дата створення' },
    { key: 'manager',      label: 'Менеджер' },

    // Клієнт
    { key: 'clientSurname',    label: 'Прізвище' },
    { key: 'clientFirstname',  label: 'Імʼя' },
    { key: 'clientPatronymic', label: 'По батькові' },
    { key: 'clientName',       label: 'Повне імʼя' },           // зліплюємо з прізвища+імені, якщо треба
    { key:'clientFullName',    label:'ПІБ повністю' },
    { key: 'phone',            label: 'Телефон' },
    { key: 'email',            label: 'Email' },

    // Адреса / доставка
    { key: 'country',        label: 'Країна' },
    { key: 'region',         label: 'Область' },
    { key: 'district',       label: 'Район' },
    { key: 'city',           label: 'Місто/нас. пункт' },
    { key: 'street',         label: 'Вулиця/№' },
    { key: 'npWarehouse',    label: 'Відділення НП / Адреса' },
    { key: 'warehouseType',  label: 'Тип відділення' },
    { key: 'deliveryType',   label: 'Спосіб доставки' },

    // Товари та оплати
    { key: 'itemsList',      label: 'Перелік товарів (рядками)' },


    { key: 'discount',       label: 'Знижка (AE)' },
    { key: 'salePrice',      label: 'Ціна продажу (AJ)' },
    { key: 'priceClient',    label: 'Ціна для клієнта (AK)' },
    
    { key: 'prepaid',        label: 'Передоплата' },
    { key: 'payment',        label: 'Оплата (наложка/картка/…)' },

    // Інше
    { key: 'marketplace',    label: 'Маркетплейс' },
    { key: 'status',         label: 'Статус відправлення' },
    { key: 'ttn',            label: 'ТТН' },
    { key: 'note',           label: 'Коментар / Надпис / Зображення' },
    { key:'drop',            label: 'Дроп (сума покупок)' },
    { key:'totalMarginSum',  label: 'Сума маржі (замовлення)' },
    { key:'clientSettlement',label: 'Розрахунок із клієнтом' },
    { key:'olxDelivery',     label: 'OLX-доставка' },
    { key:'promDelivery',    label: 'Prom-доставка' },


  ];
  }

  // ===== UI mount =====
  const byId = (id) => document.getElementById(id);

  function mountKeysSelect() {
    const select = byId('tpl-insert-key');
    if (!select) return;
    select.innerHTML = '';
    state.keys.forEach(({ key, label }) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${label} — {{${key}}}`;
      select.appendChild(opt);
    });
  }

  function renderList(filter = '') {
    const ul = byId('tpl-list');
    if (!ul) return;
    ul.innerHTML = '';
    const q = filter.trim().toLowerCase();
    const list = state.templates
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((t) => !q || (t.name || '').toLowerCase().includes(q));

    if (!list.length) {
      ul.innerHTML = '<li class="text-sm text-gray-500">Немає шаблонів</li>';
      return;
    }

    list.forEach((t) => {
      const li = document.createElement('li');
      li.className = `px-2 py-1 rounded cursor-pointer flex items-center justify-between ${
        t.id === state.activeId ? 'bg-blue-50 border border-blue-200' : ''
      }`;
      li.onclick = () => openTemplate(t.id);
      li.innerHTML = `<span title="Оновлено: ${new Date(
        t.updatedAt || Date.now()
      ).toLocaleString()}">${t.name || '(без назви)'}</span>`;
      ul.appendChild(li);
    });
  }

  function openTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    state.activeId = id;
    state.activeActionIdx = null;
    byId('tpl-name').value = t.name || '';
    byId('tpl-editor').value = t.content || '';
    renderActions(t.actions || []);
    refreshPreview();
    renderList(byId('tpl-search').value || '');
  }

  function renderActions(actions) {
    const wrap = byId('tpl-actions');
    if (!wrap) return;
    wrap.innerHTML = '';

    (actions || []).forEach((a, idx) => {
      const row = document.createElement('div');
      row.className = `flex items-center justify-between gap-2 p-1 border rounded ${
        idx === state.activeActionIdx ? 'bg-blue-50 border-blue-200' : ''
      }`;

      const button = document.createElement('button');
      button.className = 'px-2 py-1 rounded border text-sm flex-1 text-left';
      button.textContent =
        a.label || (a.type === 'telegram' ? 'Надіслати в Telegram' : a.type);
      button.onclick = () => {
        state.activeActionIdx = idx;
        renderActions(actions);
        renderActionSettings();
      };

      const del = document.createElement('button');
      del.className = 'px-2 py-1 text-sm rounded border hover:bg-rose-50';
      del.textContent = '✕';
      del.title = 'Видалити кнопку';
      del.onclick = () => {
        if (!confirm('Видалити цю кнопку?')) return;
        removeAction(idx);
      };

      row.appendChild(button);
      row.appendChild(del);
      wrap.appendChild(row);
    });
  }

  function removeAction(idx) {
    const t = getActive();
    if (!t) return;
    (t.actions || []).splice(idx, 1);
    if (state.activeActionIdx === idx) state.activeActionIdx = null;
    else if (state.activeActionIdx > idx) state.activeActionIdx--;
    saveActive(t);
    renderActionSettings();
  }

  function getActive() {
    return state.templates.find((x) => x.id === state.activeId);
  }

  function renderActionSettings() {
    const box = byId('tpl-action-settings');
    if (!box) return;
    const t = getActive();
    const idx = state.activeActionIdx;
    const a = t && t.actions && typeof idx === 'number' ? t.actions[idx] : null;
    const typeEl = byId('tpl-action-type');
    const labelEl = byId('tpl-action-label');

    if (!a) {
      if (typeEl) typeEl.value = 'telegram';
      if (labelEl) labelEl.value = '';
      return;
    }
    if (typeEl) typeEl.value = a.type || 'telegram';
    if (labelEl) labelEl.value = a.label || '';
  }

  // ===== CRUD =====
  function createNew() {
    const id = crypto.randomUUID();
    const t = {
      id,
      name: 'Новий шаблон',
      content:
        'ЗАМОВЛЕННЯ №{{orderId}}\n* * * * * * * * * * * * * *\n{{itemsList}}\nЦіна для клієнта: {{forClient}} грн\n({{payment}})\n\n{{region}}, місто {{city}}\nНова пошта: {{npWarehouse}}\n{{clientName}}\n{{phone}}\n* * * * * * * * * * * * * *\n{{note}}',
      actions: [{ type: 'telegram', label: 'Надіслати в Telegram' }],
      updatedAt: Date.now(),
    };
    state.templates.push(t);
    persist();
    openTemplate(id);
  }

  function saveActive(patch) {
    const t = getActive();
    if (!t) return;
    Object.assign(t, patch || {});
    t.updatedAt = Date.now();
    persist();
    openTemplate(t.id);
  }

  function destroyActive() {
    if (!state.activeId) return;
    const idx = state.templates.findIndex((x) => x.id === state.activeId);
    if (idx > -1) {
      if (!confirm('Видалити поточний шаблон?')) return;
      state.templates.splice(idx, 1);
      state.activeId = null;
      state.activeActionIdx = null;
      persist();
      renderList(byId('tpl-search').value || '');
      byId('tpl-name').value = '';
      byId('tpl-editor').value = '';
      byId('tpl-actions').innerHTML = '';
      byId('tpl-preview').textContent = '';
    }
  }

  // ===== Toolbar actions =====
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    const pos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
    textarea.focus();
    refreshPreview();
  }

  function addAction() {
    const t = getActive();
    if (!t) return;
    t.actions ||= [];
    t.actions.push({ type: 'telegram', label: 'Надіслати в Telegram' });
    state.activeActionIdx = t.actions.length - 1;
    saveActive(t);
  }

  // ===== Preview =====
// ПОВНА заміна compile(...)
function compile(content, data) {
  const d = data || {};

  // coalesce: беремо перше значення, яке НЕ undefined/NULL і не порожній рядок.
  // ВАЖЛИВО: 0 вважаємо валідним (НЕ порожнім).
  const coalesce = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null) {
        if (typeof v === 'string') {
          if (v.trim() !== '') return v;
        } else {
          return v; // 0, false, числа тощо — валідні
        }
      }
    }
    return undefined;
  };

  // Акуратні фолбеки (без підміни "0" на інше)
  const F = {
    clientName:  x => coalesce(x.clientName, [x.clientSurname, x.clientFirstname].filter(Boolean).join(' ').trim()),
    npWarehouse: x => coalesce(x.npWarehouse, x.warehouse, x.warehouseNumber),
    // ГОЛОВНЕ: priceClient НЕ підміняємо на sale.
    // Якщо хочеш запасний ключ — лишаємо тільки forClient.

    sale:        x => coalesce(x.sale, x.discount),   // знижка
    salePrice:   x => coalesce(x.salePrice),          // продажу
    priceClient: x => coalesce(x.priceClient),        // для клієнта
 

    itemsList:   x => coalesce(x.itemsList, x.items, x.items_list),
    note:        x => coalesce(x.note, x.comment),
  };

  return String(content || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    // 1) пряме значення
    const direct = coalesce(d[k]);
    if (direct !== undefined) return String(direct);

    // 2) фолбек з карти F
    if (F[k]) {
      const fb = F[k](d);
      if (fb !== undefined) return String(fb);
    }

    // 3) підсвічуємо відсутнє
    return `{{${k}}}`;
  });
}


  function getTestData() {
    const el = byId('tpl-test-json');
    const raw = el ? el.value.trim() : '';
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function refreshPreview() {
    const content = (byId('tpl-editor').value || '');
    const data = getTestData() || defaultPreviewData();
    byId('tpl-preview').textContent = compile(content, data);
  }

  function defaultPreviewData() {
  return {
    orderId: 'b-188',
    createdAt: new Date().toLocaleString('uk-UA'),
    manager: 'Богдан',

    clientSurname: 'Волгіна',
    clientFirstname: 'Аліна',
    clientPatronymic: '',
    clientName: 'Волгіна Аліна',        // можна і не задавати, зліпиться автоматично
    phone: '0939793824',
    email: 'client@example.com',

    country: 'Україна',
    region: 'Дніпропетровська',
    district: 'Район',
    city: 'Дніпро',
    street: 'вул. Незалежності, 21',
    npWarehouse: 'Відділення №29 (до 30 кг): вул. Незалежності, 21',
    warehouseType: '№29',
    deliveryType: 'Нова Пошта',

    itemsList:
      'Диск з ботиком d60\nЧохол d60\nКришка нержавійка глянцева d60\nГравіювання нержавійка d60\nПідставка САДЖ/розбірна d60',
    priceClient: 4395,
    forClient:   3390,   // AK — Для клієнта (додай)

    discount: 0,
    prepaid: 0,
    payment: 'наложка',

    marketplace: 'OLX',
    status: 'Комплектується',
    ttn: '20451136533855',
    note: 'Надпис: ...\nЗображення: ...',
  };
}

  // ===== OUTER 3-SPLIT (left | center | right) =====
 // ===== OUTER 3-SPLIT (left | center | right) =====
function initSplit3(){
  const container = document.getElementById('tpl-3split');
  const left = document.getElementById('tpl-left');
  const center = document.getElementById('tpl-center');
  const right = document.getElementById('tpl-right');
  const lc = document.getElementById('tpl-resizer-lc');
  const cr = document.getElementById('tpl-resizer-cr');
  if (!container || !left || !center || !right || !lc || !cr) return;

  const minL = 220, minC = 320, minR = 280;

  // початкові пропорції
  let leftRatio  = parseFloat(localStorage.getItem('stTpl3Left')  || '0.24');
  let rightRatio = parseFloat(localStorage.getItem('stTpl3Right') || '0.24');

  function applyFromRatios(){
    const total = container.clientWidth - lc.offsetWidth - cr.offsetWidth;
    const l = Math.max(minL, total * leftRatio);
    const r = Math.max(minR, total * rightRatio);
    const c = Math.max(minC, total - l - r);
    left.style.width   = l + 'px';
    center.style.width = c + 'px';
    right.style.width  = r + 'px';
  }
  applyFromRatios();

  let dragging = null, startX = 0;
  let start = { l:0, c:0, r:0, tot:0 };
  let hideL = left.style.display === 'none';
  let hideR = right.style.display === 'none';

  function begin(which, e){
    e.preventDefault();
    dragging = which;
    startX   = e.clientX;
    start.l  = left.offsetWidth;
    start.c  = center.offsetWidth;
    start.r  = right.offsetWidth;
    start.tot = start.l + start.c + start.r;
    document.body.classList.add('tpl-ns');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', end);
  }

  function onMove(e){
    if (!dragging) return;
    const dx = e.clientX - startX;

    let l = start.l, c = start.c, r = start.r;

    if (dragging === 'lc' && !hideL) {
      // Лівий резайзер: вправо -> ширшає left, звужується center
      l = clamp(start.l + dx, minL, start.tot - minC - (hideR ? 0 : minR));
      c = Math.max(minC, start.tot - l - (hideR ? 0 : r));
    }

    if (dragging === 'cr' && !hideR) {
      // ПРАВИЙ резайзер: вправо -> ШИРШАЄ CENTER, звужується right
      const minCenter = minC;
      const maxCenter = start.tot - (hideL ? 0 : minL) - minR;
      c = clamp(start.c + dx, minCenter, maxCenter);
      r = Math.max(minR, start.tot - (hideL ? 0 : start.l) - c);
    }

    if (!hideL) left.style.width = l + 'px';
    center.style.width = c + 'px';
    if (!hideR) right.style.width = r + 'px';
  }

  function end(){
    dragging = null;
    document.body.classList.remove('tpl-ns');
    const total = left.offsetWidth + center.offsetWidth + right.offsetWidth;
    if (total > 0) {
      localStorage.setItem('stTpl3Left',  (left.offsetWidth  / total).toFixed(4));
      localStorage.setItem('stTpl3Right', (right.offsetWidth / total).toFixed(4));
    }
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', end);
  }

  lc.addEventListener('mousedown', (e)=>begin('lc', e));
  cr.addEventListener('mousedown', (e)=>begin('cr', e));

  // Показ/приховування панелей
  const chips = {
    left:   document.getElementById('show-left'),
    center: document.getElementById('show-center'),
    right:  document.getElementById('show-right'),
  };

  function setHidden(which, hidden){
    const map = { left, center, right };
    const el = map[which];
    el.style.display = hidden ? 'none' : '';
    if (which === 'left')  lc.style.display = hidden ? 'none' : '';
    if (which === 'right') cr.style.display = hidden ? 'none' : '';
    chips[which]?.classList.toggle('hidden', !hidden);
    hideL = left.style.display === 'none';
    hideR = right.style.display === 'none';
    applyFromRatios();
    localStorage.setItem('stTpl3Hidden:' + which, hidden ? '1' : '0');
  }

  document.getElementById('hide-left')?.addEventListener('click', ()=>setHidden('left', true));
  document.getElementById('hide-center')?.addEventListener('click', ()=>setHidden('center', true));
  document.getElementById('hide-right')?.addEventListener('click', ()=>setHidden('right', true));
  document.getElementById('btn-show-left')?.addEventListener('click', ()=>setHidden('left', false));
  document.getElementById('btn-show-right')?.addEventListener('click', ()=>setHidden('right', false));
  chips.left?.addEventListener('click',   ()=>setHidden('left', false));
  chips.center?.addEventListener('click', ()=>setHidden('center', false));
  chips.right?.addEventListener('click',  ()=>setHidden('right', false));

  // відновлюємо приховані панелі з localStorage
  ['left','center','right'].forEach(w=>{
    if (localStorage.getItem('stTpl3Hidden:'+w) === '1') setHidden(w, true);
  });

  window.addEventListener('resize', applyFromRatios);
}




  // ===== Split (editor <-> preview) =====
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function initSplit() {
    const res = byId('tpl-resizer');
    const left = byId('tpl-editor-col');
    const right = byId('tpl-preview-col');
    if (!res || !left || !right) return;

    const saved = parseFloat(localStorage.getItem('stTplSplitRatio') || '0.5');
    const ratio = isNaN(saved) ? 0.5 : clamp(saved, 0.2, 0.8);
    left.style.width = ratio * 100 + '%';
    right.style.width = (1 - ratio) * 100 + '%';

    let dragging = false, startX = 0, startLeft = 0, container = null, total = 0;
    const minPx = 220;

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const newLeft = clamp(startLeft + dx, minPx, total - minPx - res.offsetWidth);
      const newRatio = newLeft / (total - res.offsetWidth);
      left.style.width = newRatio * 100 + '%';
      right.style.width = (1 - newRatio) * 100 + '%';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('tpl-ns');
      const totalNow = container.clientWidth - res.offsetWidth;
      const leftNow = left.getBoundingClientRect().width;
      const r = clamp(leftNow / totalNow, 0.2, 0.8);
      localStorage.setItem('stTplSplitRatio', String(r));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    res.addEventListener('mousedown', (e) => {
      e.preventDefault();
      container = res.parentElement;
      total = container.clientWidth;
      startX = e.clientX;
      startLeft = left.getBoundingClientRect().width;
      dragging = true;
      document.body.classList.add('tpl-ns');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  // ===== Bind events =====
function bind() {
  // --- CRUD шаблонів ---
  const btnNew  = byId('tpl-new');
  const btnSave = byId('tpl-save');
  const btnDel  = byId('tpl-delete');

  if (btnNew)  btnNew.onclick = () => createNew();
  if (btnSave) btnSave.onclick = () => {
    const t = getActive(); if (!t) return;
    const nameEl   = byId('tpl-name');
    const editorEl = byId('tpl-editor');
    saveActive({
      name:    nameEl   ? nameEl.value   : t.name,
      content: editorEl ? editorEl.value : t.content,
    });
  };
  if (btnDel) btnDel.onclick = () => { if (confirm('Видалити поточний шаблон?')) destroyActive(); };

  // --- Пошук у списку шаблонів ---
  const search = byId('tpl-search');
  if (search) search.oninput = (e) => renderList(e.target.value || '');

  // --- Вставити {{ключ}} з верхнього тулбара ---
  const select    = byId('tpl-insert-key');
  const insertBtn = byId('tpl-insert-key-btn');
  if (insertBtn) insertBtn.onclick = () => {
    const key = select && select.value;
    if (!key) return;
    insertAtCursor(byId('tpl-editor'), `{{${key}}}`);
  };

  // --- Емодзі-попап ---
  const emojiBtn = byId('tpl-emoji');
  const emojiPop = byId('tpl-emoji-pop');
  if (emojiBtn && emojiPop) {
    emojiBtn.onclick = () => emojiPop.classList.toggle('hidden');
    emojiPop.addEventListener('click', (e) => {
      const el = e.target.closest('.emoji');
      if (!el) return;
      insertAtCursor(byId('tpl-editor'), el.textContent);
      emojiPop.classList.add('hidden');
    });
  }

  // --- Кнопки дій (правий блок) ---
  const addAct  = byId('tpl-add-action');
  if (addAct) addAct.onclick = addAction;

  const typeEl  = byId('tpl-action-type');
  const labelEl = byId('tpl-action-label');
  const saveAct = byId('tpl-action-save');
  if (saveAct) saveAct.onclick = () => {
    const t = getActive(); if (!t) return;
    const idx = state.activeActionIdx; if (typeof idx !== 'number') return;
    const a = t.actions[idx];
    a.type  = (typeEl  && typeEl.value)  || 'telegram';
    a.label = (labelEl && labelEl.value) || a.label;
    saveActive(t);
    renderActionSettings();
  };

  // --- Кнопки в шапці середнього блоку: показ лівого/правого ---
  const btnShowLeft  = byId('btn-show-left');
  const btnShowRight = byId('btn-show-right');
  if (btnShowLeft)  btnShowLeft.onclick  = () => { const chip = byId('show-left');  if (chip) chip.click(); };
  if (btnShowRight) btnShowRight.onclick = () => { const chip = byId('show-right'); if (chip) chip.click(); };

  // --- Live preview + автозріст textarea ---
  const editorEl = byId('tpl-editor');
  const testEl   = byId('tpl-test-json');
  const autogrow = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };

  if (editorEl) {
    autogrow(editorEl);
    editorEl.addEventListener('input', () => { autogrow(editorEl); refreshPreview(); });
  }

  // зберігаємо/відновлюємо вміст JSON між відкриттями
  if (testEl) {
    const saved = localStorage.getItem('stTplTestJson');
    if (saved && !testEl.value) testEl.value = saved;
    testEl.addEventListener('input', () => {
      localStorage.setItem('stTplTestJson', testEl.value);
      refreshPreview();
    });
  }

  // --- Модалка "Тестові дані (JSON)" ---
  const modal      = byId('tpl-json-modal');
  const openJson   = byId('tpl-json-open');
  const closeJson  = byId('tpl-json-close');
  const closeJson2 = byId('tpl-json-close2');
  const selectJson = byId('tpl-json-select');
  const copyJson   = byId('tpl-json-copy');
  const dlg        = byId('tpl-json-dialog');
  const btnMax     = byId('tpl-json-max');

  const showModal = (flag) => {
    if (!modal) return;
    modal.classList.toggle('hidden', !flag);
    document.body.style.overflow = flag ? 'hidden' : '';
  };

  // відкрити: якщо textarea порожня — підставляємо приклад
  if (openJson) openJson.onclick = () => {
    if (testEl && !testEl.value.trim()) {
      try {
        testEl.value = JSON.stringify(defaultPreviewData(), null, 2);
      } catch {}
    }
    showModal(true);
    if (testEl) { autogrow(testEl); testEl.focus(); }
  };

  // закрити (кнопки/клік по підкладці/ESC)
  if (closeJson)  closeJson.onclick  = () => showModal(false);
  if (closeJson2) closeJson2.onclick = () => showModal(false);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) showModal(false); });
  document.addEventListener('keydown', (e) => {
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') showModal(false);
  });

  // виділити/копіювати
  if (selectJson) selectJson.onclick = () => { if (testEl) { testEl.focus(); testEl.select(); } };
  if (copyJson)   copyJson.onclick   = async () => {
    if (!testEl) return;
    try {
      await navigator.clipboard.writeText(testEl.value);
      alert('Скопійовано');
    } catch {
      testEl.focus(); testEl.select();
      document.execCommand('copy');
      alert('Скопійовано');
    }
  };

  // --- Повноекранний режим для JSON (з CSS-фолбеком) ---
  if (dlg && btnMax) {
    btnMax.addEventListener('click', () => {
      const toFull = !dlg.classList.contains('is-fullscreen');
      dlg.classList.toggle('is-fullscreen', toFull);

      // фолбек, якщо CSS не підключився
      if (toFull) {
        dlg.style.width = '96vw';
        dlg.style.height = '92vh';
        dlg.style.maxHeight = '92vh';
        if (testEl) testEl.style.height = 'calc(92vh - 90px)';
        btnMax.textContent = '↙';
      } else {
        dlg.style.width = '';
        dlg.style.height = '';
        dlg.style.maxHeight = '';
        if (testEl) { testEl.style.height = ''; autogrow(testEl); }
        btnMax.textContent = '⛶';
      }
    });
  }
}

  function ensureInitial() {
    if (state.templates.length === 0) {
      createNew();
    } else {
      openTemplate(state.templates[0].id);
    }
  }

  // ===== Public API =====
function initTemplateSettings() {
  load();
  state.keys = getAvailableKeys();
  mountKeysSelect();
  bind();
  renderList('');
  ensureInitial();

  // важливо: ресайзери тільки після того, як DOM намальовано
  requestAnimationFrame(() => {
    initSplit3();
  });

  renderActionSettings();
}


  function getTemplates() {
    load();
    return state.templates.slice();
  }

  function getActiveTemplate() {
    return getActive();
  }

  return { initTemplateSettings, getTemplates, getActiveTemplate };
})();


// заміни свою compile на цю версію
