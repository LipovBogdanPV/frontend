// frontend/js/tabs-hotfix.js
// Авто-підключення кнопок "Товари/Доставка/Обидва" + "Гориз./Вертик." з витримкою до будь-яких перерендерів

export function startTabsHotfix() {
  if (window.__tabsHotfixStarted) return;
  window.__tabsHotfixStarted = true;

  const log = (...a) => console.debug('[tabs-hotfix]', ...a);

  function $(sel, root = document) { return root.querySelector(sel); }
  function toolbarEl() { return $('#tabs-wrapper') || $('.tabs-wrapper') || $('[data-toolbar="orders"]'); }
  function goodsEl()   { return $('#tovar'); }
  function novaEl()    { return $('#nova-poshta'); }

  function getPanelsWrap() {
    const g = goodsEl(), n = novaEl();
    if (!g || !n) return null;

    const explicit =
      $('#orders-viewport') || $('#orders-panels') || $('#orders-panels-wrap') ||
      $('[data-panels]') || $('.orders-panels');
    if (explicit) return explicit;

    if (g.parentElement && g.parentElement === n.parentElement) return g.parentElement;

    // lca
    const lca = (function (a, b) {
      const seen = new Set();
      for (let x = a; x; x = x.parentElement) seen.add(x);
      for (let x = b; x; x = x.parentElement) if (seen.has(x)) return x;
      return a?.parentElement || b?.parentElement || null;
    })(g, n);
    if (!lca) return null;

    const wrap = document.createElement('div');
    wrap.id = 'orders-panels-wrap';
    lca.insertBefore(wrap, g);
    wrap.appendChild(g);
    wrap.appendChild(n);
    return wrap;
  }

  function setHidden(el, hide) {
    if (!el) return;
    el.classList.toggle('hidden', !!hide);
    // дубль-фолбек на випадок відсутності класу .hidden
    el.style.display = hide ? 'none' : '';
  }

  function underlineTab(tab) {
    const tb = toolbarEl();
    const btnGoods = $('#btnOrderWidget') || tb?.querySelector('[data-tab="goods"], [data-tab="tovar"]');
    const btnNova  = $('#btnNovaWidget')  || tb?.querySelector('[data-tab="delivery"], [data-tab="nova"]');
    const on  = el => el?.classList.add('bg-white','text-black','font-medium');
    const off = el => el?.classList.remove('bg-white','text-black','font-medium');
    if (tab === 'goods') { on(btnGoods); off(btnNova); }
    else if (tab === 'delivery') { on(btnNova); off(btnGoods); }
    else { off(btnGoods); off(btnNova); }
  }

  function applyLayout(mode /* 'row'|'col' */) {
    const tb = toolbarEl();
    const wrap = getPanelsWrap();
    if (tb) {
      tb.classList.toggle('layout-vertical',   mode === 'col');
      tb.classList.toggle('layout-horizontal', mode !== 'col');
      tb.dataset.layout = mode;
    }
    if (wrap) {
      wrap.style.display = 'flex';
      wrap.style.flexWrap = 'nowrap';
      wrap.style.alignItems = 'flex-start';
      if (!wrap.style.gap) wrap.style.gap = '12px';
      wrap.style.flexDirection = (mode === 'col') ? 'column' : 'row';
      wrap.dataset.layout = mode;
    }
    try { localStorage.setItem('orders:layout', mode); } catch {}
    const btnH = $('#btnLayoutHorizontal') || $('#layout-horizontal') || $('[data-layout="row"]');
    const btnV = $('#btnLayoutVertical')   || $('#layout-vertical')   || $('[data-layout="col"]');
    const on  = el => el?.classList.add('bg-white','text-black','font-medium');
    const off = el => el?.classList.remove('bg-white','text-black','font-medium');
    if (mode === 'col') { on(btnV); off(btnH); } else { on(btnH); off(btnV); }
    log('layout =', mode);
  }

  function showGoods() {
    const g = goodsEl(), n = novaEl(); if (!g || !n) return;
    setHidden(g, false); setHidden(n, true);
    toolbarEl()?.classList.remove('both-mode');
    try { localStorage.setItem('lastWidgetView','order'); } catch {}
    underlineTab('goods');
    log('tab = goods');
  }
  function showNova() {
    const g = goodsEl(), n = novaEl(); if (!g || !n) return;
    setHidden(n, false); setHidden(g, true);
    toolbarEl()?.classList.remove('both-mode');
    try { localStorage.setItem('lastWidgetView','nova-poshta'); } catch {}
    underlineTab('delivery');
    log('tab = delivery');
  }
  function showBoth() {
    const g = goodsEl(), n = novaEl(); if (!g || !n) return;
    setHidden(g, false); setHidden(n, false);
    toolbarEl()?.classList.add('both-mode');
    underlineTab(null);
    log('tab = both');
  }

  function resolveIntent(target) {
    if (!target) return null;

    // підтримка label[for]
    const lbl = target.closest?.('label[for]');
    if (lbl) {
      const forId = lbl.getAttribute('for');
      const inp = forId && document.getElementById(forId);
      if (inp) target = inp;
    }

    const raw = (
      (target.getAttribute?.('data-layout') || target.value || target.id || '') + ' ' +
      (target.className || '') + ' ' + (target.textContent || '')
    ).toLowerCase();

    // layout
    if (raw.match(/vertical|вертик|col|vert/)) return { type:'layout', mode:'col' };
    if (raw.match(/horizontal|гориз|row|horiz/)) return { type:'layout', mode:'row' };

    // tabs
    if (target.closest?.('[data-tab="goods"], [data-tab="tovar"], #btnOrderWidget') ||
        raw.match(/товар|goods|tovar/)) return { type:'tab', tab:'goods' };
    if (target.closest?.('[data-tab="delivery"], [data-tab="nova"], #btnNovaWidget') ||
        raw.match(/достав|delivery|nova/)) return { type:'tab', tab:'delivery' };

    if (target.closest?.('#toggleBoth, #toggle-both, [data-toggle="both"]') ||
        raw.match(/both|обидв/)) return { type:'both' };

    // data-layout прямі
    if (target.closest?.('[data-layout="col"]')) return { type:'layout', mode:'col' };
    if (target.closest?.('[data-layout="row"]')) return { type:'layout', mode:'row' };

    return null;
  }

  function wireToolbar(tb) {
    if (!tb || tb.__hotfixWired) return;
    const g = goodsEl(), n = novaEl();
    if (!g || !n) return;
    tb.__hotfixWired = true;
    log('wired');

    tb.addEventListener('click', (e) => {
      const intent = resolveIntent(e.target);
      if (!intent) return;

      // не блокуємо label→input, інакше radio/checkbox не перемкнеться
      const fromLabel = !!e.target.closest?.('label[for]');
      if (!fromLabel) { e.preventDefault(); e.stopPropagation(); }

      if (intent.type === 'layout') { applyLayout(intent.mode); return; }
      if (intent.type === 'both') {
        const toggle = e.target.closest('#toggleBoth, #toggle-both, [data-toggle="both"]') || $('#toggleBoth') || $('#toggle-both');
        const checked = ('checked' in (toggle||{})) ? !!toggle.checked : !tb.classList.contains('both-mode');
        checked ? showBoth() : (localStorage.getItem('lastWidgetView') === 'order' ? showGoods() : showNova());
        return;
      }
      if (intent.type === 'tab') {
        const toggle = $('#toggleBoth') || $('#toggle-both');
        (toggle && toggle.checked) ? showBoth() : (intent.tab === 'goods' ? showGoods() : showNova());
      }
    }, true);

    tb.addEventListener('change', (e) => {
      const el = e.target;
      if (!el) return;
      if (el.matches('#toggleBoth, #toggle-both, [data-toggle="both"]')) {
        el.checked ? showBoth() : (localStorage.getItem('lastWidgetView') === 'order' ? showGoods() : showNova());
        return;
      }
      const intent = resolveIntent(el);
      if (intent?.type === 'layout') applyLayout(intent.mode);
    }, true);

    // початковий стан
    applyLayout(localStorage.getItem('orders:layout') || 'row');
    const both = ($('#toggleBoth') || $('#toggle-both'))?.checked;
    if (both) showBoth(); else (localStorage.getItem('lastWidgetView') === 'order' ? showGoods() : showNova());
  }

  // слідкуємо за DOM і дротовуємо як тільки все з’явилось (і після кожного перерендеру)
  const mo = new MutationObserver(() => {
    const tb = toolbarEl(), g = goodsEl(), n = novaEl();
    if (tb && g && n) wireToolbar(tb);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // спроба одразу
  wireToolbar(toolbarEl());
  log('started');
}
