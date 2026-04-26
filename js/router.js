// frontend/js/router.js

// ------------------- БАЗОВІ імпорти -------------------
import { loadComponent } from './load-components.js';
import { clearWidgetHeader } from './load-header-widget.js';
import { initConfig } from '../widgets/config-kv/config-kv.js';

let currentPage = null;

// ===== ROUTES: явні відповідності data-page -> файл сторінки =====
const ROUTES = {
  'finance-widget': 'pages/finance-widget.html',
  'finance':        'pages/finance-widget.html',
  'budget':         'pages/finance-widget.html',
  'managers':       'pages/managers.html',


};

// Утиліта очікування елемента
async function waitFor(sel, { tries = 80, delay = 50 } = {}) {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await new Promise(r => setTimeout(r, delay));
  }
  return null;
}

// Активувати <script> усередині щойно вставленого HTML (innerHTML їх не запускає)
function activateInlineScripts(scope) {
  if (!scope) return;
  scope.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    if (old.src) s.src = old.src; else s.textContent = old.textContent || '';
    old.replaceWith(s);
  });
}

// ------------------- Основний лоадер сторінок -------------------
export async function loadPage(pageName) {
  if (pageName === currentPage) return;
  currentPage = pageName;

  try { await initConfig(); } catch (e) { console.warn('[CONFIG] init failed:', e); }

  const container = document.getElementById('main-content');
  if (!container) { console.warn('[router] #main-content не знайдено'); return; }

  // ------------------- Nova Poshta (спец-гілка) -------------------
  if (pageName === 'nova-poshta') {
    try {
      // 1) Шапка з плейсхолдерами
      await loadComponent('main-content', './components/widgets/header-orders.html');
      activateInlineScripts(container);

      // 2) Дочекатися плейсхолдерів панелей
      await waitFor('#tovar');
      await waitFor('#nova-poshta');

      // 3) Завантажити вміст обох секцій
      await loadComponent('tovar',       'pages/order.html');       // Товари
      await loadComponent('nova-poshta', 'pages/nova-poshta.html'); // Доставка

      // 4) Частини форм НП (всередині секції доставки)
      await waitFor('#form-customer-block');
      await waitFor('#form-address-block');
      await loadComponent('form-customer-block', 'widgets/nova-poshta/components/forms/form-customer.html');
      await loadComponent('form-address-block',  'widgets/nova-poshta/components/forms/form-address.html');

      // 5) Активувати скрипти з фрагментів (якщо є)
      activateInlineScripts(container);

      // 6) Під’єднати контролер кнопок у шапці (таби/обидва/орієнтація)
      const { initHeaderTabs } = await import('../components/widgets/header-orders-tabs.js?ts=' + Date.now());
      await initHeaderTabs(document); // <— важливо дати document

      // 7) Логіка віджетів
      const { initNovaPoshta }  = await import('../widgets/nova-poshta/js/main_adres.js');
      const { initSubmitAll }   = await import('../widgets/nova-poshta/js/submit-all.js');
      const { initOrderWidget } = await import('../widgets/order/js/category.js');

      await initNovaPoshta();
      await initSubmitAll();
      await initOrderWidget();

      console.log('🚀 Nova Poshta + Товари: шапка/таби/орієнтація активні');
    } catch (error) {
      console.error('❌ Помилка під час ініціалізації Nova Poshta:', error);
    }
    return; // не виконуємо базове завантаження нижче
  }

  // ------------------- Інші сторінки — стандартна схема -------------------
  const mapped = ROUTES[pageName];
  const path = mapped || `pages/${pageName}.html`;

  let html = '<div class="p-4">Сторінку не знайдено</div>';
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    html = res.ok ? await res.text() : html;
  } catch (e) {
    console.warn('[router] fetch error for', path, e);
  }

  container.innerHTML = html;
  console.log(`✅ Сторінка "${pageName}" завантажена`);

  if (pageName !== 'nova-poshta') clearWidgetHeader();

  // ------------------- Admin -------------------
  if (pageName === 'admin') {
    try {
      await import('../widgets/admin/auth.js');
      const pageMod = await import('../widgets/admin/admin.js');
      pageMod.initAdminPage?.();
      console.log('🚀 Admin ініціалізовано');
    } catch (e) {
      console.error('❌ Помилка ініціалізації Admin:', e);
    }
  }

  // ------------------- Config (KEY / VALUE) -------------------
  if (pageName === 'config-kv') {
    try {
      const mod = await import('../widgets/config-kv/config-kv-page.js?ts=' + Date.now());
      await mod.initConfigKVPage(document);
      console.log('🚀 Config KV — ініціалізовано');
    } catch (e) {
      console.error('❌ Помилка ініціалізації Config KV:', e);
    }
  }

  // ------------------- Settings → Templates -------------------
  if (pageName === 'settings-template') {
    try {
      const modTpl = await import('../widgets/template/template.js?ts=' + Date.now());
      if (modTpl.TemplateWidget?.initTemplateSettings) {
        modTpl.TemplateWidget.initTemplateSettings();
      } else if (window.TemplateWidget?.initTemplateSettings) {
        window.TemplateWidget.initTemplateSettings();
      }

      const editor = await waitFor('#tpl-editor');
      if (!editor) {
        console.warn('[settings-template] #tpl-editor не знайдено — інструменти логіки не змонтовано');
        return;
      }

      const modLogic = await import('../widgets/template/template-logics.js?ts=' + Date.now());
      const host =
        container.querySelector('#logic-tools-slot') ||
        container.querySelector('#tpl-insert-key')?.parentElement ||
        container.querySelector('#tpl-toolbar') ||
        container;

      const mount = modLogic.mountLogicSnippets || window.mountLogicSnippets;
      if (typeof mount === 'function') {
        mount(host);
      } else {
        console.warn('mountLogicSnippets не знайдено у template-logics.js');
      }
    } catch (e) {
      console.warn('⚠️ settings-template: не вдалося підключити логіку:', e);
    }
  }

  // ------------------- Order -------------------
  if (pageName === 'order') {
    try {
      const { initOrderWidget } = await import('../widgets/order/js/category.js');
      await initOrderWidget();
    } catch (e) {
      console.error('❌ initOrderWidget не знайдено або помилка імпорту', e);
    }
  }

// ------------------- Managers -------------------
if (pageName === 'managers') {
  try {
    const { initManagersWidget } = await import('../widgets/managers/js/managers.js?ts=' + Date.now());
    initManagersWidget(container);
    console.log('🚀 Managers ініціалізовано');
  } catch (e) {
    console.error('❌ Помилка ініціалізації Managers:', e);
  }
}




  // ------------------- All-orders -------------------
  if (pageName === 'all-orders') {
    try {
      const { initAllOrders } = await import('../widgets/All-orders/js/all-orders.js?ts=' + Date.now());
      initAllOrders(container);
      console.log('🚀 All-orders ініціалізовано');
    } catch (e) {
      console.error('❌ Помилка ініціалізації All-orders:', e);
    }
  }




}






// ------------------- Роутінг -------------------
export async function initRouting() {
  try { await initConfig(); } catch (e) { console.warn('[CONFIG] init failed:', e); }

  // Делегування кліків по меню (мають атрибут data-page)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.menu-item[data-page]');
    if (!a) return;
    e.preventDefault();
    const page = a.dataset.page;
    location.hash = page;
    loadPage(page);
  });

  function currentPageFromHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (h && ROUTES[h]) return h;
    if (h) return h;
    return 'dashboard';
  }

  loadPage(currentPageFromHash());
  window.addEventListener('hashchange', () => loadPage(currentPageFromHash()));

  // глобальний AUTH (якщо потрібен)
  import('../widgets/admin/auth.js')
    .then(m => m.initAuth?.({ headerTargets: { loginBtn: 'global-login-btn', badgeEl: 'global-user-badge' } }))
    .catch(err => console.error('[auth] init failed:', err));
}
