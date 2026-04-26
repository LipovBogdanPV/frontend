/**
 * Завантажує HTML-шапку у #widget-header та ініціалізує вкладки/кнопки.
 * ↓ ПІСЛЯ вставки шапки запускаємо initHeaderTabs() і монтуємо sticky-viewport.
 */
export async function loadWidgetHeader(path) {
  console.log('[hdr] fetch header:', path);
  try {
    const res = await fetch(path);
    const html = await res.text();
    const container = document.getElementById('widget-header');
    if (!container) { console.warn('[hdr] ❗️#widget-header не знайдено'); return; }
    container.innerHTML = html;                               // ← ВСТАВЛЕНО HTML шапки

    pinHeader();        
    ensureHeaderVisible();     
    // 1) Ініціалізація модулю вкладок (на різних шляхах)        // --------------------
    try {
      const { initHeaderTabs } = await import('./components/widgets/header-orders-tabs.js');
      initHeaderTabs();
    } catch {
      try {
        const { initHeaderTabs } = await import('../components/widgets/header-orders-tabs.js');
        initHeaderTabs();
      } catch (e) {
        console.warn('[hdr] ⚠️ initHeaderTabs недоступний за обома шляхами', e);
      }
    }

    // 2) Під шапкою створюємо окремий viewport, який скролиться  // --------------------
    try { if (typeof mountStickyViewport === 'function') mountStickyViewport(); } catch {}

    // 3) Легасі-свічер (твоя логіка кнопок у шапці)               // --------------------
    console.log('[hdr] header inserted, init switcher in 100ms');
    setTimeout(initWidgetHeaderSwitcher, 100);
  } catch (err) {
    console.error('[hdr] ❌ Помилка завантаження шапки:', path, err);
  }
}

/* === НЕ ДАЄМО ШАПЦІ ЗНИКАТИ (жорсткий пін) ======================= */
function pinHeader() {
  const h = document.getElementById('widget-header-origin');
  if (!h) return;
  h.classList.remove('hidden');                 // прибрати utility-клас
  h.removeAttribute('hidden');                  // прибрати атрибут hidden
  h.removeAttribute('aria-hidden');             // прибрати aria-hidden
  // прибрати можливі inline-стилі, які її ховали
  if (h.style.display === 'none') h.style.display = '';
  h.style.visibility = 'visible';
  // гарантовано показати
  try { if (getComputedStyle(h).display === 'none') h.style.display = 'block'; } catch {}
}




/** Прибрати шапку (очистити контейнер) */
export function clearWidgetHeader() {
  const container = document.getElementById('widget-header');
  if (container) container.innerHTML = '';
  console.log('[hdr] header cleared');
}

/* ===================================================================
   СКРОЛ-В’ЮПОРТ ПІД ШАПКОЮ (щоб шапка не зникала при перемиканні)
   =================================================================== */
// ────────────────────────────────────────────────────────────────
// СТАБІЛЬНИЙ VIEWPORT під шапкою (ідемпотентний)
// ────────────────────────────────────────────────────────────────
export function mountStickyViewport() {
  const main   = document.getElementById('main-content');
  const header = document.getElementById('widget-header-origin');
  if (!main) { console.warn('[vp] no #main-content'); return; }

  // ⚠️ Захист: щоб не монтувати двічі
  if (main.dataset.vpMounted === '1') {
    // тільки оновимо висоту шапки
    if (header) {
      const h = Math.round(header.getBoundingClientRect().height || 64);
      document.documentElement.style.setProperty('--hdr-h', h + 'px');
    }
    return;
  }

  // створюємо контейнер-viewport
  let vp = document.getElementById('widgets-viewport');
  if (!vp) {
    vp = document.createElement('div');
    vp.id = 'widgets-viewport';
  }

  // переносимо tabs-wrapper у viewport, але шапку не чіпаємо
  const tabs = document.getElementById('tabs-wrapper');
  if (tabs) {
    if (tabs.parentElement !== vp) {
      // вставляємо vp перед tabs і переміщаємо tabs всередину
      main.insertBefore(vp, tabs);
      vp.appendChild(tabs);
    }
  } else {
    // tabs ще немає: обгортаємо ВСЕ, крім #widget-header-origin
    const frag = document.createDocumentFragment();
    Array.from(main.children).forEach(ch => {
      if (ch !== header) frag.appendChild(ch);
    });
    main.appendChild(vp);
    vp.appendChild(frag);
  }

  // зафіксувати висоту шапки у CSS-змінну
  const h = Math.round((header?.getBoundingClientRect().height) || 64);
  document.documentElement.style.setProperty('--hdr-h', h + 'px');

  main.dataset.vpMounted = '1';
  vp.classList.add('with-hdr');

  // лайтове оновлення висоти на ресайзі/змінах шапки
  let raf;
  const upd = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const hh = Math.round((header?.getBoundingClientRect().height) || 64);
      document.documentElement.style.setProperty('--hdr-h', hh + 'px');
    });
  };
  window.addEventListener('resize', upd);
  new MutationObserver(upd).observe(header || document.body, { attributes:true, childList:true, subtree:true });

  console.log('[vp] mounted; --hdr-h=', getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'));
}


/* ======================= КОНСТАНТИ ======================= */
const LAST_VIEW_KEY      = 'lastWidgetView';     // "order" | "nova-poshta"
const ORDER_KEY          = 'order';
const LAYOUT_KEY         = 'widgetsLayout';      // "vertical" | "horizontal"
const INIT_ORDER_ON_LOAD = false;

/* ======================= УТИЛІТИ ======================= */
async function safeImport(path) {
  try { return await import(path); }
  catch (e) { console.error('[util] ❌ Dynamic import error:', path, e); throw e; }
}

// Друк поточного стану для дебагу
function logState(tag = 'state') {
  const wrapper = document.getElementById('tabs-wrapper');
  const tovar   = document.getElementById('tovar');
  const nova    = document.getElementById('nova-poshta');
  const toggle  = document.getElementById('toggleBoth');
  const info = {
    tag,
    hasWrapper: !!wrapper,
    wrapperClasses: wrapper?.className || null,
    toggleChecked: !!toggle?.checked,
    lastView: localStorage.getItem(LAST_VIEW_KEY),
    layoutSaved: localStorage.getItem(LAYOUT_KEY),
    tovar: {
      exists: !!tovar,
      hiddenClass: !!tovar?.classList.contains('hidden'),
      csDisplay: tovar ? getComputedStyle(tovar).display : null,
      height: tovar?.getBoundingClientRect?.().height ?? null,
      children: tovar?.children?.length ?? null,
    },
    nova: {
      exists: !!nova,
      hiddenClass: !!nova?.classList.contains('hidden'),
      csDisplay: nova ? getComputedStyle(nova).display : null,
      height: nova?.getBoundingClientRect?.().height ?? null,
      children: nova?.children?.length ?? null,
    },
  };
  console.log('[dbg]', info);
  return info;
}
window.__crm_logState = logState;

/* Підсвітки кнопок */
function highlightActiveTab(viewId) {
  const b1 = document.getElementById('btnOrderWidget');
  const b2 = document.getElementById('btnNovaWidget');
  if (!b1 || !b2) return;
  b1.classList.remove('btn-dark'); b2.classList.remove('btn-dark');
  if (viewId === 'order')       b1.classList.add('btn-dark');
  if (viewId === 'nova-poshta') b2.classList.add('btn-dark');
  console.log('[ui] active tab ->', viewId);
}
function clearTabButtons() {
  document.getElementById('btnOrderWidget')?.classList.remove('btn-dark');
  document.getElementById('btnNovaWidget')?.classList.remove('btn-dark');
}
function highlightLayoutButtons(mode) {
  const v = document.getElementById('btnLayoutVertical');
  const h = document.getElementById('btnLayoutHorizontal');
  if (!v || !h) return;
  v.classList.toggle('btn-dark', mode === 'vertical');
  h.classList.toggle('btn-dark', mode === 'horizontal');
  console.log('[ui] layout button highlight ->', mode);
}

/** Застосувати/зберегти орієнтацію (лише класи) */
function applyLayout(mode) {
  const m = mode === 'vertical' ? 'vertical' : 'horizontal';
  const wrapper = document.getElementById('tabs-wrapper');
  if (wrapper) {
    wrapper.classList.remove('layout-vertical', 'layout-horizontal', 'two-cols');
    wrapper.classList.add(m === 'vertical' ? 'layout-vertical' : 'layout-horizontal');
  }
  localStorage.setItem(LAYOUT_KEY, m);
  highlightLayoutButtons(m);
  console.log('[layout] applyLayout:', m, '→ wrapper:', wrapper?.className);
}
function applySavedLayoutOrDefault() {
  const m = localStorage.getItem(LAYOUT_KEY) || 'horizontal';
  console.log('[layout] applySavedLayoutOrDefault ->', m);
  applyLayout(m);
}

/* === ГАРАНТІЯ ВИСОТИ ДЛЯ НОВОЇ ПОШТИ (захист від «схлопування» рядка) === */
let npResizeObs = null;
function ensureNovaSpace(reason = 'ensure') {
  const host  = document.getElementById('nova-poshta');
  if (!host) return;
  const inner = host.querySelector('#nova-poshta-widget') || host.firstElementChild;
  const hostH  = host.getBoundingClientRect().height;
  const innerH = inner ? (inner.scrollHeight || inner.getBoundingClientRect().height) : 0;

  if (innerH && hostH < innerH * 0.8) {
    host.style.minHeight = innerH + 'px';
    host.style.display   = 'block';
    host.style.position  = host.style.position || 'relative';
    console.log(`[np-fix] minHeight applied ${innerH}px (${reason})`);
  }

  if (inner && !npResizeObs) {
    npResizeObs = new ResizeObserver(() => {
      const ih = inner.scrollHeight || inner.getBoundingClientRect().height;
      if (ih > 0) {
        host.style.minHeight = ih + 'px';
        if (host.getBoundingClientRect().height < ih * 0.8) host.style.minHeight = ih + 'px';
      }
    });
    try { npResizeObs.observe(inner); } catch {}
  }
}

/* ======================= ЗАВАНТАЖЕННЯ ВІДЖЕТІВ ======================= */
async function loadWidget(path, viewId) {
  const container = document.getElementById('main-content');
  if (!container) return;

  console.log('[loadOne] start:', { path, viewId });
  try {
    const res = await fetch(path);
    const html = await res.text();
    container.innerHTML = html;
    pinHeader();        
    ensureHeaderVisible();     
    localStorage.setItem(LAST_VIEW_KEY, viewId);
    console.log('[loadOne] inserted → LAST_VIEW_KEY =', viewId, 'children:', container.children.length);

    setTimeout(async () => {
      if (viewId === 'order' && INIT_ORDER_ON_LOAD) {
        try {
          const { initOrderWidget } = await safeImport('../widgets/order/js/category.js');
          await initOrderWidget?.();
          console.log('[loadOne] initOrderWidget done');
        } catch (e) { console.warn('[loadOne] ⚠️ initOrderWidget() пропущено:', e); }
      }
      if (viewId === 'nova-poshta') {
        try {
          const { initNovaPoshta } = await safeImport('../widgets/nova-poshta/js/main_adres.js');
          const { initSubmitAll }  = await safeImport('../widgets/nova-poshta/js/submit-all.js');
          const { loadComponent }  = await safeImport('./load-components.js');

          await loadComponent('form-customer-block', 'widgets/nova-poshta/components/forms/form-customer.html');
          await loadComponent('form-address-block',  'widgets/nova-poshta/components/forms/form-address.html');

          await initNovaPoshta();
          setTimeout(() => { try { initSubmitAll(); } catch {} console.log('[loadOne] initSubmitAll done'); }, 100);
          console.log('[loadOne] initNovaPoshta done');

          ensureNovaSpace('loadOne-np-init');
        } catch (e) {
          console.error('[loadOne] ❌ Nova Poshta init error:', e);
        }
      }
      logState('after loadOne init');
    }, 100);
  } catch (e) {
    container.innerHTML = `<p class="text-red-600">❌ Не вдалося завантажити віджет</p>`;
    console.error('[loadOne] ❌ Помилка при завантаженні/ініці:', e);
  }
}

async function loadBothWidgets() {
  const container = document.getElementById('main-content');
  if (!container) return;

  console.log('[both] start');
  try {
    container.innerHTML = `
      <div id="tabs-wrapper" class="layout-horizontal">
        <section id="tovar" class="tab-pane"></section>
        <section id="nova-poshta" class="tab-pane"></section>
      </div>
      <div class="footer-spacer"></div>
    `;
    console.log('[both] placeholders inserted');

    const { loadComponent } = await safeImport('./load-components.js');
    await loadComponent('tovar',       'pages/order.html');
    await loadComponent('nova-poshta', 'pages/nova-poshta.html');
    console.log('[both] order + nova pages loaded into sections');

    const tabsWrapper = document.getElementById('tabs-wrapper');
    tabsWrapper?.classList.add('both-mode');
    document.getElementById('tovar')?.classList.remove('hidden');

    forceShowNova();
    ensureNovaSpace('both-after-insert');
    logState('after placeholders+content');

    setTimeout(async () => {
      if (INIT_ORDER_ON_LOAD) {
        try {
          const { initOrderWidget } = await safeImport('../widgets/order/js/category.js');
          await initOrderWidget?.();  console.log('[both] initOrderWidget done');
        } catch (e) { console.warn('[both] ⚠️ initOrderWidget() (both)', e); }
      }
      try {
        const { initNovaPoshta } = await safeImport('../widgets/nova-poshta/js/main_adres.js');
        const { initSubmitAll }  = await safeImport('../widgets/nova-poshta/js/submit-all.js');
        const { loadComponent: loadPart }  = await safeImport('./load-components.js');

        await loadPart('form-customer-block', 'widgets/nova-poshta/components/forms/form-customer.html');
        await loadPart('form-address-block',  'widgets/nova-poshta/components/forms/form-address.html');

        await initNovaPoshta();
        setTimeout(() => { try { initSubmitAll(); } catch {} console.log('[both] initSubmitAll done'); }, 100);
        console.log('[both] initNovaPoshta done');

        ensureNovaSpace('both-after-np-init');
      } catch (e) { console.error('[both] ❌ Nova Poshta init (both)', e); }

      applySavedLayoutOrDefault();
      highlightLayoutButtons(localStorage.getItem(LAYOUT_KEY) || 'horizontal');
      clearTabButtons();

      const wrap = document.getElementById('tabs-wrapper');
      if (wrap?.classList.contains('layout-vertical')) scrollToNova();

      logState('after both init');
    }, 100);

    console.log('[both] ✅ BOTH через loadComponent');
  } catch (e) {
    container.innerHTML = `<p class="text-red-600">❌ Не вдалося завантажити обидва віджети</p>`;
    console.error('[both] ❌ loadBothWidgets() error:', e);
  }
}

/* ======================= ІНІЦІАЛІЗАЦІЯ ШАПКИ (кнопки/перемикачі) ======================= */
function initWidgetHeaderSwitcher() {
  ensureHeaderVisible();   
  // Анти-дубль: прив’язуємо слухачі лише один раз
  const header = document.getElementById('widget-header-origin') || document;
  if (header && header.dataset.legacyBound === '1') { console.log('[hdr-init] skip duplicate bind'); return; }
  if (header) header.dataset.legacyBound = '1';

  // Базові вузли керування
  const container   = document.getElementById('main-content');
  const btnOrder    = document.getElementById('btnOrderWidget');
  const btnNova     = document.getElementById('btnNovaWidget');
  const toggleBoth  = document.getElementById('toggleBoth');
  const btnLayVert  = document.getElementById('btnLayoutVertical');
  const btnLayHorz  = document.getElementById('btnLayoutHorizontal');
  if (!container || !btnOrder || !btnNova) { console.warn('[hdr-init] ⚠️ Кнопки або #main-content не знайдено'); return; }

  // Локальні утиліти
  const refs = () => ({ wrap: document.getElementById('tabs-wrapper'), tovar: document.getElementById('tovar'), nova: document.getElementById('nova-poshta') });
  const unhide = (el) => { if (!el) return; el.classList.remove('hidden'); el.removeAttribute?.('hidden'); el.removeAttribute?.('aria-hidden'); if (el.style.display === 'none') el.style.display = ''; try { if (getComputedStyle(el).display === 'none') el.style.display = 'block'; } catch {} };
  const forceBothVisible = () => { const { wrap, tovar, nova } = refs(); wrap?.classList.add('both-mode'); unhide(tovar); unhide(nova); };
  const stabilizeNovaHeight = () => { const { nova } = refs(); if (!nova) return; const inner = nova.querySelector('#nova-poshta-widget') || nova.firstElementChild; if (!inner) return; const h = inner.scrollHeight || inner.getBoundingClientRect().height || 0; if (h > 0) { nova.style.minHeight = h + 'px'; requestAnimationFrame(() => { setTimeout(() => { nova.style.minHeight = ''; }, 300); }); } };
  const observeNovaOnce = () => { const { nova } = refs(); if (!nova) return; const mo = new MutationObserver(() => { stabilizeNovaHeight(); mo.disconnect(); }); mo.observe(nova, { childList: true, subtree: true }); };
  const ensureNovaSpaceLocal = (reason = 'show') => { const { nova } = refs(); if (!nova) return; unhide(nova); stabilizeNovaHeight(); console.debug('[hdr-init] ensureNovaSpace:', reason); };
  const freezeJumps = (ms = 500) => { const t0 = window.scrollTo, t1 = window.scrollBy, t2 = Element.prototype.scrollIntoView; window.scrollTo = window.scrollBy = function(){}; Element.prototype.scrollIntoView = function(){}; setTimeout(() => { window.scrollTo = t0; window.scrollBy = t1; Element.prototype.scrollIntoView = t2; }, ms); };
  const mountViewportIfAny = () => { try { if (typeof mountStickyViewport === 'function') mountStickyViewport(); } catch {} };

  // Стартовий рендер
  const tabsWrapperExists = !!document.getElementById('tabs-wrapper');
  console.log('[hdr-init] start; tabsWrapperExists:', tabsWrapperExists, 'toggleBoth:', !!toggleBoth?.checked);

  if (!tabsWrapperExists) {
    const savedView = localStorage.getItem(LAST_VIEW_KEY);
    const orderData = localStorage.getItem(ORDER_KEY);
    console.log('[hdr-init] savedView=', savedView, 'orderData len=', orderData?.length);

    if (toggleBoth && toggleBoth.checked) {
      console.log('[hdr-init] load BOTH on start');
      loadBothWidgets()?.then(() => { forceBothVisible(); observeNovaOnce(); stabilizeNovaHeight(); mountViewportIfAny(); });
    } else {
      if (!savedView || !orderData || orderData === '[]') {
        console.log('[hdr-init] load ORDER on start');
        loadWidget('./pages/order.html', 'order').then(() => { highlightActiveTab('order'); mountViewportIfAny(); });
      } else {
        const isNova = savedView === 'nova-poshta';
        console.log('[hdr-init] load saved view on start ->', savedView);
        loadWidget(isNova ? './pages/nova-poshta.html' : './pages/order.html', savedView)
          .then(() => { highlightActiveTab(isNova ? 'nova-poshta' : 'order'); if (isNova) ensureNovaSpaceLocal('start-load'); mountViewportIfAny(); });
      }
    }
  } else {
    highlightLayoutButtons(localStorage.getItem(LAYOUT_KEY) || 'horizontal');
    mountViewportIfAny();                                   // tabs уже є → одразу обгортаємо viewport’ом
  }

  // КЛІКИ ВКЛАДОК
  btnOrder.addEventListener('click', () => {
    freezeJumps();
    const { wrap, tovar, nova } = refs();
    const hasTabs = !!wrap;
    console.log('[btn] Товари click; hasTabs:', hasTabs, 'toggleBoth:', !!toggleBoth?.checked);

    if (toggleBoth?.checked || hasTabs) {
      tovar?.classList.remove('hidden'); nova?.classList.add('hidden'); wrap?.classList.remove('both-mode');
      localStorage.setItem(LAST_VIEW_KEY, 'order');
      if (toggleBoth) toggleBoth.checked = false;
      highlightActiveTab('order');
      mountViewportIfAny();
      logState?.('after btnOrder');
      return;
    }

    loadWidget('./pages/order.html', 'order').then(() => { highlightActiveTab('order'); mountViewportIfAny(); });
  });

  btnNova.addEventListener('click', () => {
    freezeJumps();
    const { wrap, tovar, nova } = refs();
    const hasTabs = !!wrap;
    console.log('[btn] Доставка click; hasTabs:', hasTabs, 'toggleBoth:', !!toggleBoth?.checked);

    if (toggleBoth?.checked || hasTabs) {
      nova?.classList.remove('hidden'); tovar?.classList.add('hidden'); wrap?.classList.remove('both-mode');
      localStorage.setItem(LAST_VIEW_KEY, 'nova-poshta');
      if (toggleBoth) toggleBoth.checked = false;
      highlightActiveTab('nova-poshta');
      ensureNovaSpaceLocal('tab-click');
      mountViewportIfAny();
      logState?.('after btnNova');
      return;
    }

    loadWidget('./pages/nova-poshta.html', 'nova-poshta').then(() => {
      highlightActiveTab('nova-poshta'); ensureNovaSpaceLocal('single-load'); mountViewportIfAny();
    });
  });

  // ТУМБЛЕР «ПОКАЗАТИ ОБИДВА»
  toggleBoth?.addEventListener('change', async () => {

    ensureHeaderVisible();    
    freezeJumps();
    let { wrap } = refs();

    if (toggleBoth.checked) {
      if (!wrap) { await loadBothWidgets(); wrap = refs().wrap; }
      forceBothVisible(); observeNovaOnce(); stabilizeNovaHeight(); mountViewportIfAny();
    } else {
      const last = localStorage.getItem(LAST_VIEW_KEY) || 'nova-poshta';
      const { tovar, nova } = refs();
      tovar?.classList.toggle('hidden', last !== 'order');
      nova ?.classList.toggle('hidden', last !== 'nova-poshta');
      wrap ?.classList.remove('both-mode');
      if (last === 'nova-poshta') ensureNovaSpaceLocal('toggle-off');
      mountViewportIfAny();
    }
  });

  // КНОПКИ ОРІЄНТАЦІЇ
 // КНОПКИ ОРІЄНТАЦІЇ
btnLayVert?.addEventListener('click', () => {
  freezeJumps();
  applyLayout('vertical');
  if (toggleBoth?.checked) { forceBothVisible(); observeNovaOnce(); stabilizeNovaHeight(); }

  ensureHeaderVisible();   // ← обовʼязково перед монтуванням viewport
  mountStickyViewport();   // ← достатньо; mountViewportIfAny не потрібно
});

btnLayHorz?.addEventListener('click', () => {
  freezeJumps();
  applyLayout('horizontal');
  if (toggleBoth?.checked) { forceBothVisible(); observeNovaOnce(); stabilizeNovaHeight(); }

  ensureHeaderVisible();   // ← обовʼязково
  mountStickyViewport();   // ← достатньо
});


  highlightLayoutButtons(localStorage.getItem(LAYOUT_KEY) || 'horizontal');
  logState?.('after init');

  window.addEventListener('resize', () => ensureNovaSpaceLocal('resize'));
}

/* ===== API: примусово задати орієнтацію ===== */
export function setWidgetsLayout(mode = 'horizontal') {
  applyLayout(mode === 'vertical' ? 'vertical' : 'horizontal');
}

/* ===== Допоміжні функції для НП/табів (глобальні) ===== */

// Показати секцію НП незалежно від hidden/display
function forceShowNova() {
  const nova = document.getElementById('nova-poshta');
  if (!nova) { console.warn('[forceShowNova] no #nova-poshta'); return; }
  nova.classList.remove('hidden'); nova.removeAttribute?.('hidden'); nova.style.display = 'block';
  nova.querySelectorAll('[hidden]').forEach(el => el.removeAttribute('hidden'));
  nova.querySelectorAll('[style*="display:none"]').forEach(el => el.style.display = '');
  try { if (getComputedStyle(nova).display === 'none') nova.style.display = 'block'; } catch {}
  console.log('[forceShowNova] ok; h=', nova.getBoundingClientRect().height);
}

// Автоскрол до НП
function scrollToNova() {
  const el = document.getElementById('nova-poshta');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try { window.scrollBy({ top: -80, left: 0, behavior: 'instant' }); } catch {}
  console.log('[scroll] to nova-poshta');
}

/* === Автопоказ/автоскрол НП у вертикальному режимі (для «both») === */
(function installAutoNovaReveal(){
  let onceBound = false;
  const ensureNovaSpace = () => {
    const host  = document.getElementById('nova-poshta');
    if (!host) return;
    const inner = host.querySelector('#nova-poshta-widget') || host.firstElementChild;
    const ih = inner ? (inner.scrollHeight || inner.getBoundingClientRect().height) : 0;
    if (ih > 0) { host.style.minHeight = ih + 'px'; host.style.display = 'block'; }
  };
  const scrollToNova = () => {
    const el = document.getElementById('nova-poshta');
    if (!el) return;
    el.scrollIntoView({behavior:'smooth', block:'start'});
    try { window.scrollBy({top:-80, left:0, behavior:'instant'}); } catch {}
  };

  const reveal = (reason) => {
    const wrap  = document.getElementById('tabs-wrapper');
    const both  = wrap?.classList.contains('both-mode');
    const vert  = wrap?.classList.contains('layout-vertical');
    if (!wrap || !both || !vert) return;

    document.getElementById('tovar')?.classList.remove('hidden');
    const np = document.getElementById('nova-poshta');
    if (!np) return;
    np.classList.remove('hidden'); np.style.display = 'block';

    ensureNovaSpace();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      ensureNovaSpace();
      scrollToNova();
      if (tries >= 6 || np.querySelector('#nova-poshta-widget')) clearInterval(timer);
    }, 250);

    console.debug('[autoNova]', reason, '→ reveal+scroll');
  };

  const kick = () => reveal('kick');

  const mo = new MutationObserver((mutList) => {
    for (const m of mutList) {
      if (m.type === 'attributes' && m.attributeName === 'class') reveal('observer');
    }
  });
  const bindObserver = () => {
    if (onceBound) return;
    const wrap = document.getElementById('tabs-wrapper');
    if (wrap) { mo.observe(wrap, { attributes:true }); onceBound = true; reveal('bind'); }
  };

  let a = 0; const att = setInterval(() => { bindObserver(); if (++a > 20 || onceBound) clearInterval(att); }, 200);

  window.addEventListener('resize', () => reveal('resize'));
  setTimeout(kick, 300);
})();

// Шапка завжди видима (про всяк випадок знімемо будь-яке приховування)
function ensureHeaderVisible() {
  const hdr = document.getElementById('widget-header-origin');
  if (!hdr) return;
  hdr.classList.remove('hidden');
  hdr.removeAttribute?.('hidden');
  if (hdr.style.display === 'none') hdr.style.display = '';
  try { if (getComputedStyle(hdr).display === 'none') hdr.style.display = 'block'; } catch {}
}


// Показати обидві секції та зняти всі приховування
function forceBothVisible() {
  const wrap = document.getElementById('tabs-wrapper');
  if (!wrap) return;
  wrap.classList.add('both-mode');

  ['tovar','nova-poshta'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.removeAttribute('hidden');
    el.style.removeProperty('display');
    el.style.overflow = 'visible';
  });
}

// Підстрахувати висоту секції НП (щоб рядок ґріда не стиснувся)
function stabilizeNovaHeight() {
  const host  = document.getElementById('nova-poshta');
  if (!host) return;

  const inner = host.querySelector('#nova-poshta-widget') || host.firstElementChild;
  const h = inner ? (inner.scrollHeight || inner.getBoundingClientRect().height) : 0;

  if (h > 0) {
    host.style.minHeight = h + 'px';
    host.style.display   = 'block';
    host.style.overflow  = 'visible';
  } else {
    host.style.minHeight = '320px';
    host.style.display   = 'block';
  }
}

// Якщо НП догружається пізніше — підловити появу і зафіксувати висоту
function observeNovaOnce() {
  const host = document.getElementById('nova-poshta');
  if (!host) return;

  if (host.querySelector('#nova-poshta-widget')) { stabilizeNovaHeight(); return; }

  const mo = new MutationObserver((ml) => {
    for (const m of ml) {
      if (m.type === 'childList' && host.querySelector('#nova-poshta-widget')) {
        stabilizeNovaHeight(); mo.disconnect(); break;
      }
    }
  });
  mo.observe(host, { childList: true, subtree: true });

  let tries = 0;
  const t = setInterval(() => {
    tries++;
    stabilizeNovaHeight();
    if (tries >= 8 || host.querySelector('#nova-poshta-widget')) clearInterval(t);
  }, 250);
}
