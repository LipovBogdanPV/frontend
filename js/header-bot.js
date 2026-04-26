/**
 * ✅ Завантажує HTML-шапку у контейнер #widget-header і вмикає перемикачі віджетів
 * @param {string} path - шлях до HTML-файлу шапки
 */
export async function loadWidgetHeader(path) {
  try {
    const res = await fetch(path);
    const html = await res.text();
    const container = document.getElementById("widget-header");

    if (!container) {
      console.warn("❗️Контейнер #widget-header не знайдено в DOM");
      return;
    }

    container.innerHTML = html;

    // Невеличка затримка, щоби кнопки/чекбокси гарантовано з'явились у DOM
    setTimeout(() => {
      initWidgetHeaderSwitcher();
    }, 100);
  } catch (err) {
    console.error("❌ Помилка завантаження шапки:", path, err);
  }
}

/**
 * 🧹 Очищує шапку (вставляє порожній HTML)
 */
export function clearWidgetHeader() {
  const container = document.getElementById("widget-header");
  if (container) container.innerHTML = "";
}

/* ============================================================================
   📦🚚 Логіка перемикання між віджетами в #main-content
   - Підтримує:
     1) Окреме відображення: лише order або лише nova-poshta
     2) Режим "обидва": одночасне завантаження обох віджетів в #tabs-wrapper
   - Орієнтація ("вертикально"/"горизонтально") керується ТІЛЬКИ CSS-класом на
     #tabs-wrapper: .layout-vertical або .layout-horizontal (або .two-cols)
   ============================================================================ */

function initWidgetHeaderSwitcher() {
  const container = document.getElementById("main-content");
  const btnOrder  = document.getElementById("btnOrderWidget");
  const btnNova   = document.getElementById("btnNovaWidget");
  const toggleBoth = document.getElementById("toggleBoth"); // чекбокс "Показати обидва"

  if (!container || !btnOrder || !btnNova) {
    console.warn("⚠️ Кнопки або #main-content не знайдено");
    return;
  }

  // ——— Налаштування збереження стану ————————————————————————————————
  const LAST_VIEW_KEY     = "lastWidgetView";   // "order" | "nova-poshta"
  const ORDER_STORAGE_KEY = "order";            // твій існуючий ключ

  // ——— Опційно: ініціалізувати order-віджет відразу після вставки DOM ————
  // Залишаю як у тебе було (було закоментовано). Постав true, якщо треба.
  const INIT_ORDER_ON_LOAD = false;

  // ——— Допоміжне: акуратний dynamic import з логом ————————————————
  async function safeImport(path) {
    try {
      return await import(path);
    } catch (e) {
      console.error("❌ Помилка dynamic import:", path, e);
      throw e;
    }
  }

  // ——— 1) Завантажити ОДИН віджет (order або nova-poshta) ————————————
  const loadWidget = async (path, viewId) => {
    try {
      const res = await fetch(path);
      const html = await res.text();

      // повністю замінюємо вміст сторінки одним віджетом
      container.innerHTML = html;
      localStorage.setItem(LAST_VIEW_KEY, viewId);
      console.log(`✅ Завантажено віджет: ${path}`);

      // ініціалізація після вставки DOM
      setTimeout(async () => {
        if (viewId === "order") {
          // твоя логіка: ініціалізація order за потреби
          // (раніше було закоментовано — зберігаю поведінку)
          if (INIT_ORDER_ON_LOAD) {
            try {
              const { initOrderWidget } = await safeImport('../widgets/order/js/category.js');
              await initOrderWidget?.();
            } catch (e) {
              console.warn("⚠️ initOrderWidget() пропущено або впало:", e);
            }
          }
        }

        if (viewId === "nova-poshta") {
          try {
            const { initNovaPoshta } = await safeImport('../widgets/nova-poshta/js/main_adres.js');
            const { initSubmitAll }  = await safeImport('../widgets/nova-poshta/js/submit-all.js');
            const { loadComponent }  = await safeImport('./load-components.js');

            // вставляємо підформи у відповідні блоки Nova Poshta
            await loadComponent("form-customer-block", "widgets/nova-poshta/components/forms/form-customer.html");
            await loadComponent("form-address-block",  "widgets/nova-poshta/components/forms/form-address.html");

            // ініціалізація віджета НП
            await initNovaPoshta();
            setTimeout(() => { initSubmitAll(); }, 100);
          } catch (e) {
            console.error("❌ Nova Poshta init error:", e);
          }
        }
      }, 100);

    } catch (e) {
      container.innerHTML = `<p class="text-red-600">❌ Не вдалося завантажити віджет</p>`;
      console.error("❌ Помилка при завантаженні або ініціалізації віджета:", e);
    }
  };

  // ——— 2) Завантажити ОБИДВА віджети в один контейнер ————————————————
  const loadBothWidgets = async () => {
    try {
      // 2.1. Витягаємо обидва HTML паралельно
      const [orderRes, novaRes] = await Promise.all([
        fetch("./pages/order.html"),
        fetch("./pages/nova-poshta.html"),
      ]);
      const [orderHtml, novaHtml] = await Promise.all([
        orderRes.text(),
        novaRes.text(),
      ]);

      // 2.2. Малюємо обгортку з двома секціями (IDs збережені):
      // - орієнтацію керуємо ТІЛЬКИ CSS-класами на #tabs-wrapper
      //   (layout-vertical / layout-horizontal / two-cols)
      container.innerHTML = `
        <div id="tabs-wrapper" class="layout-horizontal">
          <section id="tovar" class="tab-pane">${orderHtml}</section>
          <section id="nova-poshta" class="tab-pane">${novaHtml}</section>
        </div>
        <div class="footer-spacer"></div>
      `;

      // 2.3. Після вставки DOM — ініціалізуємо кожен віджет окремо
      setTimeout(async () => {
        // — order —
        if (INIT_ORDER_ON_LOAD) {
          try {
            const { initOrderWidget } = await safeImport('../widgets/order/js/category.js');
            await initOrderWidget?.();
          } catch (e) {
            console.warn("⚠️ initOrderWidget() (both-mode) пропущено або впало:", e);
          }
        }

        // — nova-poshta —
        try {
          const { initNovaPoshta } = await safeImport('../widgets/nova-poshta/js/main_adres.js');
          const { initSubmitAll }  = await safeImport('../widgets/nova-poshta/js/submit-all.js');
          const { loadComponent }  = await safeImport('./load-components.js');

          await loadComponent("form-customer-block", "widgets/nova-poshta/components/forms/form-customer.html");
          await loadComponent("form-address-block",  "widgets/nova-poshta/components/forms/form-address.html");

          await initNovaPoshta();
          setTimeout(() => { initSubmitAll(); }, 100);
        } catch (e) {
          console.error("❌ Nova Poshta init error (both-mode):", e);
        }
      }, 100);

      // у "обидва" режимі підсвітку кнопок прибираємо
      clearButtonsActive();

      console.log("✅ Обидва віджети завантажено (режим BOTH)");
    } catch (e) {
      container.innerHTML = `<p class="text-red-600">❌ Не вдалося завантажити обидва віджети</p>`;
      console.error("❌ loadBothWidgets() error:", e);
    }
  };

  // ——— Внутрішні хелпери для підсвітки кнопок ————————————————
  function highlightActiveButton(viewId) {
    btnOrder.classList.remove('btn-dark');
    btnNova.classList.remove('btn-dark');
    if (viewId === "order")     btnOrder.classList.add('btn-dark');
    if (viewId === "nova-poshta") btnNova.classList.add('btn-dark');
  }
  function clearButtonsActive() {
    btnOrder.classList.remove('btn-dark');
    btnNova.classList.remove('btn-dark');
  }

  // ——— Стартове завантаження ————————————————————————————————
  const savedView = localStorage.getItem(LAST_VIEW_KEY);
  const orderData = localStorage.getItem(ORDER_STORAGE_KEY);

  // якщо ON — одразу показуємо обидва
  if (toggleBoth && toggleBoth.checked) {
    loadBothWidgets();
  } else {
    // інакше — логіка як у тебе
    if (!savedView || !orderData || orderData === "[]") {
      loadWidget("./pages/order.html", "order").then(() => highlightActiveButton("order"));
    } else {
      const isNova = savedView === "nova-poshta";
      loadWidget(isNova ? "./pages/nova-poshta.html" : "./pages/order.html", savedView)
        .then(() => highlightActiveButton(isNova ? "nova-poshta" : "order"));
    }
  }

  // ——— Обробка кнопок перемикача (одна вкладка) ————————————————
  btnOrder.addEventListener("click", () => {
    if (toggleBoth && toggleBoth.checked) {
      // у режимі BOTH кнопки працюють як "скрол до секції"
      const sec = container.querySelector("#tovar");
      sec?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    loadWidget("./pages/order.html", "order").then(() => highlightActiveButton("order"));
  });

  btnNova.addEventListener("click", () => {
    if (toggleBoth && toggleBoth.checked) {
      const sec = container.querySelector("#nova-poshta");
      sec?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    loadWidget("./pages/nova-poshta.html", "nova-poshta").then(() => highlightActiveButton("nova-poshta"));
  });

  // ——— Перемикач "Показати обидва" ————————————————————————————————
  if (toggleBoth) {
    toggleBoth.addEventListener("change", () => {
      if (toggleBoth.checked) {
        // Увімкнули режим BOTH → завантажити обидва
        loadBothWidgets();
      } else {
        // Вимкнули BOTH → повернутись до останнього обраного
        const last = localStorage.getItem(LAST_VIEW_KEY) || "order";
        const path = (last === "nova-poshta") ? "./pages/nova-poshta.html" : "./pages/order.html";
        loadWidget(path, last).then(() => highlightActiveButton(last));
      }
    });
  }
}

/* ============================================================================
   ✅ Додатково (за бажанням): зовнішній оратор для зміни орієнтації
   Викликати з будь-якого місця вашого коду:
      setWidgetsLayout('vertical')  або  setWidgetsLayout('horizontal')
   Це просто додає/знімає класи на #tabs-wrapper, якщо він існує в DOM.
   ============================================================================ */
export function setWidgetsLayout(mode = 'horizontal') {
  const wrapper = document.getElementById('tabs-wrapper');
  if (!wrapper) return;

  wrapper.classList.remove('layout-vertical', 'layout-horizontal', 'two-cols');
  if (mode === 'vertical') {
    wrapper.classList.add('layout-vertical');
  } else if (mode === 'horizontal') {
    wrapper.classList.add('layout-horizontal'); // синонім two-cols
  } else if (mode === 'two-cols') {
    wrapper.classList.add('two-cols'); // зворотна сумісність зі старою назвою
  }
}