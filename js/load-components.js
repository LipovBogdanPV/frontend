// js/load-components.js
// Акуратний лоадер компонентів із дрібними захистами та подіями.

// -----------------------------------------------------------------------------
// ВНУТРІШНЄ: безпечне завантаження HTML-фрагмента і вставка в контейнер by id
// -----------------------------------------------------------------------------
export async function loadComponent(id, path) {
  try {
    // 1) Тягнемо HTML без кешу (щоб не залипали старі версії під час розробки)
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${path}`);

    const html = await res.text();

    // 2) Вставляємо в потрібний контейнер
    const host = document.getElementById(id);
    if (!host) {
      console.warn(`[loadComponent] контейнер #${id} не знайдено`);
      return null;
    }
    host.innerHTML = html;

    // 3) Спец-обробка для HEADER (нічого не видаляємо і не ламаємо)
    if (id === 'header') {
      const root = host; // вузол, в який підвантажено header.html

      // 3.1) Вайтліст службових id, які нам потрібні для auth-дропдауну тощо
      const KEEP_IDS = [
        'user-menu',
        'global-login-btn',
        'global-user-badge',
        'global-user-dropdown',
        'global-logout-btn',
      ];

      // Якщо раптом у розмітці дублюються ті ж id — акуратно переносимо дублікати у data-id
      KEEP_IDS.forEach((safeId) => {
        try {
          const nodes = root.querySelectorAll(`#${CSS.escape(safeId)}`);
          if (nodes.length > 1) {
            nodes.forEach((node, i) => {
              if (i > 0) {
                node.setAttribute('data-id', safeId);
                node.removeAttribute('id');
              }
            });
            console.log(`[hdr] fixed duplicate id="${safeId}" → зайві перенесено у data-id`);
          }
        } catch (_) {}
      });

      // 3.2) Виставляємо фактичну висоту шапки у CSS-змінну --hdr-h (для в’юпорту віджетів)
      const headerEl = root.firstElementChild || root;
      const hdrRect = headerEl?.getBoundingClientRect?.();
      const hdrH = Math.round(hdrRect?.height || 64);
      document.documentElement.style.setProperty('--hdr-h', `${hdrH}px`);

      // 3.3) Сповіщаємо інші модулі (напр., initAuth), що хедер уже в DOM
      document.dispatchEvent(new CustomEvent('header:loaded', { detail: { height: hdrH } }));
      window.dispatchEvent(new CustomEvent('header:loaded', { detail: { height: hdrH } })); // ← додано
    }

    // 4) Подія для кожного підвантаженого компоненту
    document.dispatchEvent(new CustomEvent(`component:${id}:loaded`));
    window.dispatchEvent(new CustomEvent(`component:${id}:loaded`)); // ← додано

    return host;
  } catch (err) {
    console.error('[loadComponent] fail:', id, path, err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Пакетне завантаження всіх стандартних компонентів
// -----------------------------------------------------------------------------
export async function loadAllComponents() {
  await loadComponent('header',  'components/header.html');
  await loadComponent('sidebar', 'components/sidebar.html');
  await loadComponent('footer',  'components/footer.html');

  // Глобальна подія: всі стандартні компоненти готові
  document.dispatchEvent(new Event('components:loaded'));
  window.dispatchEvent(new Event('components:loaded')); // ← додано
}
