// js/main_adres.js
// ✅ Модуль для ініціалізації віджета Нової Пошти та запису в приховані поля

import { initNovaPoshtaWidget } from '../widgets/nova-poshta/np-widget.js';

console.log("🧠 main_adres.js завантажено");

/**
 * ⏳ Очікує появу елемента в DOM перед ініціалізацією
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const el = document.querySelector(selector);
      if (el) {
        console.log(`✅ Знайдено елемент: ${selector}`);
        resolve(el);
        return;
      }

      if (Date.now() - startTime > timeout) {
        console.warn(`⏰ Не знайдено елемент: ${selector} за ${timeout} мс`);
        reject(`Елемент ${selector} не знайдено`);
        return;
      }

      requestAnimationFrame(check); // Надійніше за setInterval
    };

    check();
  });
}


/**
 * 🚀 Основна функція — викликається після вставки form-address.html
 */
// ✅ Головна ініціалізація виджета Нової Пошти
export async function initNovaPoshta() {
  console.log("⏳ Чекаємо на #nova-poshta-widget...");

  try {
    await waitForElement("#nova-poshta-widget");
    console.log("✅ Елемент #nova-poshta-widget знайдено");
  } catch (e) {
    console.error("❌ Віджет не знайдено:", e);
    return;
  }

  // 🔍 Перевіримо ще раз перед ініціалізацією
  const widgetEl = document.getElementById("nova-poshta-widget");
  if (!widgetEl) {
    console.warn("⛔ #nova-poshta-widget відсутній у DOM прямо перед init");
    return;
  } else {
    console.log("📦 Ініціалізуємо віджет Нової Пошти...", widgetEl);
  }

  try {
    initNovaPoshtaWidget("nova-poshta-widget", (data) => {
      console.log("📍 Вибрано адресу:", data);

      document.getElementById("hidden-city").value = data.city || "";
      document.getElementById("hidden-region").value = data.region || "";
      document.getElementById("hidden-district").value = data.district || "";
      document.getElementById("hidden-warehouse").value = data.warehouse || "";
      document.getElementById("hidden-street").value = data.street || "";
      document.getElementById("hidden-warehouse-number").value = data.warehouseNumber || "";
      document.getElementById("hidden-warehouse-type").value = data.warehouseType || "";
    });
  } catch (e) {
    console.error("❌ Помилка ініціалізації віджета:", e);
  }
}
