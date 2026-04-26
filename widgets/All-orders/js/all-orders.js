
import './orders-send.js';
// ✅ універсальний динамічний імпорт відносно поточного модуля
// динамічний імпорт віджета НП (ВАЖЛИВО: шлях відносно цього файлу!)
async function loadNpTrackModule() {
  return import('../../np-track/np-track-widget.js?ts=' + Date.now());
}
function mountNpButtons(root) {
  loadNpTrackModule()
    .then(({ initNpTrackWidget }) =>
      initNpTrackWidget({
        root,
        anchorSelector: '.send-tpl', // кнопка Телеграм у колонці "Надіслати"
        mountStrategy: 'after'       // ставимо праворуч від неї
      })
    )
    .catch(err => console.warn('[NP-Track] init error:', err));
}






export function initAllOrders(root = document) {

  // ---- 1) Джерело даних (Apps Script) ----
  // Якщо глобальна змінна SHEETS_WEBAPP_URL існує — беремо її; інакше використовуємо хардкод як фолбек


// ==== Менеджерські стилі (локальні налаштування) ====

const AO_LS_KEY = 'allOrders.managerStyles.v1';
const AO_DEFAULT_STYLES = {
  'Іван':   { color:'#ef4444', bg:'transparent', border:false, borderColor:'#ef4444', radius:10 },
  'Богдан': { color:'#22c55e', bg:'transparent', border:false, borderColor:'#22c55e', radius:10 },
};

// Постав одразу після AO_DEFAULT_STYLES, поруч з aoLoadStyles/aoStyleFor:
const aoSaveStyles = (st) => localStorage.setItem(AO_LS_KEY, JSON.stringify(st || {}));




const aoLoadStyles = () => { try {return {...AO_DEFAULT_STYLES, ...(JSON.parse(localStorage.getItem(AO_LS_KEY)||'{}'))};} catch{return {...AO_DEFAULT_STYLES}} };
const aoStyleFor = (name) => {
  const st = aoLoadStyles()[name] || {};
  const color       = st.color || '#111111';
  const bgHex       = st.bg || '#ffffff';
  const border      = !!st.border;
  const borderColor = st.borderColor || color;
  const radius      = Number.isFinite(+st.radius) ? +st.radius : 10;

  const noFill      = !!st.noFill;
  const fillOpacity = Math.max(0, Math.min(100, Number(st.fillOpacity ?? 100))) / 100;

  const padEnabled  = !!st.padEnabled;
  const padPx       = Number.isFinite(+st.padPx) ? +st.padPx : 8;

  // hex -> rgba
  const rgba = (hex, a = 1) => {
    const m = String(hex || '').replace('#','');
    const v = parseInt(m.length === 3 ? m.split('').map(c=>c+c).join('') : m, 16);
    const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  const bg = noFill ? 'transparent' : rgba(bgHex, fillOpacity);

  return [
    `color:${color}`,
    `background:${bg}`,
    border ? `border:1px solid ${borderColor}` : 'border:none',
    `border-radius:${radius}px`,
    padEnabled ? `padding:${padPx}px` : 'padding:2px 8px' // дефолт як було
  ].join(';');
};



 const GAS_BASE   = (window.SHEETS_WEBAPP_URL || '...');
const ORDERS_URL = `${GAS_BASE}?mode=orders`; // ← єдине оголошення!
    // ---- 2) Відповідність назв колонок із 2-го рядка ----
  const HeaderMap = {
    id:'ID',
    id_m:'ID-М',
    id_zm:'ID_ZM',
    imya_m: "Ім'я_М",

    date:'Година',
    recipient_last:'Прізвище',
    recipient_first:"Ім'я",
    recipient_middle:'По батькові',
    phone:'Телефон',
    email:'Email',
    region:'Область',
    district:'Район',
    city:'Населений пункт',
    street:'Вулиця №',
    warehouse:'Відділення',
    warehouseType:'Тип відділення',
    marketplace:'Маркетплейс',
    item:'Товар',
    size:'Розмір',
    description:'Опис',             // ← додано
    comment:'Коментар',             // ← додано
    purchase:'Покупка',             // ← додано
    margin_item:'Маржа',            // ← додано (AA)
    price_item:'Ціна',              // ← додано (AB)
    sale:'Продажу',
    profit:'Дохід',
    ttn:'ТТН', 
    status:'Статус відправлення',
    order_group:'Замовлення'
  };

  // ---- 3) Набір колонок у рядку ----
  const ALL_FIELDS = [
    { key:'id',        label:'№',               width:'72px' },

     // нові дві колонки
    { key:'id_zm',  label:'ID_ZM',  width:'90px',  align:'center' },   // ID менеджера
    { key:'imya_m', label:"Ім'я_М", width:'130px' },                   // Ім'я менеджера



    { key:'recipient', label:'Отримувач',       width:'260px' },       // агрегуємо прізвище + ім'я + по батькові
    { key:'city',      label:'Нас. пункт',      width:'180px' },
    { key:'date',      label:'Час створення',   width:'160px' },
    
    { key:'ttn',       label:'ТТН',             width:'200px', align:'center' },
    { key:'status',    label:'Статус',          width:'180px', align:'center' },
    { key:'send',      label:'Надіслати',     width:'100px',  align:'center' },

   


    { key:'marketplace', label:'Маркетплейс',   width:'140px' },
    { key:'sale',        label:'Продаж',        width:'110px', align:'right' },
    { key:'profit',      label:'Дохід',         width:'110px', align:'right' },
  ];

//--------------------------------------------------------------------------------------------------------------

// ===== Конфігурація колонок (порядок + видимість) ==========================
const AO_COLS_KEY = 'allOrders.columns.v1';















// збудувати дефолтну видимість з поточного HEAD
function makeDefaultVisible() {
  const set = new Set(HEAD);
  const visible = {};
  (ALL_FIELDS || []).forEach(f => { visible[f.key] = set.has(f.key); });
  return visible;
}

function colsLoad() {
  try {
    const cfg = JSON.parse(localStorage.getItem(AO_COLS_KEY) || '{}');
    if (!cfg || !Array.isArray(cfg.order) || !cfg.visible) throw new Error('bad');
    return cfg;
  } catch {
    return { order: [...HEAD], visible: makeDefaultVisible() };
  }
}

function colsSave(cfg) {
  localStorage.setItem(AO_COLS_KEY, JSON.stringify(cfg || {}));
}

// застосувати конфіг до HEAD (видимі + порядок)
function applyColumnsConfigToHead() {
  const cfg = colsLoad();
  // прибрати неіснуючі ключі, додати нові (якщо зʼявилися в ALL_FIELDS)
  const knownKeys = new Set((ALL_FIELDS || []).map(f => f.key));
  const pruned = cfg.order.filter(k => knownKeys.has(k));
  (ALL_FIELDS || []).forEach(f => { if (!pruned.includes(f.key)) pruned.push(f.key); });

  // оновити видимість для нових ключів (за замовчуванням false)
  (ALL_FIELDS || []).forEach(f => {
    if (!(f.key in cfg.visible)) cfg.visible[f.key] = false;
  });

  // записати назад і оновити HEAD
  cfg.order = pruned;
  colsSave(cfg);
  HEAD = cfg.order.filter(k => cfg.visible[k]);
}


//--------------------------------------------------------------------------------------------------------------

  let HEAD = ['id','id_zm','imya_m','recipient','city','date','ttn','status','send'];

// застосувати (якщо вже щось збережено) порядок/видимість колонок
applyColumnsConfigToHead();

  // === Універсальний читач Статусу (підхоплює різні назви поля) ===
function getStatusValue(row) {
  // спершу пробуємо твій get('status', row), який мапиться на alias
  let v = get('status', row);

  // якщо порожньо — пробуємо типові альтернативи
  if (v == null || v === '') {
    v =
      row?.status_np ??
      row?.statusText ??
      row?.statusShipment ??
      row?.['Статус відправлення'] ?? // якщо прийшов сирий заголовок з укр. назвою
      '';
  }

  if (typeof v === 'string') return v.trim();
  return v ?? '';
}

// Нормалізація тексту: NBSP, зайві пробіли, латинська "i" → українська "і"
// ── ЄДИНА ВЕРСІЯ ─────────────────────────────────────────────
function uaNormalize(s){
  return String(s || '')
    .replace(/\u00A0/g, ' ')        // NBSP → пробіл
    .replace(/\s+/g, ' ')           // зжати пробіли
    .replace(/([А-Яа-яЇїІіЄєҐґ])i([А-Яа-яЇїІіЄєҐґ])/g, '$1і$2') // лат. "i" між кирилицею → "і"
    .trim();
}

// ЄДИНА канонізація статусів (класифікуємо, але текст скрізь показуємо сирий)
function canonStatus(s){
  const t = uaNormalize(s);
  if (!t) return '__EMPTY__';

  // спец-правила
  if (/посил\S*\s+прийнят(?:о|а|і)/i.test(t)) return 'Відправлено';
  if (/(відправлення\s+прямує|прямує\s+до)/i.test(t)) return 'В дорозі';

  // загальні фолбеки
  if (/виготов|вироб/i.test(t)) return 'Виготовляється';
  if (/комплект/i.test(t)) return 'Комплектується';
  if (/(^|\s)відправлено\b/i.test(t) || /передано.*перевіз/i.test(t)) return 'Відправлено';
  if (/(?:^|[\s\-])(?:в|у)?\s*дороз|транзит|переміщ|в\s*шлях/i.test(t)) return 'В дорозі';
  if (/прибул\S*\s+(?:у|в|до)\s+відділен/i.test(t)) return 'Прибув у відділення';

  // ← ДОДАНО: різні варіації "відмова"
  if (/відмов/i.test(t)) return 'Відмова';

  if (/отриман|видано|вручено/i.test(t)) return 'Отримано';

  return t;
}







//=====================================Налаштуванння менеджера========================================
//====================================================================================================

// ==== Менеджерські стилі (локальні налаштування) ====

// Канонізація статусів до фіксованих назв із дропдауну.
// Підхоплює варіації формулювань з таблиці (НП тощо) і зводить їх до єдиної форми.
// Нормалізація: прибираємо NBSP, зайві пробіли, латинську "i" між кирилицею → "і"






// ==== Кнопка-зірочка + модалка налаштувань ====
function aoEnsureStarButton() {
  const host = document.getElementById('ao-toolbar');
  if (!host) return;

  // 1) ⭐ Кольори менеджерів
  if (!host.querySelector('.ao-star-btn')) {
    const btn1 = document.createElement('button');
    btn1.type = 'button';
    btn1.className = 'ao-star-btn btn btn-sm btn-outline-secondary';
    btn1.title = 'Кольори менеджерів';
    btn1.innerHTML = '⭐';
    btn1.addEventListener('click', aoOpenSettingsModal);
    host.appendChild(btn1);
  }

  // 2) ⭐ Налаштування колонок
  if (!host.querySelector('.ao-cols-btn')) {
    const btn2 = document.createElement('button');
    btn2.type = 'button';
    btn2.className = 'ao-cols-btn btn btn-sm btn-outline-secondary ms-2';
    btn2.title = 'Налаштування колонок';
    btn2.innerHTML = '⭐';
    btn2.addEventListener('click', aoOpenColumnsModal);
    host.appendChild(btn2);
  }
}



function aoOpenSettingsModal() {
  const styles = aoLoadStyles();
  const managers = Object.keys(styles).length ? Object.keys(styles) : ['Іван','Богдан'];

// усі відкриті спочатку; Set імен розгорнутих карток
// let expanded = new Set(managers);

// ❗ якщо хочеш щоб були згорнуті за замовчуванням — пиши так:
 let expanded = new Set();



  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.5);
    display:flex; align-items:center; justify-content:center;
  `;
  wrap.innerHTML = `
    <div class="bg-white text-black rounded-xl shadow-xl p-4 w-[min(680px,92vw)]">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h5 class="m-0">Налаштування відображення менеджерів</h5>
        <button class="btn btn-sm btn-outline-secondary" data-ao-close>✕</button>
      </div>

      <div class="mb-3">
        <label class="form-label">Додати менеджера</label>
        <div class="d-flex gap-2">
          <input type="text" class="form-control" placeholder="Ім’я менеджера" data-ao-add-name>
          <button class="btn btn-sm btn-outline-primary" data-ao-add>Додати</button>
        </div>
      </div>

<!-- Прокручувана зона зі списком менеджерів -->
<div class="mb-3" style="max-height:70vh;overflow:auto;border:1px solid #e5e7eb;border-radius:10px;padding:8px;background:#fafafa">
  <div data-ao-list></div>
</div>


      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-secondary" data-ao-close>Скасувати</button>
        <button class="btn btn-primary" data-ao-save>Зберегти</button>
      </div>
    </div>
  `;

  const list = wrap.querySelector('[data-ao-list]');
function renderRows() {
  list.innerHTML = managers.map(n => {
    const st = styles[n] || {};
    const isOpen = expanded.has(n);

    // дефолти для нових параметрів
    const fillOpacity = Number.isFinite(+st.fillOpacity) ? +st.fillOpacity : 100; // 0..100
    const noFill      = !!st.noFill;
    const padEnabled  = !!st.padEnabled;
    const padPx       = Number.isFinite(+st.padPx) ? +st.padPx : 8;              // 0..24

    const chevron = isOpen ? '▾' : '▸';

    // прев’ю бейджа (однорядкове)
    const previewStyle = aoStyleFor(n);
    const previewHtml  = `<span class="manager-badge" data-name="${n}" style="${previewStyle}">${n}</span>`;

    return `
      <div class="border rounded p-2 mb-2 ao-mgr-card" data-mgr="${n}">
        <!-- Хедер картки: кнопка-стрілка + прев’ю + Видалити -->
        <div class="d-flex justify-content-between align-items-center">
          <button type="button" class="btn btn-sm btn-light" data-ao-toggle="${n}"
                  style="min-width:40px">${chevron}</button>

          <div class="flex-1 px-2" data-ao-preview>${previewHtml}</div>

          <button class="btn btn-sm btn-outline-danger" data-ao-del="${n}">Видалити</button>
        </div>

        <!-- Тіло картки (налаштування) -->
        <div class="ao-mgr-body ${isOpen ? '' : 'd-none'}">
          <div class="row g-2 mt-2">
            <div class="col-6">
              <label class="form-label">Колір тексту</label>
              <input type="color" value="${st.color || '#111111'}"
                     data-ao-color="${n}" class="form-control form-control-color">
            </div>

            <div class="col-6">
              <label class="form-label">Заливка</label>
              <input type="color" value="${st.bg || '#ffffff'}"
                     data-ao-bg="${n}" class="form-control form-control-color" ${noFill ? 'disabled':''}>
              <div class="form-text">Для прозорої заливки очисти поле (двічі Backspace).</div>
            </div>

            <!-- ── Заливка: додаткові опції ───────────────────────── -->
            <div class="row g-2 align-items-center mt-2">
              <div class="col-12 col-md-4">
                <div class="form-check">
                  <input class="form-check-input js-mgr-no-fill" type="checkbox"
                         name="no_fill" data-ao-nofill="${n}" ${noFill ? 'checked':''}>
                  <label class="form-check-label">Без заливки</label>
                </div>
              </div>
              <div class="col-12 col-md-8">
                <label class="form-label d-flex justify-content-between align-items-center mb-1">
                  <span>Прозорість заливки</span>
                  <span><span class="js-mgr-fill-op-val" data-ao-fillopval="${n}">${fillOpacity}</span>%</span>
                </label>
                <input class="form-range js-mgr-fill-op" type="range" min="0" max="100" step="1"
                       value="${fillOpacity}" name="fill_opacity" data-ao-fillop="${n}">
              </div>
            </div>

            <hr class="my-2 opacity-25">

            <!-- ── Внутрішні відступи ─────────────────────────────── -->
            <div class="row g-2 align-items-center">
              <div class="col-12 col-md-5">
                <div class="form-check">
                  <input class="form-check-input js-mgr-pad-en" type="checkbox"
                         name="padding_enabled" data-ao-paden="${n}" ${padEnabled ? 'checked':''}>
                  <label class="form-check-label">Внутрішні відступи</label>
                </div>
              </div>
              <div class="col-12 col-md-7">
                <label class="form-label d-flex justify-content-between align-items-center mb-1">
                  <span>Розмір відступів</span>
                  <span><span class="js-mgr-pad-val" data-ao-padval="${n}">${padPx}</span> px</span>
                </label>
                <input class="form-range js-mgr-pad" type="range" min="0" max="24" step="1"
                       value="${padPx}" name="padding_px" data-ao-padpx="${n}" ${padEnabled ? '' : 'disabled'}>
              </div>
            </div>

            <div class="col-6">
              <div class="form-check mt-2">
                <input class="form-check-input" type="checkbox"
                       ${st.border ? 'checked':''} data-ao-border="${n}" id="chk-${n}">
                <label class="form-check-label" for="chk-${n}">Рамка навколо імені</label>
              </div>
            </div>

            <div class="col-6">
              <label class="form-label">Колір рамки</label>
              <input type="color" value="${st.borderColor || st.color || '#111111'}"
                     data-ao-bc="${n}" class="form-control form-control-color">
            </div>

            <div class="col-12">
              <label class="form-label">Скруглення (px)</label>
              <input type="number" min="0"
                     value="${Number.isFinite(+st.radius) ? st.radius : 10}"
                     data-ao-radius="${n}" class="form-control" />
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


  renderRows();

  // події
  wrap.addEventListener('click', (e) => {
    if (e.target.matches('[data-ao-close]')) wrap.remove();
    if (e.target.matches('[data-ao-del]')) {
      const name = e.target.getAttribute('data-ao-del');
      delete styles[name];
      const idx = managers.indexOf(name);
      if (idx >= 0) managers.splice(idx,1);
      renderRows();
    }

    // згортання/розгортання картки
    if (e.target.matches('[data-ao-toggle]')) {
      const name = e.target.getAttribute('data-ao-toggle');
      if (expanded.has(name)) expanded.delete(name); else expanded.add(name);
      renderRows();
      return;
    }




    if (e.target.matches('[data-ao-save]')) {
      // зчитуємо всі значення
      managers.forEach(n => {
        styles[n] = {
    color:       wrap.querySelector(`[data-ao-color="${n}"]`)?.value || '#111111',
    bg:          wrap.querySelector(`[data-ao-bg="${n}"]`)?.value || 'transparent',
    border:      wrap.querySelector(`[data-ao-border="${n}"]`)?.checked || false,
    borderColor: wrap.querySelector(`[data-ao-bc="${n}"]`)?.value || '#111111',
    radius:      parseInt(wrap.querySelector(`[data-ao-radius="${n}"]`)?.value || '10', 10),

    // 🔹 нові поля:
    noFill:      !!wrap.querySelector(`[data-ao-nofill="${n}"]`)?.checked,
    fillOpacity: parseInt(wrap.querySelector(`[data-ao-fillop="${n}"]`)?.value || '100', 10),
    padEnabled:  !!wrap.querySelector(`[data-ao-paden="${n}"]`)?.checked,
    padPx:       parseInt(wrap.querySelector(`[data-ao-padpx="${n}"]`)?.value || '8', 10),
  };
      });






      aoSaveStyles(styles);
      wrap.remove();
      // миттєво оновити бейджі у таблиці
      document.querySelectorAll('.manager-badge').forEach(el => {
        const name = el.dataset.name || el.textContent.trim();
        el.setAttribute('style', aoStyleFor(name));
      });
    }
    if (e.target.matches('[data-ao-add]')) {
      const inp = wrap.querySelector('[data-ao-add-name]');
      const name = (inp.value || '').trim();
      if (name && !managers.includes(name)) {
        managers.push(name);
        styles[name] = { ...(AO_DEFAULT_STYLES['Іван']) };
        inp.value = '';
        renderRows();
      }
    }

// прозорість
  if (e.target.matches('[data-ao-fillop]')) {
    const n = e.target.getAttribute('data-ao-fillop');
    const valEl = wrap.querySelector(`[data-ao-fillopval="${n}"]`);
    if (valEl) valEl.textContent = String(e.target.value);
  }

  // вкл/викл внутрішніх відступів
  if (e.target.matches('[data-ao-paden]')) {
    const n = e.target.getAttribute('data-ao-paden');
    const padRange = wrap.querySelector(`[data-ao-padpx="${n}"]`);
    const valEl = wrap.querySelector(`[data-ao-padval="${n}"]`);
    if (padRange) {
      if (e.target.checked) padRange.removeAttribute('disabled');
      else padRange.setAttribute('disabled','true');
    }
    if (valEl && padRange) valEl.textContent = String(padRange.value);
  }

  // "Без заливки" — блокуємо колорпікер
  if (e.target.matches('[data-ao-nofill]')) {
    const n = e.target.getAttribute('data-ao-nofill');
    const bgPicker = wrap.querySelector(`[data-ao-bg="${n}"]`);
    if (bgPicker) {
      if (e.target.checked) bgPicker.setAttribute('disabled','true');
      else bgPicker.removeAttribute('disabled');
    }
  }

  // рух слайдера паддінгів — оновимо підпис
  if (e.target.matches('[data-ao-padpx]')) {
    const n = e.target.getAttribute('data-ao-padpx');
    const valEl = wrap.querySelector(`[data-ao-padval="${n}"]`);
    if (valEl) valEl.textContent = String(e.target.value);
  }

// Після будь-якої зміни — оновити прев’ю в хедері цієї картки
const card = e.target.closest('.ao-mgr-card');
if (card) {
  const name = card.getAttribute('data-mgr');
  const previewHost = card.querySelector('[data-ao-preview]');
  if (name && previewHost) {
    // побудуємо стилі на льоту з поточних значень інпутів
    const getVal = (sel) => card.querySelector(sel)?.value;
    const getChk = (sel) => !!card.querySelector(sel)?.checked;

    const color       = getVal(`[data-ao-color="${name}"]`) || '#111111';
    const bgHex       = getVal(`[data-ao-bg="${name}"]`)    || '#ffffff';
    const noFill      = getChk(`[data-ao-nofill="${name}"]`);
    const fillOpacity = parseInt(card.querySelector(`[data-ao-fillop="${name}"]`)?.value || '100', 10);
    const border      = getChk(`[data-ao-border="${name}"]`);
    const borderColor = getVal(`[data-ao-bc="${name}"]`) || color;
    const radius      = parseInt(card.querySelector(`[data-ao-radius="${name}"]`)?.value || '10', 10);
    const padEnabled  = getChk(`[data-ao-paden="${name}"]`);
    const padPx       = parseInt(card.querySelector(`[data-ao-padpx="${name}"]`)?.value || '8', 10);

    const rgba = (hex, a = 1) => {
      const m = String(hex || '').replace('#','');
      const v = parseInt(m.length === 3 ? m.split('').map(c=>c+c).join('') : m, 16);
      const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    const bg = noFill ? 'transparent' : rgba(bgHex, Math.max(0, Math.min(100, fillOpacity)) / 100);

    const style = [
      `color:${color}`,
      `background:${bg}`,
      border ? `border:1px solid ${borderColor}` : 'border:none',
      `border-radius:${radius}px`,
      padEnabled ? `padding:${padPx}px` : 'padding:2px 8px'
    ].join(';');

    previewHost.innerHTML = `<span class="manager-badge" data-name="${name}" style="${style}">${name}</span>`;
  }
}








  });










  document.body.appendChild(wrap);
}

function aoOpenColumnsModal() {
  // беремо актуальний конфіг
  const cfg = colsLoad();

  // словничок label за key
  const labelByKey = {};
  (ALL_FIELDS || []).forEach(f => labelByKey[f.key] = f.label || f.key);

  // тулзи
  const up = (arr, i) => (i > 0) && ([arr[i-1], arr[i]] = [arr[i], arr[i-1]]);
  const down = (arr, i) => (i < arr.length - 1) && ([arr[i+1], arr[i]] = [arr[i], arr[i+1]]);

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.5);
    display:flex; align-items:center; justify-content:center;
  `;
  wrap.innerHTML = `
    
     <div class="bg-white text-black rounded-xl shadow-2xl w-[min(720px,94vw)]">
      <style>
        .ao-col-row{user-select:none;transition:transform .15s ease,background-color .15s ease,box-shadow .15s ease}
        .ao-col-row.dragging{opacity:.95;transform:scale(.995);background:#eef3ff;box-shadow:inset 0 0 0 2px rgba(138,180,248,.35)}
        .ao-drag-handle{cursor:grab}
        .ao-drag-handle:active{cursor:grabbing}
      </style>




      <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
        <h5 class="m-0">Налаштування колонок таблиці</h5>
        <button class="btn btn-sm btn-outline-secondary" data-ao-close>✕</button>
      </div>

      <div class="p-3" id="colsScroll" style="max-height:70vh;overflow:auto">
        <div class="text-muted mb-2" style="font-size:12px">Перетягай «⋮», або користуйся стрілками.</div>
        <div id="colsList"></div>
      </div>
 
      <div class="d-flex justify-content-end gap-2 p-3 border-top">
        <button class="btn btn-secondary" data-ao-close>Скасувати</button>
        <button class="btn btn-primary" data-ao-save-cols>Зберегти</button>
      </div>

    </div>
  `;

  const listEl = wrap.querySelector('#colsList');

  function renderList() {
  const rowsHtml = cfg.order.map((key, idx) => {
    const label = labelByKey[key] || key;
    const checked = cfg.visible[key] ? 'checked' : '';
    return `
      <div class="d-flex align-items-center justify-content-between border rounded px-2 py-1 mb-2 bg-light ao-col-row"
           data-key="${key}">
        <div class="d-flex align-items-center gap-3">
          <div class="text-muted" style="width:2rem;text-align:center">${idx+1}</div>
          <div>
            <div class="fw-semibold">${label}</div>
            <div class="text-muted" style="font-size:12px">${key}</div>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2">
          <div class="form-check form-switch me-1">
            <input class="form-check-input" type="checkbox" ${checked} data-ao-col-vis="${key}">
          </div>
          <div class="btn-group btn-group-sm me-1">
            <button type="button" class="btn btn-outline-secondary" data-ao-move-up="${key}">↑</button>
            <button type="button" class="btn btn-outline-secondary" data-ao-move-down="${key}">↓</button>
          </div>
          <!-- ручка для перетягування праворуч -->
          <button type="button" class="btn btn-outline-secondary btn-sm ao-drag-handle" draggable="true"
                  title="Перетягнути">
            ⋮
          </button>
        </div>
      </div>
    `;
  }).join('');
  listEl.innerHTML = rowsHtml || `<div class="text-muted">Немає колонок</div>`;
}


  renderList();

const scrollBox = wrap.querySelector('#colsScroll');
let dragKey = null;

// старт перетягування — тільки з ручки ⋮
listEl.addEventListener('dragstart', (e) => {
  const handle = e.target.closest('.ao-drag-handle');
  if (!handle) return; // тягнемо лише за ручку
  const row = handle.closest('.ao-col-row');
  dragKey = row?.getAttribute('data-key') || null;
  if (row && dragKey) {
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
  } else {
    e.preventDefault();
  }
});

// завершення — прибрати підсвітку
listEl.addEventListener('dragend', (e) => {
  const row = e.target.closest('.ao-col-row');
  row?.classList.remove('dragging');
  dragKey = null;
});

// допоміжна: елемент, ПІСЛЯ якого вставляємо
function getAfterElement(container, y) {
  const els = [...container.querySelectorAll('.ao-col-row:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const el of els) {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: el };
  }
  return closest.element;
}

// автоскрол під час перетягування
function autoScrollOnEdges(ev) {
  if (!scrollBox) return;
  const box = scrollBox.getBoundingClientRect();
  const edge = 28; // px — чутлива зона
  if (ev.clientY < box.top + edge)        scrollBox.scrollBy(0, -12);
  else if (ev.clientY > box.bottom - edge) scrollBox.scrollBy(0, 12);
}

listEl.addEventListener('dragover', (e) => {
  if (!dragKey) return;
  e.preventDefault();
  autoScrollOnEdges(e);
  const after = getAfterElement(listEl, e.clientY);
  const dragging = listEl.querySelector('.ao-col-row.dragging');
  if (!dragging) return;
  if (after == null) listEl.appendChild(dragging);
  else listEl.insertBefore(dragging, after);
});

listEl.addEventListener('drop', (e) => {
  if (!dragKey) return;
  e.preventDefault();
  // зчитати новий порядок з DOM
  cfg.order = [...listEl.querySelectorAll('.ao-col-row')].map(el => el.getAttribute('data-key'));
  renderList(); // перемалювати, щоб оновити нумерацію
});



  // події
  wrap.addEventListener('click', (e) => {
    if (e.target.matches('[data-ao-close]')) { wrap.remove(); return; }

    const upKey = e.target.getAttribute('data-ao-move-up');
    if (upKey) {
      const i = cfg.order.indexOf(upKey);
      if (i >= 0) up(cfg.order, i);
      renderList();
      return;
    }
    const downKey = e.target.getAttribute('data-ao-move-down');
    if (downKey) {
      const i = cfg.order.indexOf(downKey);
      if (i >= 0) down(cfg.order, i);
      renderList();
      return;
    }

    if (e.target.matches('[data-ao-save-cols]')) {
      // зчитуємо видимість (на випадок, якщо юзер клацав перед цим)
      listEl.querySelectorAll('[data-ao-col-vis]').forEach(inp => {
        const k = inp.getAttribute('data-ao-col-vis');
        cfg.visible[k] = !!inp.checked;
      });

      // зберегти
      colsSave(cfg);
      // застосувати до HEAD і перемалювати
      applyColumnsConfigToHead();
      render();
      wrap.remove();
      return;
    }
  });

  // чекбокси видимості (live)
  wrap.addEventListener('change', (e) => {
    if (e.target.matches('[data-ao-col-vis]')) {
      const k = e.target.getAttribute('data-ao-col-vis');
      cfg.visible[k] = !!e.target.checked;
    }
  });

  document.body.appendChild(wrap);
}







//====================================================================================================
//====================================================================================================












  // ✅ Безпечний тост: не впаде, якщо showToast відсутній
function safeToast(msg) {
  try {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log('[toast]', msg);
    }
  } catch (_) {
    /* ігноруємо */
  }
}

  // ---- 4) Утиліти ----
  const $  = sel => (root === document ? document.querySelector(sel) : root.querySelector(sel));
  // 🔧 Універсальний getter: працює з об'єктами нового бекенду і зі старими масивами (якщо колись будуть)


function applyStatusUI(orderGroup, newStatus) {
  // пігулка в таблиці
  const pill = document.getElementById(`status-pill-${orderGroup}`);
  if (pill) {
    const label = pill.querySelector('[data-label]');
    if (label) label.textContent = newStatus;
   const ok = ['Відправлено','В дорозі','Прибув у відділення','Отримано']
  .includes(canonStatus(newStatus));




    pill.classList.toggle('border-emerald-500/30', ok);
    pill.classList.toggle('bg-emerald-500/10', ok);
    pill.classList.toggle('text-emerald-300', ok);
    pill.classList.toggle('border-zinc-600/30', !ok);
    pill.classList.toggle('bg-zinc-800/50', !ok);
    pill.classList.toggle('text-zinc-300', !ok);
    const dot = pill.querySelector('.status-dot');
    if (dot) {
      dot.classList.toggle('bg-emerald-400', ok);
      dot.classList.toggle('bg-zinc-500', !ok);
    }
  }
  // статус у деталях (нижній блок)
  const detailStatus = document.getElementById(`status-${orderGroup}`);
  if (detailStatus) detailStatus.textContent = newStatus;
}

// 1) беремо URL GAS з уже підвантажених конфігів (з KV)
// ✅ 1) URL GAS із конфігів або з глобалки в index.html
function getNpGasUrl() {
  return (
    (window.APP_CFG && (window.APP_CFG.SHEETS_WEBAPP_URL || window.APP_CFG['SHEETS_WEBAPP_URL'])) ||
    window.SHEETS_WEBAPP_URL ||   // ⬅️ беремо з <script> у index.html
    ''
  ).trim();
}




// 2) простий JSONP-хелпер (щоб не було CORS)
function jsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    params.callback = cb;
    const qs = new URLSearchParams(params);
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + qs.toString();
    s.onerror = () => { delete window[cb]; s.remove(); reject(new Error('JSONP network error')); };
    window[cb] = (data) => { delete window[cb]; s.remove(); resolve(data); };
    document.head.appendChild(s);
  });
}

// 3) виклик GAS для трекінгу НП
// ✅ 2) Трекінг НП: спочатку JSONP (без CORS), якщо впало — фолбек через fetch

async function npTrackViaGAS({ ttn, phone = '', orderGroup = '' }) {
  const gasUrl = getNpGasUrl();
  if (!gasUrl) throw new Error('SHEETS_WEBAPP_URL не знайдено у конфігах');

  // 2.1) пробуємо JSONP
  try {
    const res = await jsonp(gasUrl, {
      mode: 'np-track',
      ttn,
      phone,
      order_group: orderGroup
    });
    const status = res.status ?? res.statusText ?? '';
    return { ...res, status };
  } catch (e) {
    // 2.2) фолбек: звичайний GET (спрацює, якщо на GAS дозволено CORS)
    const u = new URL(gasUrl);
    u.searchParams.set('mode', 'np-track');
    u.searchParams.set('ttn', ttn);
    u.searchParams.set('phone', phone);
    u.searchParams.set('order_group', orderGroup);

    const r = await fetch(u.toString(), { method: 'GET', credentials: 'omit' });
    const data = await r.json();
    const status = data.status ?? data.statusText ?? '';
    return { ...data, status };
  }
}








function get(field, row, idxMap) {
  if (!row) return '';

  // Точна відповідність за реальною схемою (з твого JSON)
  const alias = {
    // ідентифікатори та дати
    id_m:           ['id_month'],
    id_zm:          ['id_manager'],
    imya_m:         ['manager'],
    date:           ['created_at'],

    // отримувач
    recipient_last:   ['surname'],
    recipient_first:  ['name'],
    recipient_middle: ['patronymic'],
    phone:            ['number'],
    email:            ['email'],

    // адреса / НП
    region:           ['region'],
    district:         ['district'],
    city:             ['city'],
    street:           ['street'],
    warehouse:        ['warehouse'],          // якщо порожньо — зліпимо з двох нижніх
    warehouseNumber:  ['warehouseNumber'],
    warehouseType:    ['warehouseType'],

    // замовлення / товар (позиції)
    marketplace: ['marketplace'],
    item:        ['product'],
    size:        ['size'],
    description: ['description'],
    comment:     ['comment'],

    // фінанси (по позиції)
    purchase:    ['buy'],
    margin_item: ['margin'],
    price_item:  ['price'],

    // фінанси (по замовленню)
    drop:              ['totalPurchaseSum'],
    totalPurchaseSum:  ['totalPurchaseSum'],
    totalMarginSum:    ['totalMarginSum'],
    sale:              ['sale'],
    forClient:         ['forClient','sale'],
    profit:            ['profit'],
    clientSettlement:  ['clientSettlement'],
    discount:          ['discount'],
    prepay:            ['prepay'],
    paidDelivery:      ['paidDelivery'],
    olxDelivery:       ['olxDelivery'],
    promDelivery:      ['promDelivery'],

    // інше
    ttn:          ['ttn'],
    post:         ['post'],
    status:       ['shipStatus'],            // ← статус тут
    order_group:  ['order_group'],

    // для сумісності зі старими місцями у коді:
    idManager:    ['id_manager']
  };

  // сучасний випадок: рядок — об'єкт
  if (typeof row === 'object' && !Array.isArray(row)) {
    const mapVal  = alias[field] ?? [field];
    const tryKeys = Array.isArray(mapVal) ? mapVal : [mapVal];

    let val;
    for (const k of tryKeys) {
      if (k in row && row[k] != null && String(row[k]) !== '') {
        val = row[k];
        break;
      }
    }

    // якщо warehouse порожній — зібрати з number + type
    if ((field === 'warehouse' || field === 'warehouseFull') && (val == null || val === '')) {
      const num = row['warehouseNumber'] ?? '';
      const typ = row['warehouseType'] ?? '';
      if (num || typ) {
        val = [String(num || '').trim(), String(typ || '').trim()]
              .filter(Boolean)
              .map((s,i)=> i===1 && s && s!=='невідомий тип' ? `(${s})` : s)
              .join(' ');
      }
    }

    // дата -> Date
    if ((field === 'date' || tryKeys.includes('created_at')) && val) {
      try { val = new Date(val); } catch (_) {}
    }

    return val ?? '';
  }

  // старий формат «масиву» (про всяк випадок)
  if (Array.isArray(row) && idxMap && field in idxMap) {
    return row[idxMap[field]];
  }

  return '';
}

  const money = (v, { symbol = true } = {}) => {
  const n = Number(String(v).replace(/[^\d.,-]/g,'').replace(',','.'));
  return isNaN(n) ? (v || '—') : (symbol ? '₴' : '') + n.toLocaleString('uk-UA');
};
  const fmtDate = s => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? String(s) :
      d.toLocaleString('uk-UA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  };

  //- вивід довару у додаткову таблицю-------
  const escapeHtml = s => String(s).replace(/[&<>"']/g,
    m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function matchesStatus(row){
  const rowCanon = canonStatus(getStatusValue(row));

  // якщо нічого не вибрано — показуємо все (незалежно від інверсії)
  if (!filterStatuses || filterStatuses.size === 0) return true;

  // звичайний режим: залишаємо тільки вибране
  if (!invertStatusFilter) {
    for (const sel of filterStatuses) {
      const selCanon = canonStatus(sel);
      if (rowCanon === '__EMPTY__' && selCanon === '__EMPTY__') return true;
      if (rowCanon === selCanon) return true;
    }
    return false;
  }

  // режим інверсії: виключаємо вибране
  let isSelected = false;
  for (const sel of filterStatuses) {
    const selCanon = canonStatus(sel);
    if (rowCanon === '__EMPTY__' && selCanon === '__EMPTY__') { isSelected = true; break; }
    if (rowCanon === selCanon) { isSelected = true; break; }
  }
  return !isSelected;
}




function matchesManager(row) {
  if (!filterManagers || filterManagers.size === 0) return true; // показувати всі
  const name = String(get('imya_m', row) || '').trim();
  if (name === '' && filterManagers.has('__EMPTY__')) return true; // на випадок, якщо додаси “Без менеджера”
  return filterManagers.has(name);
}



// ==== Дата-фільтр (постійний, у localStorage) ==============================
const AO_DATE_KEY = 'allOrders.dateFilter.v1';

function dateFilterLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(AO_DATE_KEY) || '{}') || {};
    return {
      all:  raw.all ?? true,
      from: raw.from || '',   // 'YYYY-MM-DD' або ''
      to:   raw.to   || ''    // 'YYYY-MM-DD' або ''
    };
  } catch {
    return { all:true, from:'', to:'' };
  }
}
function dateFilterSave(f) {
  localStorage.setItem(AO_DATE_KEY, JSON.stringify(f || {all:true}));
}

// парсимо лише дату (без часу)
function parseDateOnly(s) {
  if (!s) return null;
  const [y,m,d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m-1, d);
  return isNaN(+dt) ? null : dt;
}

// поточний стан фільтра
let dateFilter = dateFilterLoad();

// звірка рядка проти обраного діапазону
function matchesDate(row) {
  const f = dateFilter;
  if (!f || f.all) return true;

  let dv = get('date', row);                 // у твоєму get() created_at вже перетворюється на Date
  let d  = (dv instanceof Date) ? dv : new Date(dv);
  if (isNaN(+d)) return true;                // якщо дату не розпізнали — не відфільтровуємо

  if (f.from) {
    const df = parseDateOnly(f.from);
    if (df && d < new Date(df.getFullYear(), df.getMonth(), df.getDate(), 0,0,0,0)) return false;
  }
  if (f.to) {
    const dt = parseDateOnly(f.to);
    if (dt && d > new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23,59,59,999)) return false;
  }
  return true;
}

// UI кнопка + модалка
function ensureDateFilterUI(anchorEl) {
  if (!anchorEl) return;
  // контейнер переданий із місця, де є статус/менеджер
  anchorEl.innerHTML = `
    <div class="relative inline-block mr-2">
      <button id="dateBtn" type="button"
        class="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800">
        <span class="text-zinc-300" data-label></span>
        <svg class="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>
      </button>
    </div>
  `;

  const btn     = anchorEl.querySelector('#dateBtn');
  const labelEl = anchorEl.querySelector('[data-label]');

  const setLabel = () => {
    if (!dateFilter || dateFilter.all) {
      labelEl.textContent = 'Дата: всі';
    } else {
      const a = dateFilter.from || '…';
      const b = dateFilter.to   || '∞';
      labelEl.textContent = `Дата: ${a} — ${b}`;
    }
  };
  setLabel();

  btn.addEventListener('click', openDateModal);

  function openDateModal() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.5);
      display:flex; align-items:center; justify-content:center; padding:16px;
    `;
    wrap.innerHTML = `
      <div class="bg-white text-black rounded-xl shadow-2xl w-[min(640px,94vw)]">
        <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
          <h5 class="m-0">Фільтр за датою</h5>
          <button class="btn btn-sm btn-outline-secondary" data-close>✕</button>
        </div>

        <div class="p-3" style="max-height:70vh;overflow:auto">
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="df-all" ${dateFilter.all ? 'checked':''}>
            <label class="form-check-label" for="df-all">Показати всі</label>
          </div>

          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label">З якої дати</label>
              <input type="date" class="form-control" id="df-from" value="${dateFilter.from || ''}">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label">По яку дату</label>
              <input type="date" class="form-control" id="df-to"   value="${dateFilter.to   || ''}">
              <div class="form-text">Якщо «по дату» не обрано — показуємо до останнього замовлення.</div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 p-3 border-top">
          <button class="btn btn-secondary" data-close>Скасувати</button>
          <button class="btn btn-primary" data-save>Зберегти</button>
        </div>
      </div>
    `;

    const chkAll = wrap.querySelector('#df-all');
    const inpFrom= wrap.querySelector('#df-from');
    const inpTo  = wrap.querySelector('#df-to');

    const toggle = () => {
      const dis = chkAll.checked;
      inpFrom.disabled = dis;
      inpTo.disabled   = dis;
    };
    toggle();

    wrap.addEventListener('change', (e) => {
      if (e.target === chkAll) toggle();
    });

    wrap.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) { wrap.remove(); return; }

      if (e.target.matches('[data-save]')) {
        if (chkAll.checked) {
          dateFilter = { all:true, from:'', to:'' };
        } else {
          let from = (inpFrom.value || '').trim();
          let to   = (inpTo.value   || '').trim();

          // якщо обидві є і переплутані — міняємо місцями
          if (from && to && parseDateOnly(from) > parseDateOnly(to)) {
            const t = from; from = to; to = t;
          }
          dateFilter = { all:false, from, to };
        }

        dateFilterSave(dateFilter);
        setLabel();
        render();           // перерисовуємо таблицю з урахуванням фільтра дати
        wrap.remove();
      }
    });

    document.body.appendChild(wrap);
  }
}




  // ---- 5) Елементи ----
  const headEl   = $('#ordersHead');
  const bodyEl   = $('#ordersBody');
  const tableBox = headEl ? headEl.parentElement : null; // спільний контейнер (2-й блок у віджеті)
 




  // === Автовисота тіла віджета під поточне вікно ===






// робимо контейнер «колонкою» і задаємо відступ для липкої шапки
function enableStickyHead(){
  const scroller = document.getElementById('ordersScroll');
  if (scroller){
    scroller.style.overflowY = 'auto';   // єдиний скрол
    scroller.style.minHeight = '0';
    scroller.style.height = '100%';
    scroller.classList.add('ao-table');  // просто мітка
  }
  if (bodyEl){
    bodyEl.style.minHeight = '0';
    bodyEl.style.overflowY = 'visible';  // ВАЖЛИВО: без внутрішнього скролу
  }
}


// викликаємо одразу і на ресайз
enableStickyHead();
window.addEventListener('resize', enableStickyHead);



  const searchEl = $('#searchBox');
  const statusEl = $('#statusFilter');

// ▼ ЯКІР ДЛЯ КНОПКИ "Дата"
const dateWrap = document.createElement('div');
dateWrap.id = 'dateFilterWrap';
if (statusEl) statusEl.insertAdjacentElement('beforebegin', dateWrap);



// ▼▼ Фільтр менеджерів (мультивибір) ▼▼
let filterManagers = new Set();   // порожній = усі менеджери
let MANAGERS = [];                // актуальний список імен

// Створимо місце перед статусом
const managerWrap = document.createElement('div');
managerWrap.id = 'managerFilterWrap';
if (statusEl) {
  statusEl.insertAdjacentElement('beforebegin', managerWrap);
}

  let DATA = [];
  let search = '';
  let filterStatuses = new Set(); // порожній набір = показувати всі
  let invertStatusFilter = false; // ← ДОДАЛИ: інверсія статус-фільтра



// ---- Статуси як чекбокс-дропдаун ----
const ALL_STATUSES = [
  'Виготовляється',
  'Комплектується',
  'Відправлено',
  'В дорозі',
  'Прибув у відділення',
  'Отримано',
  'Відмова',
  '__EMPTY__' // ← Без статусу
];

buildStatusDropdown();
buildManagerDropdown();
ensureDateFilterUI(dateWrap);   // ← кнопка "Дата" поруч із іншими фільтрами
aoEnsureStarButton();           


function buildStatusDropdown() {
  if (!statusEl) return;

  // ховаємо старий <select id="statusFilter">
  statusEl.style.display = 'none';

  // контейнер поруч зі старим елементом
  const wrap = document.createElement('div');
  wrap.id = 'statusFilterWrap';
  wrap.className = 'relative';
  statusEl.insertAdjacentElement('afterend', wrap);

  wrap.innerHTML = `
    <button id="statusBtn" type="button"
      class="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800">
      <span class="text-zinc-300" data-label>Статус: всі</span>
      <svg class="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>
    </button>

    <div id="statusMenu"
         class="absolute right-0 z-[10050] mt-1 hidden w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
      <div class="max-h-64 overflow-auto pr-1" data-list></div>

      <!-- розділювач + ІНВЕРСІЯ -->
      <div class="mt-2 border-t border-zinc-700 pt-2">
        <label class="flex items-center gap-2 rounded px-2 py-1">
          <input type="checkbox" id="statusInvert" class="accent-emerald-500">
          <span class="text-xs uppercase tracking-wider">ІНВЕРСІЯ</span>
        </label>
      </div>

      <div class="mt-2 flex items-center justify-between">
        <button type="button" data-clear
                class="text-xs text-zinc-400 hover:text-zinc-200">Очистити</button>
        <button type="button" data-close
                class="rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">OK</button>
      </div>
    </div>
  `;

  const btn     = wrap.querySelector('#statusBtn');
  const menu    = wrap.querySelector('#statusMenu');
  const list    = menu.querySelector('[data-list]');
  const labelEl = btn.querySelector('[data-label]');
  const invertCb= menu.querySelector('#statusInvert');

  function renderList() {
    list.innerHTML = ALL_STATUSES.map(v => {
      const txt = (v === '__EMPTY__') ? 'Без статусу' : v;
      const checked = filterStatuses.size && filterStatuses.has(v) ? 'checked' : '';
      return `
        <label class="flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800">
          <input type="checkbox" value="${v}" class="accent-emerald-500" ${checked}>
          <span class="text-sm">${txt}</span>
        </label>`;
    }).join('');
    // синхронізуємо стан інверсії
    invertCb.checked = !!invertStatusFilter;
  }

  function updateLabel() {
    const inv = invertStatusFilter ? ' (інверсія)' : '';
    if (!filterStatuses.size) { labelEl.textContent = `Статус: всі${inv}`; return; }
    const arr = Array.from(filterStatuses).map(v => v === '__EMPTY__' ? 'Без статусу' : v);
    labelEl.textContent = (arr.length === 1)
      ? `Статус: ${arr[0]}${inv}`
      : `Статуси: ${arr.length}${inv}`;
  }

  renderList();
  updateLabel();

  // відкриття/закриття
  const close = () => menu.classList.add('hidden');
  btn.addEventListener('click', () => menu.classList.toggle('hidden'));
  document.addEventListener('click', (ev) => { if (!wrap.contains(ev.target)) close(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  menu.querySelector('[data-close]').addEventListener('click', close);

  // зміни чекбоксів
  menu.addEventListener('change', (e) => {
    // інверсія
    if (e.target.matches('#statusInvert')) {
      invertStatusFilter = !!e.target.checked;
      updateLabel();
      render();
      return;
    }

    // звичайні пункти статусів
    if (e.target.matches('input[type=checkbox][value]')) {
      const v = e.target.value;
      if (e.target.checked) filterStatuses.add(v);
      else filterStatuses.delete(v);
      updateLabel();
      render();
    }
  });

  // Очистити = прибрати всі пункти (інверсію не чіпаємо)
  menu.querySelector('[data-clear]').addEventListener('click', () => {
    filterStatuses.clear();
    [...menu.querySelectorAll('input[type=checkbox][value]')].forEach(i => i.checked = false);
    updateLabel();
    render();
  });
}


function buildManagerDropdown() {
  if (!managerWrap) return;

  // 1) зібрати унікальні імена менеджерів з DATA
  const set = new Set();
  (DATA || []).forEach(r => {
    const m = String(get('imya_m', r) || '').trim();
    if (m) set.add(m);
  });
  // фолбек — збережені стилі (якщо даних ще нема)
  if (set.size === 0) {
    Object.keys(aoLoadStyles()).forEach(k => set.add(k));
  }

  MANAGERS = Array.from(set).sort((a,b) => a.localeCompare(b,'uk'));

  // 2) розмітка випадайки
  managerWrap.innerHTML = `
    <div class="relative inline-block mr-2">
      <button id="managerBtn" type="button"
        class="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800">
        <span class="text-zinc-300" data-label>Менеджер: всі</span>
        <svg class="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>
      </button>

      <div id="managerMenu"
           class="absolute z-[10050] mt-1 hidden w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
        <div class="max-h-64 overflow-auto pr-1" data-list></div>
        <div class="mt-2 flex items-center justify-between">
          <button type="button" data-clear class="text-xs text-zinc-400 hover:text-zinc-200">Усі замовлення</button>
          <button type="button" data-close class="rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">OK</button>
        </div>
      </div>
    </div>
  `;

  const btn     = managerWrap.querySelector('#managerBtn');
  const menu    = managerWrap.querySelector('#managerMenu');
  const list    = managerWrap.querySelector('[data-list]');
  const labelEl = managerWrap.querySelector('[data-label]');

  const renderList = () => {
    list.innerHTML = MANAGERS.map(name => {
      const checked = filterManagers.size && filterManagers.has(name) ? 'checked' : '';
      return `
        <label class="flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800">
          <input type="checkbox" value="${name}" class="accent-emerald-500" ${checked}>
          <span class="text-sm">${name}</span>
        </label>`;
    }).join('') || `<div class="text-zinc-400 text-sm px-2 py-1">Менеджерів не знайдено</div>`;
  };

  const updateLabel = () => {
    if (!filterManagers.size) { labelEl.textContent = 'Менеджер: всі'; return; }
    const arr = Array.from(filterManagers);
    labelEl.textContent = (arr.length === 1) ? `Менеджер: ${arr[0]}` : `Менеджери: ${arr.length}`;
  };

  renderList();
  updateLabel();

  // відкриття/закриття
  const close = () => menu.classList.add('hidden');
  btn.addEventListener('click', () => menu.classList.toggle('hidden'));
  document.addEventListener('click', (ev) => { if (!managerWrap.contains(ev.target)) close(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  menu.querySelector('[data-close]').addEventListener('click', close);

  // зміни чекбоксів
  menu.addEventListener('change', (e) => {
    if (e.target.matches('input[type=checkbox]')) {
      const v = e.target.value;
      if (e.target.checked) filterManagers.add(v);
      else filterManagers.delete(v);
      updateLabel();
      render();
    }
  });

  // “Усі замовлення” = очистити вибір
  menu.querySelector('[data-clear]').addEventListener('click', () => {
    filterManagers.clear();
    [...menu.querySelectorAll('input[type=checkbox]')].forEach(i => i.checked = false);
    updateLabel();
    render();
  });
}











  // ---- 6) Дані ----
// ---- 6) Дані ----

//---------------------------------------------------------------------------------------------------------------

//---------------------------------------------------------------------------------------------------------------
async function loadOrders() {
  try {
    const res = await fetch(`${ORDERS_URL}&_=${Date.now()}`, {
      method: 'GET', credentials: 'omit', cache: 'no-store'
    });
    const payload = await res.json();

    // 1) Розгорнути відповідь у масив
    let rows =
      Array.isArray(payload)        ? payload :
      Array.isArray(payload.orders) ? payload.orders :
      Array.isArray(payload.data)   ? payload.data :
      Array.isArray(payload.rows)   ? payload.rows :
      Array.isArray(payload.items)  ? payload.items : [];

    if (!Array.isArray(rows)) throw new Error('Unexpected payload shape');

    // 2) (опційно) пропустити кілька перших рядків аркуша
    //    Якщо хочеш завжди стартувати з 3-го рядка — лиши 2.
    const SKIP_LEADING_ROWS = 0;  // ← постав 2, якщо треба з 3-го
    if (SKIP_LEADING_ROWS > 0) rows = rows.slice(SKIP_LEADING_ROWS);

    // 3) Прибрати шапку, якщо вона все ще першим елементом
    const first = rows[0];
    const looksLikeHeader = (() => {
      if (!first) return false;
      if (Array.isArray(first)) {
        const s = first.join('|').toLowerCase();
        return /id_zm|ім'я|прізвище|населен/i.test(s);
      }
      if (typeof first === 'object') {
        const vals = Object.values(first).map(v => String(v ?? '').toLowerCase());
        return vals.some(v => /id_zm|ім'я|прізвище|населен/i.test(v));
      }
      return false;
    })();
    if (looksLikeHeader) rows = rows.slice(1);

    // 4) Викинути по-справжньому порожні рядки (розділювачі)
    const isTrulyEmpty = (r) => {
      if (!r) return true;
      if (Array.isArray(r)) return r.every(v => String(v ?? '').trim() === '');
      if (typeof r === 'object') return Object.values(r).every(v => String(v ?? '').trim() === '');
      return false;
    };
    rows = rows.filter(r => !isTrulyEmpty(r));

    // 5) Зберегти та рендерити
    DATA = rows;
    render();

//================================================================================================================

//================================================================================================================

    // ✅ ось тут, після того як є дані
    buildManagerDropdown();




  } catch (err) {
    console.error('Orders fetch failed', err);
    if (typeof window.showToast === 'function') window.showToast('Помилка завантаження даних');
    render([]); // щоб інтерфейс не падав
  }
}







  // ---- 7) Рендер ----
function render() {
  if (!headEl || !bodyEl) return;

  // 1) Колонки та сітка
  const cols = HEAD.map(k => ALL_FIELDS.find(f => f.key === k)).filter(Boolean);
  const template = cols.map(c => c.width || 'auto').join(' ');
  const statusColIndex = cols.findIndex(c => c.key === 'status'); // ← індекс колонки "статус" (0-based)

  // 2) Шапка
  headEl.style.display = 'grid';
  headEl.style.gridTemplateColumns = template;
  headEl.style.gap = '12px';
  headEl.innerHTML = cols.map(c => `<div class="whitespace-nowrap">${c.label}</div>`).join('');

  // 3) Групи + фільтри
  const groups = buildOrderGroups()
    .filter(g => matchesDate(g.head))
    .filter(g => matchesManager(g.head))
    .filter(g => matchesStatus(g.head))
    .filter(g => !search || groupSearchString(g).includes(search.toLowerCase()));

  // 4) Очищення тіла перед рендером
  bodyEl.innerHTML = '';
  const frag = document.createDocumentFragment();

  // 5) Рядки
  for (const g of groups) {
    const row = g.head || g.rows?.[0] || {};

    const rowHtml = cols.map(c => {
      const cls =
        c.align === 'right' ? 'text-right' :
        c.align === 'center' ? 'text-center' : '';
      const val = formatCell(c.key, row, g.rows);   // тут генерується .send-tpl (іконка телеграма)
      return `<div class="${cls}">${val}</div>`;
    }).join('');

    const wrap = document.createElement('div');
    wrap.className = 'border-t border-zinc-800';
    wrap.innerHTML = `
      <button class="w-full grid items-start px-4 py-3 text-sm hover:bg-zinc-900 transition"
              style="grid-template-columns:${template};column-gap:12px" data-row>
        ${rowHtml}
      </button>
      <div class="hidden px-4 pb-4" data-details>${renderDetails(row)}</div>
    `;

    // data-* для модалки та віджета
    const rowBtn = wrap.querySelector('[data-row]');
    if (rowBtn) {
      rowBtn.classList.add('order-row');

      const orderId   = String(get('order_group', row) || get('id', row) || '');
      const groupRows = g.rows || [];

      rowBtn.dataset.orderId      = orderId;
      rowBtn.dataset.order_group  = orderId;
      rowBtn.dataset.idManager    = get('id_zm', row) || '';

      rowBtn.dataset.recipient_last   = get('recipient_last',  row) || '';
      rowBtn.dataset.recipient_first  = get('recipient_first', row) || '';
      rowBtn.dataset.recipient_middle = get('recipient_middle',row) || '';
      rowBtn.dataset.clientName       =
        [rowBtn.dataset.recipient_last, rowBtn.dataset.recipient_first].filter(Boolean).join(' ');
      rowBtn.dataset.clientFullName   =
        [rowBtn.dataset.recipient_last, rowBtn.dataset.recipient_first, rowBtn.dataset.recipient_middle]
        .filter(Boolean).join(' ');

      rowBtn.dataset.email       = get('email', row) || '';
      rowBtn.dataset.phone       = get('phone', row) || get('number', row) || '';
      rowBtn.dataset.city        = get('city', row) || '';
      rowBtn.dataset.region      = get('region', row) || '';
      rowBtn.dataset.district    = get('district', row) || '';
      rowBtn.dataset.street      = get('street', row) || '';
      rowBtn.dataset.npwarehouse = get('warehouse', row) || '';
      rowBtn.dataset.warehouseNumber = get('warehouseNumber', row) || get('warehouse', row) || '';
      rowBtn.dataset.warehouseType   = get('warehouseType', row) || '';

      const ttnFromGroup = get('ttn', row) || (groupRows.map(r => get('ttn', r)).find(Boolean) || '');
      rowBtn.dataset.ttn         = ttnFromGroup;
      rowBtn.dataset.payment     = get('post', row) || '';
      rowBtn.dataset.priceClient = get('forClient', row) || get('sale', row) || '';
      rowBtn.dataset.drop        = get('drop', row) || get('totalPurchaseSum', row) || '';
      rowBtn.dataset.status      = get('status', row) || '';
      rowBtn.dataset.comment     = get('comment', row) || '';
      rowBtn.dataset.note        = get('comment', row) || '';
      rowBtn.dataset.createdAt   = fmtDate(get('date', row) || '');

      if (typeof buildItemsListForOrder === 'function') {
        rowBtn.dataset.itemsList = buildItemsListForOrder(orderId);
      }
    }

    frag.appendChild(wrap);
  }

  // 6) Вставляємо всі рядки
  bodyEl.appendChild(frag);

  // 7) Піджати висоту/скрол (якщо функція існує в проєкті)
  if (typeof sizeOrders === 'function') {
    try { sizeOrders(); } catch (e) { console.warn('[all-orders] sizeOrders() failed:', e); }
  }

  // 8) Підключаємо віджет НП (enable у IIFE, mount — нижче)
  (function initNpWidget() {
    // === допоміжне: знайти клітинку "статусу" у конкретному рядку ===
    function findStatusCellIn(rowRoot) {
      // 1) найочевидніші маркери
      let cell =
        rowRoot.querySelector('[data-col="status"]') ||
        rowRoot.querySelector('.order-status') ||
        rowRoot.querySelector('.status-cell');

      // 2) резерв: беремо N-ту "клітинку" в грід-кнопці за індексом колонки
      if (!cell && statusColIndex >= 0) {
        const gridBtn = rowRoot.matches('[data-row]') ? rowRoot : rowRoot.querySelector('[data-row]');
        if (gridBtn && gridBtn.children && gridBtn.children.length > statusColIndex) {
          cell = gridBtn.children[statusColIndex];
        }
      }
      return cell || null;
    }

    // === допоміжне: безпечно оновити текст усередині пігулки ===
    function setPillText(pillEl, text) {
      const txtHolder =
        pillEl.querySelector('.chip-text, .pill-text, .badge-text') ||
        pillEl;
      txtHolder.textContent = text;
    }

    // 8.1) Вмикаємо глобальний обробник кліку «НП» (idempotent — без дублювань)
  if (window.NPTrackWidget?.enable) {
  window.NPTrackWidget.enable({
    onApplyStatus(orderGroup, crmStatus) {
      const og = String(orderGroup || '');

      // 1) знайти рядок
      const row =
        document.querySelector(`[data-row][data-order_group="${og}"]`) ||
        document.querySelector(`[data-row][data-orderid="${og}"]`) ||
        document.querySelector(`[data-row][data-orderId="${og}"]`);
      if (!row) {
        console.warn('[NP-Track] Не знайшов рядок для order_group =', og);
        return;
      }

      // 2) оновити dataset
      row.dataset.status = crmStatus;

      // 3) знайти клітинку статусу
      let cell =
        row.querySelector('[data-col="status"]') ||
        row.querySelector('.order-status') ||
        row.querySelector('.status-cell');

      if (!cell && typeof statusColIndex === 'number' && statusColIndex >= 0) {
        const gridBtn = row.matches('[data-row]') ? row : row.querySelector('[data-row]');
        if (gridBtn && gridBtn.children && gridBtn.children.length > statusColIndex) {
          cell = gridBtn.children[statusColIndex];
        }
      }
      if (!cell) {
        console.warn('[NP-Track] Клітинку статусу не знайдено (og =', og, ')');
        return;
      }

      // 4) зберегти hidden, повністю очистити клітинку і повернути hidden назад
      const hidden = cell.querySelector('input[type="hidden"][name="status"]') || null;
      while (cell.firstChild) cell.removeChild(cell.firstChild);
      if (hidden) cell.appendChild(hidden);

      // 5) створити пігулку
      const pill = document.createElement('span');
      pill.className = 'pill inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-xs text-zinc-100';

      // 6) колір під статус
      const colorMap = {
        'Отримано'      : 'bg-green-700',
        'На відділенні' : 'bg-amber-700',
        'У дорозі'      : 'bg-blue-700',
        'Оформлено'     : 'bg-slate-700',
        'Відмова'       : 'bg-rose-700',
        'Повернення'    : 'bg-zinc-700',
      };
      pill.classList.add(colorMap[crmStatus] || 'bg-zinc-800');

      // 7) текст і вставка
      pill.textContent = crmStatus || '—';
      cell.appendChild(pill);

      // 8) синхронізувати hidden, якщо він є
      if (hidden) hidden.value = crmStatus;
    }
  });
}

  })();

  // 8.2) Монтуємо кнопку «НП» ПІСЛЯ того, як рядки вже в DOM (щоб не промахнутись по якорях)
  queueMicrotask(() => {
    if (window.NPTrackWidget?.mount) {
      window.NPTrackWidget.mount({
        root: bodyEl,
        anchorSelector: '.send-tpl', // або null — тоді віджет сам знайде якір серед типових селекторів
        mountStrategy: 'after'
      });
    } else if (window.NPTrackWidget?.init) {
      // fallback, якщо у віджета є тільки init()
      window.NPTrackWidget.init({
        root: bodyEl,
        anchorSelector: '.send-tpl',
        mountStrategy: 'after'
      });
    }
  });
}







// ДОДАЙ вище (перед formatCell) — одна константа з іконкою
const NP_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
  <path d="M3 7h13l5 4-5 4H3z"/>
  <path d="M3 7l8 6 5-3.5"/>
</svg>`;

const SEND_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
  <path d="M22 2 11 13"/>
  <path d="M22 2 15 22l-4-9-9-4 20-7z"/>
</svg>`;

 const TELEGRAM_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
  <path d="M22 3 11 14" />
  <path d="M22 3 15 21l-3.5-8.5L3 9z" />
</svg>`;





function formatCell(key, row, groupRows = []) {
  // ——— Отримувач: Прізвище + Ім'я (без по батькові)

// ——— Ім'я менеджера (з локальними стилями)
if (key === 'imya_m') {
  const name = get('imya_m', row) || '';
  const safe = escapeHtml(name);
  return `<span class="manager-badge" data-name="${safe}" style="${aoStyleFor(name)}">${safe || '—'}</span>`;
}




  if (key === 'recipient') {
    const last  = escapeHtml(get('recipient_last',  row) || '');
    const first = escapeHtml(get('recipient_first', row) || '');
    return `${last}<br><span class="text-zinc-300">${first || '—'}</span>`;
  }

  // ——— Окрема колонка "Нас. пункт"
  if (key === 'city') {
    return escapeHtml(get('city', row) || '—');
  }

  // ——— Дата/час
  if (key === 'date') {
    return fmtDate(get('date', row));
  }

  // ——— Колонка ТТН (якорі замість button, щоб не було вкладених кнопок)
  if (key === 'ttn') {
    const t  = String(get('ttn', row) || '');
    const og = String(get('order_group', row) || ''); // AW — ідентифікатор замовлення

    // немає ТТН → показуємо "додати"
    if (!t) {
      return `
        <a href="#" class="ttn-btn ttn-add inline-flex items-center gap-1 px-2 py-1
                           rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
           data-og="${escapeHtml(og)}" title="Додати ТТН">
          ${NP_ICON}<span>ТТН</span>
        </a>`;
    }

    // є ТТН → номер + іконка редагування
    return `
      <span class="font-mono mr-2">${escapeHtml(t)}</span>
      <a href="#" class="ttn-btn ttn-edit inline-flex items-center justify-center p-1
                         rounded bg-zinc-800/50 hover:bg-zinc-700"
         data-og="${escapeHtml(og)}" data-ttn="${escapeHtml(t)}" title="Змінити ТТН">
        ${NP_ICON}
      </a>`;
  }

  // ——— Статус бейджем
// ——— Статус бейджем

if (key === 'status') {
  const raw   = get('status', row) || '';
  const canon = canonStatus(raw);
  const og    = String(get('order_group', row) || '');
  const ok    = ['Відправлено','В дорозі','Прибув у відділення','Отримано'].includes(canon);
  return `
    <span id="status-pill-${escapeHtml(og)}" class="inline-flex items-center gap-2 rounded-full border
           ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-zinc-600/30 bg-zinc-800/50 text-zinc-300'} px-2 py-0.5 text-xs">
      <span class="status-dot h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-zinc-500'}"></span>
      <span data-label>${escapeHtml(raw || '')}</span>
    </span>`;
}



  // ——— Кнопка «Надіслати»
   if (key === 'send') {
    const toKebab = s => String(s).replace(/[A-Z]/g, m => '-' + m.toLowerCase());

    const og   = String(get('order_group', row) || '');
    const recipient_last  = get('recipient_last', row) || '';
    const recipient_first = get('recipient_first', row) || '';
    const warehouse       = get('warehouse', row) || get('warehouseNumber', row) || '';
    const forClient       = get('forClient', row) || '';
    const sale            = get('sale', row) || '';
    const comment         = get('comment', row) || '';

    const itemsList = buildItemsListForOrder(og);

    // ⚠️ беремо ID менеджера з C (ID_ZM) через наш канонічний ключ
    const idManagerVal = get('id_zm', row) || '';

    const data = {
      orderId:     og,
      // ⬇️ додаємо тільки якщо НЕ порожнє (щоб не перебити dataset з rowBtn)
      ...(idManagerVal ? { idManager: idManagerVal } : {}),

      clientName:  [recipient_last, recipient_first].filter(Boolean).join(' '),
      phone:       get('phone', row) || '',
      email:       get('email', row) || '',
      city:        get('city', row) || '',
      region:      get('region', row) || '',
      npWarehouse: warehouse,
      // ⬇️ важливо: в GAS це називається post
      payment:     get('post', row) || '',
      priceClient: forClient || sale,
      itemsList,
      note:        comment,

      // «рідні» (на випадок використання у шаблоні)
      recipient_last,
      recipient_first,
      warehouse,
      warehouseNumber: get('warehouseNumber', row) || '',
      forClient,
      sale,
      comment
    };

    // 🔎 ДЕБАГ-ЛОГ — подивитись, що саме піде у data-атрибути
    console.log('[send-btn] data for attrs:', data);

    const attrs = Object.entries(data)
      .map(([k,v]) => `data-${toKebab(k)}="${escapeHtml(String(v ?? ''))}"`)
      .join(' ');

    return `
      <a href="#"
         class="send-tpl inline-flex items-center justify-center h-8 w-9
                rounded-md border border-zinc-700 hover:bg-zinc-800"
         ${attrs}
         title="Надіслати в Telegram">
        ${TELEGRAM_ICON}
      </a>`;
  }

  // ——— Гроші
  if (key === 'sale')   return money(get('sale',   row));
  if (key === 'profit') return money(get('profit', row));

  // ——— Фолбек
  const v = get(key, row);
  return (v != null && v !== '') ? escapeHtml(String(v)) : '—';
}



// Будуємо групи по полю "Замовлення"
function buildOrderGroups(rows) {
  // 🛡 Нормалізуємо вхід: дозволяємо передати rows; інакше пробуємо взяти з DATA, DATA.data/items/rows/orders
  const SRC =
    Array.isArray(rows)           ? rows :
    (typeof DATA !== 'undefined' && Array.isArray(DATA))            ? DATA :
    (typeof DATA !== 'undefined' && Array.isArray(DATA.data))       ? DATA.data :
    (typeof DATA !== 'undefined' && Array.isArray(DATA.items))      ? DATA.items :
    (typeof DATA !== 'undefined' && Array.isArray(DATA.rows))       ? DATA.rows :
    (typeof DATA !== 'undefined' && Array.isArray(DATA.orders))     ? DATA.orders : [];

  if (!Array.isArray(SRC)) {
    console.error('[buildOrderGroups] DATA is not iterable:', SRC);  // 🛡 Діагностика, щоб бачити реальну форму відповіді
    return [];
  }

  const map = new Map(); // key → { key, head, rows[] }

  SRC.forEach((r, i) => {
    // Беремо ключ групи з поля AW (order_group); якщо порожній — робимо унікальний, щоб не склеїти всі замовлення в одну купу
    const rawKey = get('order_group', r) ?? get('orderId', r) ?? get('AW', r); // AW «Замовлення»  // 🛠 Підстрахувалися синонімами
    const key = (rawKey == null || rawKey === '') ? `__ungrouped__:${i}` : String(rawKey);       // 🛡 Унікальний ключ для порожніх

    if (!map.has(key)) map.set(key, { key, head: null, rows: [] });
    const g = map.get(key);
    g.rows.push(r);

    // вибираємо «голову» групи — там де є глобальний ID (перший рядок замовлення)
    const hasId = !!get('id', r) || !!get('ID', r) || !!get('a', r); // колонка A «ID»  // 🛠 Дозволяємо кілька назв
    if (!g.head || hasId) g.head = r;
  });

  return Array.from(map.values());
}


// Строка для пошуку по групі (шапка + товари)
function groupSearchString(g) {
  const h = g.head || {};
  const headStr = [
    get('id', h), get('recipient_last', h), get('recipient_first', h),
    get('city', h), get('status', h), get('ttn', h)
  ].filter(Boolean).join(' ');

  const itemsStr = (g.rows || [])
    .map(it => [get('item', it), get('size', it), get('description', it), get('comment', it)]
      .filter(Boolean).join(' '))
    .join(' ');

  return (headStr + ' ' + itemsStr).toLowerCase();
}
//---------------------------------------------------------------------------------------------------------

// Розбирає опис гравіювання на підпункти
// ───────────────────────────────────────────────────────────────
// Розбирає опис гравіювання на підпункти (кожен рядок опису → тире)
// Підтримує варіанти: “напис зверху/по центру/знизу”, “рисунок …”
// ───────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────
// Розбирає опис гравіювання на підпункти
// ───────────────────────────────────────────────────────────────
// Розбір опису в підпункти (працює і для гравіювання, і для друку тощо)
// ░░░ ОПИС -> підпункти для "Гравіювання"/"Друк на чохлі" ░░░
function parseEngravingDesc(desc) {
  const norm = String(desc ?? '').replace(/\r/g, '');
  if (!norm.trim()) return '';

  const lines = norm
    .split('\n')
    .map(s => s.replace(/^[•\-–—]\s*/, '').trim())
    .filter(Boolean);

  const mapLine = (raw) => {
    const value = String(raw).replace(/^[^:：-]*[:：-]\s*/, '').trim();
    const l = String(raw).toLowerCase();

    if (/(напис|текст).*(верх|з.?верху)/.test(l))   return `    - напис з верху ${value}`;
    if (/(напис|текст).*(центр|середин)/.test(l))  return `    - напис по середині ${value}`;
    if (/(напис|текст).*(низ|з.?низу)/.test(l))    return `    - напис з низу ${value}`;
    if (/рис(у|ю)нок/.test(l))                     return `    - рисунок ${value}`;
    return `    - ${value || raw.trim()}`;
  };

  return lines.map(mapLine).join('\n');
}

// ░░░ Один товар у списку (БЕЗ використання comment!) ░░░
function formatItemForList(row) {
  const name = String(get('item', row) ?? '').trim();
  if (!name) return '';

  const size = String(get('size', row) ?? '').trim();
  const desc = String(get('description', row) ?? '');

  const header = `• ${name}${size ? ` (${size})` : ''}`;

  // для "Гравіювання"/"Друк на чохлі" — підпункти з опису
  if ((/граві[юі]вання/i.test(name) || /друк.*чохл/i.test(name)) && desc.trim()) {
    return [header, parseEngravingDesc(desc)].join('\n');
  }

  // інші позиції — одним рядком: Назва (Розмір) — Опис
  const tail = desc.trim();
  return tail ? `${header} — ${tail}` : header;
}

// ░░░ Список товарів для замовлення ░░░
function buildItemsListForOrder(orderGroup) {
  if (!orderGroup) return '';
  const rows = (DATA || []).filter(r => String(get('order_group', r)) === String(orderGroup));
  return rows.map(formatItemForList).filter(Boolean).join('\n');
}

// сумісність зі старими викликами
function buildItemsListText(orderGroupId) {
  return buildItemsListForOrder(orderGroupId);
}







function renderItemsBlock(row){
  const orderId = get('order_group', row);
  if (!orderId) return '';

  // всі рядки цього замовлення
  const items = DATA.filter(r => String(get('order_group', r)) === String(orderId));
  if (!items.length) return '';

  const head =
    `<div class="ow-row ow-head">
       <div class="ow-cell">Товар</div>
       <div class="ow-cell">Розмір</div>
       <div class="ow-cell">Опис</div>
       <div class="ow-cell">Коментар</div>
       <div class="ow-cell ow-num">Покупка</div>
       <div class="ow-cell ow-num">Маржа</div>
       <div class="ow-cell ow-num">Ціна</div>
     </div>`;

  const rows = items.map(it => {
    const cells = [
      escapeHtml(get('item', it) || '—'),
      escapeHtml(get('size', it) || '—'),
      escapeHtml(get('description', it) || '—'),
      escapeHtml(get('comment', it) || '—'),
      money(get('purchase', it), {symbol:false}),
      money(get('margin_item', it), {symbol:false}),
      money(get('price_item', it), {symbol:false}),
    ];
    return `<div class="ow-row">${cells
      .map((v,i)=>`<div class="ow-cell ${i>=4?'ow-num':''}">${v}</div>`).join('')}</div>`;
  }).join('');

  return `
    <div class="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 mb-3">
      <div class="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">Товари замовлення</div>
      <div class="ow-items">
        ${head}
        ${rows}
      </div>
    </div>
  `;
}


function renderDetails(row) {
  const og  = get('order_group', row) || '';
  const id  = get('id',  row) || '—';
  const idm = get('id_m',row) || '—';
  const mk  = get('marketplace',row) || '—';

  const ttn    = get('ttn', row) || '—';
  const stRaw  = get('status', row) || '';      // ❗ показуємо СИРИЙ текст як у таблиці
  const stCanon = canonStatus(stRaw);           // ❗ для підсвітки/прогресу використовуємо канон

 const progressMap = {
  'Виготовляється': 10,
  'Комплектується': 30,
  'Відправлено': 50,
  'В дорозі': 75,
  'Прибув у відділення': 90,
  'Отримано': 100,
  'Відмова': 0            // ← додано
};

  const progress = progressMap[stCanon] || 0;

  const s1   = [get('recipient_last',row), get('recipient_first',row)].filter(Boolean).join(' ');
  const s2   = [get('recipient_middle',row), get('phone',row), get('email',row)].filter(Boolean).join(' • ');
  const addr = [get('region',row), get('district',row), get('city',row), get('street',row), get('warehouse',row)]
               .filter(Boolean).join(', ') || '—';

  const statusOk = ['Відправлено','В дорозі','Прибув у відділення','Отримано'].includes(stCanon);

  return `
  <div class="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 mt-2">
    ${renderItemsBlock(row)}

    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-800 font-semibold">#${escapeHtml(id)}</div>
        <div class="text-zinc-200">
          <div class="font-medium">Замовлення</div>
          <div class="text-xs text-zinc-400">ID-m: ${escapeHtml(idm)} • Маркетплейс: ${escapeHtml(mk)}</div>
        </div>
      </div>

      <div class="inline-flex items-center gap-2 rounded-full border ${statusOk
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : 'border-zinc-600/30 bg-zinc-800/50 text-zinc-300'} px-3 py-1 text-xs">
        <span class="h-2 w-2 rounded-full ${statusOk ? 'bg-emerald-400' : 'bg-zinc-500'}"></span>
        <span id="status-${og}">${escapeHtml(stRaw || '—')}</span>
      </div>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-3">
      <div class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Отримувач</div>
        <div class="mt-1 text-sm">
          ${escapeHtml(s1) || '—'}
          <div class="text-xs text-zinc-400">${escapeHtml(s2)}</div>
        </div>
      </div>

      <div class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Адреса</div>
        <div class="mt-1 text-sm">${escapeHtml(addr)}</div>
        <div class="text-xs text-zinc-400">
          TTN: <span id="ttn-${og}">${ttn ? escapeHtml(ttn) : '—'}</span>
        </div>
      </div>

      <div class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Фінанси</div>

        <div class="mt-1 flex justify-between text-sm">
          <span>Продаж</span>
          <span class="font-semibold">${money(get('sale', row), { symbol:false })}</span>
        </div>

        <div class="flex justify-between text-xs text-zinc-400">
          <span>Дроп</span>
          <span>${money(get('drop', row), { symbol:false })}</span>
        </div>

        <div class="flex justify-between text-xs text-zinc-400">
          <span>Знижка</span>
          <span>${money(get('discount', row), { symbol:false })}</span>
        </div>

        <div class="flex justify-between text-xs text-zinc-400">
          <span>Дохід</span>
          <span>${money(get('profit', row), { symbol:false })}</span>
        </div>
      </div>
    </div>

    <div class="mt-4 rounded-lg border border-zinc-800 p-3">
      <div class="flex items-center justify-between text-xs text-zinc-400">
        <span>Виготовляється</span><span>Комплектується</span><span>Відправлено</span>
        <span>В дорозі</span><span>Прибув у відділення</span><span>Отримано</span>
      </div>
      <div class="mt-2 h-2 rounded-full bg-zinc-800">
        <div class="h-2 rounded-full bg-emerald-500" style="width:${progress}%"></div>
      </div>
    </div>
  </div>
  `;
}






  // ---- 8) Події ----
  // Робимо мультивибір (нативний <select multiple> або залишиться як є — код все одно працює)
if (statusEl) {
  // робимо мультивибір
  statusEl.setAttribute('multiple', 'multiple');
  statusEl.size = Math.max(6, statusEl.options.length);

  // ⬇️ ДОДАЙ СЮДИ: пункт “Без статусу”
  if (![...statusEl.options].some(o => o.value === '__EMPTY__')) {
    statusEl.insertAdjacentHTML(
      'beforeend',
      '<option value="__EMPTY__">Без статусу</option>'
    );
  }

  // слухач зміни вибору
  statusEl.addEventListener('change', () => {
    const selected = Array.from(statusEl.selectedOptions).map(o => o.value);
    filterStatuses = new Set(selected); // '__EMPTY__' лишається як є
    render();
  });
}

  
  
  
  
  if (searchEl) searchEl.oninput   = e => { search = e.target.value; render(); };





const rootEl = (root === document ? document : root);
rootEl.removeEventListener?.('click', onOrdersClick, false); // без дублювань
rootEl.addEventListener('click', onOrdersClick, false);


// ловимо клік по кнопці НП (подія з віджета)
rootEl.removeEventListener?.('np:track:open', onNpTrackOpen, false);
rootEl.addEventListener('np:track:open', onNpTrackOpen, false);

async function onNpTrackOpen(e) {
  const btn = e.target.closest('.np-track-btn');
  const d   = e.detail || {};
  const og  = d.orderGroup || d.orderId;

  try {
    if (!d.ttn) {
      safeToast('У цього замовлення немає ТТН');
      return;
    }

    if (btn) {
      btn.dataset.prevHtml = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
          <path d="M22 12a10 10 0 0 1-10 10"></path>
        </svg>`;
    }

    const { status } = await npTrackViaGAS({
      ttn: d.ttn,
      phone: d.phone || '',
      orderGroup: og
    });

    applyStatusUI(og, status);
    safeToast(`Статус НП: ${status}`);
  } catch (err) {
    console.error('[NP] track error:', err);
    safeToast('Помилка трекінгу НП');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = btn.dataset.prevHtml || (typeof NP_ICON !== 'undefined' ? NP_ICON : 'НП');
      delete btn.dataset.prevHtml;
    }
  }
}







// ГОЛОВНИЙ делегований обробник кліків у таблиці замовлень


async function onOrdersClick(e) {
  // 1) Кнопки ТТН
  const ttnBtn = e.target.closest('.ttn-btn');
  if (ttnBtn) {
    e.preventDefault(); e.stopPropagation();
    const og   = ttnBtn.dataset.og  || '';
    const curr = ttnBtn.dataset.ttn || '';
    await openTtnDialog(og, curr, ttnBtn);
    return;
  }

  // 2) «Надіслати» (модалка)
const sendBtn = e.target.closest('.send-tpl');
if (sendBtn) {
  e.preventDefault(); e.stopPropagation();

  // !!! ВАЖЛИВО: зливаємо data-* із кнопки ТА з усього рядка
  const rowEl   = sendBtn.closest('.order-row');
  const merged  = Object.assign({}, rowEl?.dataset || {}, sendBtn.dataset || {});

  // якщо TTN не прокинувся — добираємо з DOM
  if (!merged.ttn) {
    const og = merged.order_group || merged.orderId;
    const ttnEl = document.getElementById(`ttn-${og}`);
    if (ttnEl) merged.ttn = (ttnEl.textContent || '').trim().replace(/^—$/, '');
  }

  // ---------- DEBUG: тут дивимось, чи уже є idManager у merged ----------
  console.log('[onOrdersClick] merged BEFORE normalize:', merged);
  console.log('[onOrdersClick] merged.idManager =', merged.idManager);

  // нормалізуємо
  const orderData = normalizeDataset(merged);

  // ---------- DEBUG: і що стало після normalize() ----------
  console.log('[onOrdersClick] orderData AFTER normalize:', orderData);
  console.log('[onOrdersClick] orderData.idManager =', orderData.idManager);
  // ----------------------------------------------------------------------

  // показати модалку
  if (typeof window.openSendTplModal === 'function') {
    window.openSendTplModal({ rowEl: rowEl || sendBtn, orderData });
  } else {
    console.warn('openSendTplModal is not defined');
  }
  return;
}

  // 3) Не розкривати рядок при кліках по інтерактивних елементах
  const interactive = e.target.closest('a,button,input,select,textarea,[data-ignore-row-toggle]');
  if (interactive && !interactive.matches('[data-row]')) return;

  // 4) Тогл деталей замовлення
  const rowBtn = e.target.closest('[data-row]');
  if (rowBtn) {
    const details = rowBtn.parentElement.querySelector('[data-details]');
    if (details) details.classList.toggle('hidden');
  }
}

// ✅ Нормалізація data-* з рядка таблиці під ключі шаблону

function normalizeDataset(ds = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = ds[k] ?? ds[k?.toLowerCase?.()];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  let clientName =
    pick('clientName','clientname','recipient','recipientName','recipient_full');
  if (!clientName) {
    clientName = [pick('recipient_last'), pick('recipient_first')].filter(Boolean).join(' ');
  }

  return {
    // ідентифікатори
    orderId:      pick('orderId','orderid','og','order_group'),
    order_group:  pick('order_group','orderGroup','og','orderid'),

    // ❗ ТУТ головне виправлення:
    // Використовуємо тільки `idManager`, але дозволяємо брати з колонки C (ID_ZM)
    idManager:    pick('idManager','id_zm','ID_ZM','id_manager'),

    // клієнт
    clientName,
    clientSurname:    pick('clientSurname','recipient_last'),
    clientFirstname:  pick('clientFirstname','recipient_first'),
    clientPatronymic: pick('clientPatronymic','recipient_middle'),
    clientFullName:   pick('clientFullName','client_full_name'),
    phone:            pick('phone','tel','number'),
    email:            pick('email'),

    // дати
    createdAt:        pick('createdAt','created_at','date'),

    // адреса
    country:        pick('country'),
    region:         pick('region'),
    district:       pick('district'),
    city:           pick('city'),
    street:         pick('street'),
    npWarehouse:    pick('npWarehouse','npwarehouse','warehouse'),
    warehouseNumber:pick('warehouseNumber','warehousenumber'),
    warehouseType:  pick('warehouseType','warehousetype'),

    // логістика / типи
    deliveryType:   pick('deliveryType','post'),
    payment:        pick('payment','post'),

    // ТТН
    ttn:            pick('ttn'),

    // фінанси/контент
    priceClient:    pick('priceClient','priceclient','forClient','sale'),
    discount:       pick('discount'),
    drop:           pick('drop','totalPurchaseSum'),
    profit:         pick('profit'),
    marketplace:    pick('marketplace'),
    itemsList:      pick('itemsList','itemslist','items','items_list'),
    description:    pick('description'),
    note:           pick('note','comment'),

    // службове
    manager:        pick('manager')
  };
}


// ГОЛОВНИЙ делегований обробник кліків у таблиці замовлень







// 🔧 Діалог + збереження ТТН на Apps Script

async function openTtnDialog(orderGroup, currentTTN = '', btnEl) {
  const newTTN = prompt('Введіть номер ТТН:', currentTTN);
  if (!newTTN) return;

  try {
    // формуємо тіло як application/x-www-form-urlencoded (без ручного Content-Type)
    const form = new URLSearchParams();
    form.set('mode', 'set-ttn');
    form.set('order_group', orderGroup);
    form.set('ttn', newTTN);
    form.set('status', 'Комплектується');

    const res = await fetch(GAS_BASE, { method: 'POST', body: form }); // ← без headers
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Помилка збереження');

    // оновлюємо осередок «ТТН» у списку
 if (btnEl) {
  // 1) оновлюємо клітинку в головній таблиці
  const cell = btnEl.closest('div');
  cell.innerHTML = `
    <span class="font-mono mr-2">${newTTN}</span>
    <button class="ttn-btn ttn-edit inline-flex items-center justify-center p-1
                   rounded bg-zinc-800/50 hover:bg-zinc-700"
            data-og="${orderGroup}" data-ttn="${newTTN}" title="Змінити ТТН">
      ${NP_ICON}
    </button>`;
}

// 2) синхронізуємо ТТН у блоці деталей (Адреса → TTN: ...)
const detailTtnEl = document.getElementById(`ttn-${orderGroup}`);
if (detailTtnEl) detailTtnEl.textContent = newTTN;

// 3) якщо з бекенду прийшов статус — оновлюємо статус у блоці деталей
//    (падаємо назад на "Створено ТТН", якщо бекстатусу немає)
const newStatus =
  (data && (data.status || data.statusText)) ||
  'Комплектується';


const detailStatusEl = document.getElementById(`status-${orderGroup}`);
if (detailStatusEl) detailStatusEl.textContent = newStatus;



    // статус у шапці (пігулка)
    const pill = document.getElementById(`status-pill-${orderGroup}`);
   
    
    
    if (pill) {
      const label = pill.querySelector('[data-label]');
      if (label) label.textContent = newStatus;
     const ok = ['Відправлено','В дорозі','Прибуло до відділення','Отримано'].includes(canonStatus(newStatus));
      pill.classList.toggle('border-emerald-500/30', ok);
      pill.classList.toggle('bg-emerald-500/10', ok);
      pill.classList.toggle('text-emerald-300', ok);
      pill.classList.toggle('border-zinc-600/30', !ok);
      pill.classList.toggle('bg-zinc-800/50', !ok);
      pill.classList.toggle('text-zinc-300', !ok);
      const dot = pill.querySelector('.status-dot');
      if (dot) {
        dot.classList.toggle('bg-emerald-400', ok);
        dot.classList.toggle('bg-zinc-500', !ok);
      }
    }

    // статус у деталях (нижній блок)
    const detailStatus = document.getElementById(`status-${orderGroup}`);
    if (detailStatus) detailStatus.textContent = newStatus;

    typeof safeToast === 'function' && safeToast('ТТН збережено');
  } catch (err) {
    console.error('set-ttn failed:', err);
    typeof safeToast === 'function'
      ? safeToast('Помилка збереження ТТН: ' + (err?.message || err))
      : alert('Помилка збереження ТТН: ' + (err?.message || err));
  }
}





// === Динамічне виставлення висоти #ordersBody відносно вікна ===
// Один розрахунок висоти, один скрол у #ordersBody
function sizeOrders() {
  const box  = document.getElementById('ordersBox');
  const head = document.getElementById('ordersHead');
  const body = document.getElementById('ordersBody');
  if (!box || !head || !body) return;

  // якщо десь є реальний футер — врахуємо його висоту
  const footer  = document.querySelector('footer, .footer, #footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 36;

  // ← ТУТ НАЛАШТОВУЄТЬСЯ НИЖНІЙ ВІДСТУП ДО ФУТЕРА
  const GAP = 10;

  const top   = box.getBoundingClientRect().top;
  const fullH = Math.max(240, window.innerHeight - top - footerH - GAP);

  // контейнер робимо флекс-колонкою
  box.style.height       = fullH + 'px';
  box.style.minHeight    = '0';
  box.style.display      = 'flex';
  box.style.flexDirection= 'column';

  // єдиний скрол на тілі таблиці
  body.style.flex        = '1 1 auto';
  body.style.minHeight   = '0';
  body.style.overflowY   = 'auto';
  body.style.height      = (fullH - head.offsetHeight) + 'px';

  // на всяк випадок прибираємо другий (зайвий) скрол із #ordersScroll
  const scroller = document.getElementById('ordersScroll');
  if (scroller) {
    scroller.style.overflow = 'visible';
    scroller.classList.remove('overflow-auto');
    scroller.style.height = '100%';
    scroller.style.display = 'flex';
    scroller.style.flexDirection = 'column';
  }
}






  // старт
  loadOrders();
 // після того як прийшли дані — оновимо список у дропдауні
 

  requestAnimationFrame(sizeOrders);
window.addEventListener('resize', sizeOrders, { passive: true });
window.addEventListener('orientationchange', sizeOrders);











}








//-------------------------------------------------------------------------------------------------------------------------
async function saveTTN(orderGroup, ttn) {
  if (!orderGroup) throw new Error('Немає ідентифікатора замовлення (order_group)');
  const url = `${GAS_BASE}?mode=set-ttn`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_group: orderGroup, ttn })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

//+++++++++++++++++++++++++++++++++++++++++++ РЕНДЕР СПИСКУ ЗАМОВЛЕНЬ у #ordersBody ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
function renderOrders(orders) {
  const body = document.getElementById('ordersBody');
  if (!body) return;
  body.innerHTML = '';

  orders.forEach(order => {
    const row = document.createElement('div');
    row.className = 'order-row grid grid-cols-12 items-start gap-3 border-b border-zinc-800 px-4 py-3';

    // ==== dataset: ЗВІДСИ БЕРУТЬСЯ ДАНІ ДЛЯ {{keys}} У ШАБЛОНІ ====
    row.dataset.orderId     = order.id ?? order.orderId ?? '';
    row.dataset.idManager  = order.idManager ?? order['id_manager'] ?? '';
    row.dataset.clientName  = order.clientName ?? '';
    row.dataset.phone       = order.phone ?? '';
    row.dataset.city        = order.city ?? '';
    row.dataset.region      = order.region ?? '';
    row.dataset.npwarehouse = order.npWarehouse ?? order.npwarehouse ?? '';
    row.dataset.payment     = order.payment ?? '';
    row.dataset.priceClient = String(order.priceClient ?? '');
    row.dataset.itemsList   = Array.isArray(order.items) ? order.items.join('\n') : (order.itemsList ?? '');
    row.dataset.note        = order.note ?? '';
    row.dataset.manager     = order.manager ?? '';
    row.dataset.ttn         = order.ttn ?? '';
    // (необовʼязково) щоб авто-обирати шаблон за тегом в назві [клієнт]/[партнер]
    row.dataset.tpl         = order.tplType ?? '';            // напр. 'клієнт' або 'партнер'
    // (якщо вже є chat_id для бота)
    row.dataset.telegramChatId = order.telegramChatId ?? '';

    // ==== твоя візуальна частина рядка (приклад, підлаштуй під себе) ====
  const statusText = row.dataset.status || '(Без статусу)';

row.innerHTML = `
  <div class="col-span-3 text-sm font-medium">#${row.dataset.orderId || '-'}</div>

  <div class="col-span-5 text-sm">
    <div>${row.dataset.clientName || '-'}</div>
    <div class="text-xs text-zinc-400">
      ${row.dataset.city || ''}${row.dataset.city && row.dataset.region ? ', ' : ''}${row.dataset.region || ''}
    </div>
  </div>

  <div class="col-span-2 text-sm order-status" data-col="status" data-status="${statusText}">
    <span class="pill inline-flex items-center px-2 py-[2px] rounded-full bg-zinc-800 text-zinc-100">
      ${statusText}
    </span>
    <input type="hidden" name="status" value="${statusText}">
  </div>

  <!-- Контейнер під кнопки дій -->
  <div class="order-actions col-span-2 flex justify-end items-center gap-2" data-col="actions"></div>
`;
    body.appendChild(row);
  });

 
}

// ===== All-Orders: підняти дропдауни фільтрів над шапкою =====
(function elevateFilterDropdowns(){
  // підписуємось на глобальні кліки — коли відкривається будь-який dropdown
  document.addEventListener('click', () => {
    // невелика затримка, щоб клас .show вже встиг проставитись
    setTimeout(() => {
      document.querySelectorAll('#all-orders .dropdown-menu').forEach(menu => {
        menu.style.zIndex = '5000';
      });
    }, 0);
  });
})();



// (опційно) зробимо доступною ззовні
window.renderOrders = renderOrders;
