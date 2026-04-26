// Контролер шапки: Товари/Доставка/Обидва + Горизонтально/Вертикально
// Шапка незалежна; під нею — один в’юпорт зі скролом для віджетів.

export function initHeaderTabs(root = document) {
  const win = root.defaultView || window;
  if (win.__headerTabsOnce) return;
  win.__headerTabsOnce = true;

  const $  = (sel, scope = root) => scope.querySelector(sel);
  const $$ = (sel, scope = root) => Array.from(scope.querySelectorAll(sel));
  const lc = s => (s || '').toLowerCase();

  // Фолбек для .hidden
  if (!$('#__hidden_fallback_css')) {
    const st = root.createElement('style');
    st.id = '__hidden_fallback_css';
    st.textContent = '.hidden{display:none!important}';
    root.head.appendChild(st);
  }

  // ───── базові вузли ─────
  const toolbar = () => $('#tabs-wrapper') || $('.tabs-wrapper') || $('[data-toolbar="orders"]');
  const goods   = () => $('#tovar') || $('[data-panel="tovar"]');
  const nova    = () => $('#nova-poshta') || $('[data-panel="nova-poshta"], [data-panel="delivery"]');

  // прибрати локальні скроли у віджетах
  function stripOverflow(scope) {
    $$('#tovar, #nova-poshta, #tovar *, #nova-poshta *', scope || root).forEach(el => {
      if (!el.style) return;
      if (/(auto|scroll)/i.test(el.style.overflow))  el.style.overflow  = '';
      if (/(auto|scroll)/i.test(el.style.overflowY)) el.style.overflowY = '';
      if (/(auto|scroll)/i.test(el.style.overflowX)) el.style.overflowX = '';
      if (el.style.maxHeight) el.style.maxHeight = '';
    });
  }

  // ───── viewport + wrap (шапка незалежна і завжди зверху) ─────
  function ensureViewportWrap() {
    const tb = toolbar(), g = goods(), n = nova();
    if (!tb || !g || !n) return { viewport: null, wrap: null };

    // 1) шапка липка та поверх віджетів
    tb.style.position   = tb.style.position || 'sticky';
    tb.style.top        = tb.style.top || '0';
    tb.style.zIndex     = tb.style.zIndex || '50';
    tb.style.background = tb.style.background || 'inherit';

    // 2) viewport — САМЕ після шапки
    let viewport = $('#orders-viewport');
    if (!viewport) {
      viewport = root.createElement('div');
      viewport.id = 'orders-viewport';
      Object.assign(viewport.style, {
        position: 'relative',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        scrollbarGutter: 'stable',
        marginTop: '8px',           // відступ від шапки
        padding: '0 8px 16px 8px',
        zIndex: '1',
      });
    }
    if (viewport.previousElementSibling !== tb) {
      tb.parentElement.insertBefore(viewport, tb.nextSibling);
    }

    // 3) wrap усередині viewport
    let wrap = $('#orders-panels-wrap') || $('[data-panels]') || $('.orders-panels');
    if (!wrap) {
      wrap = root.createElement('div');
      wrap.id = 'orders-panels-wrap';
    }
    if (wrap.parentElement !== viewport) viewport.appendChild(wrap);

    // 4) перенести панелі в wrap
    if (g.parentElement !== wrap) wrap.appendChild(g);
    if (n.parentElement !== wrap) wrap.appendChild(n);

    // 5) прибрати внутрішні скроли
    stripOverflow(wrap);

    return { viewport, wrap };
  }

  // Висота в’юпорта: від його власного top до низу вікна
  function recalcViewportHeight() {
    const { viewport } = ensureViewportWrap();
    if (!viewport) return;
    const top = viewport.getBoundingClientRect().top;        // реальний top під шапкою
    const h   = Math.max(260, Math.floor((win.innerHeight || 800) - top - 8));
    viewport.style.height = h + 'px';
  }

  // ───── UI helpers ─────
  function setHidden(el, hide){ if (!el) return; el.classList.toggle('hidden', !!hide); }

  function underlineTab(tab){
    const tb = toolbar();
    const btnGoods = $('#btnOrderWidget') || tb?.querySelector('[data-tab="goods"], [data-tab="tovar"]');
    const btnNova  = $('#btnNovaWidget')  || tb?.querySelector('[data-tab="delivery"], [data-tab="nova"]');
    const on  = el => el?.classList.add('bg-white','text-black','font-medium');
    const off = el => el?.classList.remove('bg-white','text-black','font-medium');
    off(btnGoods); off(btnNova);
    if (tab === 'goods') on(btnGoods);
    if (tab === 'delivery') on(btnNova);
  }

  function updateChildFlex(mode) {
    const g = goods(), n = nova();
    const { wrap } = ensureViewportWrap();
    if (!wrap || !g || !n) return;

    const bothVisible = !g.classList.contains('hidden') && !n.classList.contains('hidden');

    wrap.style.display       = 'flex';
    wrap.style.flexWrap      = 'nowrap';
    wrap.style.alignItems    = 'stretch';
    if (!wrap.style.gap) wrap.style.gap = '12px';
    wrap.style.flexDirection = (mode === 'col') ? 'column' : 'row';

    [g, n].forEach(p => { p.style.minWidth = '0'; p.style.overflow = ''; p.style.maxHeight = ''; });
    if (bothVisible) {
      g.style.flex = '1 1 0%';
      n.style.flex = '1 1 0%';
    } else {
      const vis = g.classList.contains('hidden') ? n : g;
      const hid = vis === g ? n : g;
      vis.style.flex = '1 1 100%';
      hid.style.flex = '0 0 auto';
    }
  }

  function applyLayout(mode /* 'row' | 'col' */){
    const tb = toolbar();
    ensureViewportWrap();
    updateChildFlex(mode);

    tb?.classList.toggle('layout-vertical',   mode === 'col');
    tb?.classList.toggle('layout-horizontal', mode !== 'col');

    // підсвітка кнопок орієнтації
    const btnH = $('#btnLayoutHorizontal') || $('#layout-horizontal') || tb?.querySelector('[data-layout="row"]');
    const btnV = $('#btnLayoutVertical')   || $('#layout-vertical')   || tb?.querySelector('[data-layout="col"]');
    const on  = el => el?.classList.add('bg-white','text-black','font-medium');
    const off = el => el?.classList.remove('bg-white','text-black','font-medium');
    if (mode === 'col') { on(btnV); off(btnH); } else { on(btnH); off(btnV); }

    recalcViewportHeight();
  }

  function getMode(){
    const tb = toolbar();
    return tb?.classList.contains('layout-vertical') ? 'col' : 'row';
  }

  function showGoods(){ setHidden(goods(), false); setHidden(nova(),  true);  toolbar()?.classList.remove('both-mode'); underlineTab('goods');     updateChildFlex(getMode()); recalcViewportHeight(); }
  function showNova(){  setHidden(nova(),  false); setHidden(goods(), true);  toolbar()?.classList.remove('both-mode'); underlineTab('delivery'); updateChildFlex(getMode()); recalcViewportHeight(); }
  function showBoth(){  setHidden(goods(), false); setHidden(nova(),  false); toolbar()?.classList.add('both-mode');    underlineTab(null);       updateChildFlex(getMode()); recalcViewportHeight(); }

  // ───── кнопки (id → data-* → текст) ─────
  function byText(scope, texts){
    const cand = $$('button,a,label,span,div,input', scope);
    const t = texts.map(lc);
    return cand.find(el=>{
      const s = lc(el.textContent) + ' ' + lc(el.id) + ' ' +
                lc(el.getAttribute('data-tab')) + ' ' +
                lc(el.getAttribute('data-layout'));
      return t.some(x=>s.includes(x));
    }) || null;
  }

  function wire(){
    const tb = toolbar(), g = goods(), n = nova();
    if (!tb || !g || !n) return;

    const btnGoods   = $('#btnOrderWidget') || tb.querySelector('[data-tab="goods"], [data-tab="tovar"]') || byText(tb, ['товар','goods','tovar']);
    const btnNova    = $('#btnNovaWidget')  || tb.querySelector('[data-tab="delivery"], [data-tab="nova"]') || byText(tb, ['достав','delivery','nova']);
    const toggleBoth = $('#toggleBoth') || $('#toggle-both') || tb.querySelector('[data-toggle="both"]') || byText(tb, ['обидв','both']);
    const btnH       = $('#btnLayoutHorizontal') || $('#layout-horizontal') || tb.querySelector('[data-layout="row"]') || byText(tb, ['гориз','horizontal','row']);
    const btnV       = $('#btnLayoutVertical')   || $('#layout-vertical')   || tb.querySelector('[data-layout="col"]') || byText(tb, ['вертик','vertical','col']);

    ensureViewportWrap();
    stripOverflow();

    function bind(el, ev, fn){
      if (!el) return;
      el.addEventListener(ev, e => {
        const lab = e.target.closest?.('label[for]');
        if (lab) { const id = lab.getAttribute('for'); const inp = id && root.getElementById(id); if (inp) { inp.click?.(); return; } }
        e.preventDefault(); fn(e);
      }, true);
    }

    bind(btnGoods, 'click', () => {
      const both = (toggleBoth && 'checked' in toggleBoth) ? !!toggleBoth.checked : false;
      both ? showBoth() : showGoods();
    });
    bind(btnNova, 'click', () => {
      const both = (toggleBoth && 'checked' in toggleBoth) ? !!toggleBoth.checked : false;
      both ? showBoth() : showNova();
    });

    if (toggleBoth) {
      if (toggleBoth.tagName === 'INPUT') {
        toggleBoth.addEventListener('change', e => e.target.checked ? showBoth() : showNova(), true);
      } else {
        bind(toggleBoth, 'click', () => {
          const isOn = toolbar()?.classList.contains('both-mode');
          isOn ? showNova() : showBoth();
        });
      }
    }

    bind(btnH, 'click', () => applyLayout('row'));
    bind(btnV, 'click', () => applyLayout('col'));

    // старт: горизонтально + Доставка
    applyLayout('row');
    showNova();

    // висота в’юпорта — при завантаженні та на ресайз
    recalcViewportHeight();
    win.addEventListener('resize', recalcViewportHeight);

    console.log('[header-tabs] wired (header fixed, single viewport with scroll)');
  }

  // Якщо ще не все в DOM — дочекаємось
  const mo = new (win.MutationObserver || window.MutationObserver)(() => {
    if (toolbar() && goods() && nova()) { mo.disconnect(); wire(); }
  });
  mo.observe(root.documentElement || root, { childList: true, subtree: true });

  if (toolbar() && goods() && nova()) { mo.disconnect?.(); wire(); }
}
