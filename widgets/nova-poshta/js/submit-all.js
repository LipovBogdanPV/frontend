// js/submit-all.js                                                                                          // ✅ Основна логіка оформлення замовлення (клієнт + товари одним запитом)

import {
  validatePhone,
  validateEmail,
  preparePhoneForTable,
  toggleOtherFields,
  toggleEmailField
} from './helpers.js';                                                                                       // 🧩 Валідації та утиліти

import { showSuccess, showError } from './ui.js';                                                             // 🖼️ Повідомлення користувачу
import { enqueueOrderForSync, ensureOrderSyncStarted } from '../../../../js/local-sync.js';

// --- автозбереження форми клієнта + адреси ---
const CUSTOMER_LS_KEY = "customerDraft_v2";


// ===== CONFIG: GAS WebApp URL (без кінцевого "/") =====
const GAS_WEBAPP_URL = String(
  window._CONFIG?.SHEETS_WEBAPP_URL ??
  window.SHEETS_WEBAPP_URL ??
  window.SHIFTTIME_SHEETS_URL ?? ''
).replace(/\/+$/, '');





// ===== Універсальний POST з акуратним парсингом =====
async function postJsonSafe(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // читаємо АБО json, АБО text (через clone)
  let data = null, raw = '';
  try { data = await r.clone().json(); } catch { raw = await r.text(); }

  console.log('[submit][payload]', payload);
  console.log('[submit][response]', r.status, data || raw);

  if (!r.ok || data?.success === false) {
    throw new Error(data?.error || raw || `HTTP ${r.status}`);
  }
  return data ?? { success: true, raw };
}









function g(id){ return document.getElementById(id); }
function val(id){ return g(id)?.value ?? ""; }
function setVal(id, v){ const el=g(id); if (el) el.value = v ?? ""; }
function isChecked(id){ return !!g(id)?.checked; }
function setChecked(id,v){ const el=g(id); if (el) el.checked = !!v; }

// які поля слухати
const watchedIds = [
  "partner","surname","name","patronymic","number","email",
  "otherSurname","otherName","otherPhone",
  "hidden-region","hidden-city","hidden-district","hidden-warehouse",
  "hidden-street","hidden-warehouse-number","hidden-warehouse-type"
];

// зібрати драфт
function collectCustomerDraft(){
  return {
    partner: val("partner"),
    surname: val("surname"),
    name: val("name"),
    patronymic: val("patronymic"),
    number: val("number"),
    email: val("email"),
    otherToggle: isChecked("otherRecipientToggle"),
    otherSurname: val("otherSurname"),
    otherName: val("otherName"),
    otherPhone: val("otherPhone"),
    emailToggle: isChecked("emailToggle"),
    region: val("hidden-region"),
    city: val("hidden-city"),
    district: val("hidden-district"),
    warehouse: val("hidden-warehouse"),
    street: val("hidden-street"),
    warehouseNumber: val("hidden-warehouse-number"),
    warehouseType: val("hidden-warehouse-type"),
  };
}

function saveCustomerDraft(){
  try { localStorage.setItem(CUSTOMER_LS_KEY, JSON.stringify(collectCustomerDraft())); }
  catch(e){ console.warn("saveCustomerDraft error", e); }
}

function restoreCustomerDraft(){
  let data;
  try { data = JSON.parse(localStorage.getItem(CUSTOMER_LS_KEY) || "null"); }
  catch { data = null; }
  if (!data) return;

  setVal("partner", data.partner);
  setVal("surname", data.surname);
  setVal("name", data.name);
  setVal("patronymic", data.patronymic);
  setVal("number", data.number);
  setVal("email", data.email);

  setChecked("otherRecipientToggle", data.otherToggle);
  setVal("otherSurname", data.otherSurname);
  setVal("otherName", data.otherName);
  setVal("otherPhone", data.otherPhone);

  setChecked("emailToggle", data.emailToggle);

  // показати/сховати блоки одразу після відновлення
  g("otherFields")?.classList.toggle("hidden", !data.otherToggle);
  g("emailField")?.classList.toggle("hidden", !data.emailToggle);

  setVal("hidden-region", data.region);
  setVal("hidden-city", data.city);
  setVal("hidden-district", data.district);
  setVal("hidden-warehouse", data.warehouse);
  setVal("hidden-street", data.street);
  setVal("hidden-warehouse-number", data.warehouseNumber);
  setVal("hidden-warehouse-type", data.warehouseType);
}

// простий debounce, щоб не спамити localStorage
function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
const saveCustomerDraftDebounced = debounce(saveCustomerDraft, 200);










// 🧼 Валідація імен (лише букви, апостроф, тире, пробіл, до 25 символів)
function applyNameValidation(id) {                                                                            // →
  const input = document.getElementById(id);                                                                   // Беремо інпут за id
  if (input) {                                                                                                 // Якщо існує
    input.addEventListener("input", (e) => {                                                                   // Вішаємо live-валідацію
      e.target.value = e.target.value                                                                          // Поточне значення
        .replace(/[^a-zA-Zа-яА-ЯіїєІЇЄґҐʼ'’\- ]/g, '')                                                         // Лишаємо тільки дозволені символи
        .slice(0, 25);                                                                                         // Макс 25 символів
    });
  }
}

// ☎️ Обробка введення телефону з обмеженнями та повідомленнями
function restrictPhoneInput(inputId) {                                                                         // →
  const input = document.getElementById(inputId);                                                              // Інпут телефону
  const feedback = document.getElementById(                                                                     // Підказка під інпутом
    inputId === "number" ? "phoneFeedback" : "otherPhoneFeedback"
  );

  if (!input) return;                                                                                          // Якщо інпут не знайдено — вихід

  input.addEventListener("input", () => {                                                                       // Live-фільтр
    input.value = input.value.replace(/[^0-9+]/g, "");                                                         // Лишаємо цифри та +

    let phone = input.value;                                                                                   // Сирий ввід
    let clean = phone.replace(/\D/g, "");                                                                      // Цифри без символів
    let isForeign = false;                                                                                     // Прапорець іноземного номера

    if (phone.startsWith("+38")) {                                                                             // +38XXXXXXXXXX
      clean = phone.slice(3);                                                                                  // Забираємо код 38
    } else if (phone.startsWith("38")) {                                                                       // 38XXXXXXXXXX
      clean = phone.slice(2);                                                                                  // Забираємо 38
      // input.value = "+38" + clean;                                                                          // За потреби можна повертати +38
    } else if (phone.startsWith("+")) {                                                                        // +CC...
      const code = phone.slice(1, 3);                                                                          // Перші 2 цифри коду країни
      if (code !== "38") isForeign = true;                                                                     // Не UA → іноземний
    }

    if (!isForeign && clean.length < 10) {                                                                     // UA і < 10 цифр
      input.style.color = "red";
      feedback.textContent = "❌ У номері менше 10 цифр";
    } else if (!isForeign && clean.length === 10) {                                                            // Рівно 10 — ок
      input.style.color = "green";
      feedback.textContent = "";
    } else if (!isForeign && clean.length === 11) {                                                            // 11 — забагато
      input.style.color = "red";
      feedback.textContent = "❌ У вас забагато цифр у номері";
    } else if (!isForeign && clean.length > 11) {                                                              // >11 — ріжемо
      clean = clean.slice(0, 11);
      input.value = clean;                                                                                     // Можна ставити +38 + clean якщо потрібно
      input.style.color = "red";
      feedback.textContent = "❌ Зайві символи видалено";
    } else if (isForeign && clean.length > 15) {                                                               // Іноземний — максимум 15 цифр
      clean = clean.slice(0, 15);
      input.value = "+" + clean;
      input.style.color = "red";
      feedback.textContent = "❌ Номер задовгий";
    } else if (isForeign) {                                                                                    // Іноземний допустимий
      input.style.color = "blue";
      feedback.textContent = "ℹ️ Іноземний номер";
    } else {                                                                                                   // Інші випадки — ок
      input.style.color = "green";
      feedback.textContent = "";
    }
  });
}




// === ГЛОБАЛЬНЕ ОЧИЩЕННЯ ФОРМИ + КОШИКА + LOCALSTORAGE ===
export function clearAllData({ notify = false } = {}) {
  try {
    // 1) Кошик (масив) + синхронізація з LS
    if (Array.isArray(window.order)) window.order.length = 0;
    // краще явно покласти порожній масив, щоб після F5 не відновилось
    localStorage.setItem("order", "[]");

    // 2) Драфт клієнта
    localStorage.removeItem("customerDraft_v2");

    // 3) Супутні ключі, які інколи зберігались
    localStorage.removeItem("descriptionCounter");
    localStorage.removeItem("activeDescriptionId");
    localStorage.removeItem("lastWidgetView");

    // 4) Перемалювати таблицю (якщо є функція з category.js)
    if (typeof window.updateOrderView === "function") {
      window.updateOrderView();
    } else {
      // fallback
      const tbody = document.getElementById("orderBody");
      if (tbody) tbody.innerHTML = "";
      const totalEl = document.getElementById("totalPrice");
      if (totalEl) totalEl.textContent = "Загальна вартість: 0 грн";
    }

    // 5) Очистити поля форми (текст/числа/textarea/select/checkbox)
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      if (el.type === "checkbox" || el.type === "radio") {
        el.checked = false;
      } else if (el.type === "hidden") {
        // ховаки очищаємо ТІЛЬКИ наші (щоб не зламати системні)
        if (el.id?.startsWith("hidden-")) el.value = "";
      } else {
        el.value = "";
      }
    });

    // 6) Сховати залежні блоки (інші одержувачі / email)
    const otherFields = document.getElementById("otherFields");
    const emailField = document.getElementById("emailField");
    if (otherFields) otherFields.classList.add("hidden");
    if (emailField) emailField.classList.add("hidden");

    if (notify) {
      // легеньке підтвердження, коли юзер тисне кнопку
      alert("✅ Усі дані очищено.");
    }
  } catch (e) {
    console.warn("clearAllData error:", e);
  }
}

// 🧠 Головна ініціалізація
export function initSubmitAll() {                                                                              // →
  console.log("🧠 [submit-all.js] Ініціалізація логіки оформлення...");
  ensureOrderSyncStarted();

  // 🔘 Чекбокси
  const otherToggle = document.getElementById("otherRecipientToggle");                                         // Чекбокс "Інший одержувач"
  const otherFields = document.getElementById("otherFields");                                                  // Блок полів іншого одержувача
  const emailToggle = document.getElementById("emailToggle");                                                  // Чекбокс "E-mail"
  const emailField = document.getElementById("emailField");                                                    // Блок поля email

  if (otherToggle && otherFields) {                                                                            // Якщо елементи є
    otherToggle.addEventListener("change", () => {                                                             // На зміну
      otherFields.classList.toggle("hidden", !otherToggle.checked);                                            // Показ/приховування
    });
  }

  if (emailToggle && emailField) {                                                                             // Якщо елементи є
    emailToggle.addEventListener("change", () => {                                                             // На зміну
      emailField.classList.toggle("hidden", !emailToggle.checked);                                             // Показ/приховування
    });
  }

  console.log("✅ Чекбокси ініціалізовано після DOMContentLoaded");

  // 🔄 Відновлюємо драфт при завантаженні
  restoreCustomerDraft();

  // 🧷 Слухаємо зміни у всіх полях форми та ховаках — і зберігаємо драфт
  watchedIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // для текстових/hidden — 'input', для select — 'change'
    const evt = (el.tagName === "SELECT") ? "change" : "input";
    el.addEventListener(evt, saveCustomerDraftDebounced);
  });

  // окремо — чекбокси (бо у тебе від них ще й UI залежить)
  g("otherRecipientToggle")?.addEventListener("change", saveCustomerDraftDebounced);
  g("emailToggle")?.addEventListener("change", saveCustomerDraftDebounced);

  // 🧽 Валідація текстових полів
  ["surname", "name", "patronymic", "otherSurname", "otherName"].forEach(applyNameValidation);                 // Прив'язуємо правила до полів ПІБ

  // ☎️ Телефони
  restrictPhoneInput("number");                                                                                // Головний телефон
  restrictPhoneInput("otherPhone");                                                                            // Додатковий телефон

  // 🟦 Обробка натискання кнопки
  const submitBtn = document.getElementById("submitAll");                                                      // Кнопка оформлення
  if (!submitBtn) {                                                                                            // Якщо кнопки нема
    console.warn("❌ Кнопка оформлення (#submitAll) не знайдена!");
    return;                                                                                                    // Вихід
  }

  // 🔒 Запобігання подвійній відправці, якщо десь залишився інший слухач
  if (window.__submitAllBound) {                                                                               // Якщо вже прив'язано — не дублюємо
    console.warn("⚠️ Обробник submitAll вже прив'язаний — пропускаю повторну ініціалізацію.");
    return;
  }
  window.__submitAllBound = true;                                                                              // Фіксуємо прив'язку

  submitBtn.addEventListener("click", async (e) => {                                                           // Клік по "Оформити"
    e.preventDefault();                                                                                        // Без перезавантаження сторінки

    if (window.__submitInProgress) return;                                                                     // Захист від дабл-кліку
    window.__submitInProgress = true;                                                                          // Ставимо прапорець

    console.log("📤 Натиснуто кнопку оформлення — збираємо дані...");

    // 🔰 Дані менеджера (спочатку з сесії, якщо немає — з <select id="manager">)
    const manager = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('st_user') || 'null');
        if (u && u.name) return String(u.name).trim();
      } catch(e) {}
      return (document.getElementById('manager')?.value || '').trim();
    })();                                // Менеджер (ідентифікатор/ПІБ)

    const managerOnly = String(manager).split(/\s+/).pop();               // 👈 NEW: лишаємо ТІЛЬКИ ім'я

    // 🧾 Поля форми (одержувач)
    const partner = document.getElementById("partner")?.value || "";                                           // Партнер/джерело
    const surname = document.getElementById("surname")?.value.trim() || "";                                    // Прізвище
    const name = document.getElementById("name")?.value.trim() || "";                                          // Ім'я
    const patronymic = document.getElementById("patronymic")?.value.trim() || "";                              // По-батькові
    const number = document.getElementById("number")?.value.trim() || "";                                      // Телефон
    const email = document.getElementById("email")?.value.trim() || "";                                        // Email
    const otherSurname = document.getElementById("otherSurname")?.value.trim() || "";                          // Інший одержувач: прізвище
    const otherName = document.getElementById("otherName")?.value.trim() || "";                                // Інший одержувач: ім'я
    const otherPhone = document.getElementById("otherPhone")?.value.trim() || "";                              // Інший одержувач: телефон

    // 📦 Адреса (з віджета Нової Пошти)
    const region = document.getElementById("hidden-region")?.value.trim() || "";                               // Область
    const city = document.getElementById("hidden-city")?.value.trim() || "";                                   // Місто
    const district = document.getElementById("hidden-district")?.value.trim() || "";                           // Район
    const warehouse = document.getElementById("hidden-warehouse")?.value.trim() || "";                         // Відділення/ПОШТОМАТ/адреса
    const street = document.getElementById("hidden-street")?.value.trim() || "";                               // Вулиця (для адресної)
    const warehouseNumber = document.getElementById("hidden-warehouse-number")?.value.trim() || "";            // № відділення/поштомату
    const warehouseType = document.getElementById("hidden-warehouse-type")?.value.trim() || "";                // Тип (Відділення/Поштомат/Адресна)

    console.log("📦 Дані перед відправкою:", {
      partner, manager: managerOnly, surname, name, patronymic, number, email,                                  // 👈 лог: теж лише ім’я
      otherSurname, otherName, otherPhone,
      region, city, district, warehouse, street, warehouseNumber, warehouseType
    });

    // ✅ Перевірка обов'язкових полів
    if (!surname || !name || !validatePhone(number) || !city || !warehouse) {                                  // Мінімальні вимоги
      showError("❗ Заповніть усі обов’язкові поля!");                                                          // Помилка користувачу
      window.__submitInProgress = false;                                                                        // Знімаємо блок
      return;
    }
    if (email && !validateEmail(email)) {                                                                       // Якщо є e-mail — перевірка
      showError("❗ Некоректний email");
      window.__submitInProgress = false;
      return;
    }

    // ☎️ Нормалізація телефонів
    const preparedPhone = preparePhoneForTable(number);                                                         // Форматуємо для таблиці
    const preparedOtherPhone = preparePhoneForTable(otherPhone);                                                // Другий номер — теж
    // ПЕРЕД читанням значень з інпутів у submit-обробнику:
    saveCustomerDraft(); // на випадок, якщо дебаунс не встиг

    // 🧱 Блок даних клієнта (customer)
    const customer = {                                                                                          // Те, що піде в "customer"
      partner,
      manager: managerOnly,                                                                                     // 👈 В ТАБЛИЦЮ — ЛИШЕ ІМ’Я
      customerLastName: surname,
      customerFirstName: name,
      customerMiddleName: patronymic,
      number: preparedPhone,
      email,
      otherSurname,
      otherName,
      otherPhone: preparedOtherPhone,
      region,
      city,
      district,
      warehouse,
      street,
      warehouseNumber,
      warehouseType
    };

    // 🛒 Беремо масив товарів із глобального стану (або localStorage як fallback)
    const currentOrder = Array.isArray(window.order)
      ? window.order
      : JSON.parse(localStorage.getItem('order') || '[]');                                                      // Якщо order не глобальний — читаємо з LS

    if (!Array.isArray(currentOrder) || currentOrder.length === 0) {                                            // Якщо товарів немає
      showError("Додайте хоча б один товар перед оформленням.");                                                // Попереджаємо
      window.__submitInProgress = false;
      return;
    }

    // 💸 Гроші та доставки (читаємо з DOM — як у твоєму category.js)
    const discount = parseFloat(document.getElementById("discountInput")?.value) || 0;                          // Знижка
    const prepay = parseFloat(document.getElementById("prepaymentInput")?.value) || 0;                          // Передоплата
    const totalSum = currentOrder.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);                // Загальна сума товарів

    const olxDelivery = document.getElementById("olxInput")?.value || "";                                       // Сума з ОЛХ (якщо є)
    const promDelivery = document.getElementById("promInput")?.value || "";                                     // Сума з PROM (якщо є)
    const paidDelivery = document.getElementById("deliveryInput")?.value || "";                                 // Оплачена доставка клієнтом

    // 🧾 Формуємо масив items у ТВОЄМУ форматі
    const items = currentOrder.map((item, index) => {                                                           // Кожна позиція замовлення
      const { top, center, bottom, drawing } = item.details || {};                                              // Опис із localStorage/деталей
      const descriptionParts = [];                                                                              // Накопичувач рядків опису
      if (top) descriptionParts.push(`Напис в Верху: ${top}`);                                                  // Верхній рядок
      if (center) descriptionParts.push(`Напис по центру: ${center}`);                                          // Центральний рядок
      if (bottom) descriptionParts.push(`Напис з низу: ${bottom}`);                                             // Нижній рядок
      if (drawing) descriptionParts.push(`Рисунок: ${drawing}`);                                                // Рисунок
      const descriptionText = descriptionParts.join('\n');                                                      // Об'єднання з переносами

      return {                                                                                                  // Повертаємо об'єкт товару
        product: item.name,                                                                                     // Назва
        size: item.size,                                                                                        // Розмір
        price: item.price,                                                                                      // Ціна
        description: descriptionText || "",                                                                     // Текст у колонку X
        total: index === 0 ? ((parseFloat(olxDelivery) > 0 || parseFloat(promDelivery) > 0) ? "0" : totalSum) : "", // Загальна сума тільки у першого рядка (або 0)
        discount: index === 0 ? discount : "",                                                                  // Знижка тільки у першого
        prepay: index === 0 ? prepay : "",                                                                      // Передоплата тільки у першого
        olxDelivery: index === 0 ? olxDelivery : "",                                                            // Доставка ОЛХ — тільки у першого
        promDelivery: index === 0 ? promDelivery : "",                                                          // Доставка PROM — тільки у першого
        paidDelivery: index === 0 ? paidDelivery : ""                                                           // Оплачена доставка — тільки у першого
      };
    });

    // 📦 ЄДИНИЙ payload: { customer, items }
    const data = { customer, items };

    console.log("📡 Єдиний payload (customer + items):", data);

    try {
      const result = await enqueueOrderForSync(data);
      showSuccess("✅ Замовлення збережено локально. Відправка виконується у фоні.");
      console.log("📨 Замовлення додано в локальну чергу:", result);
      clearAllData();
    } catch (err) {
      console.error("❌ Помилка під час запиту:", err);
      showError("❌ Не вдалося зберегти замовлення у локальну чергу.");
    } finally {
      window.__submitInProgress = false;
    }
  });
}


 // Кнопка повного очищення (за бажанням)   =====================================================
  document.getElementById("clear-all-btn")?.addEventListener("click", () => {
  if (!confirm("Ви впевнені, що хочете повністю очистити всі дані?")) return;
    location.reload(); // перезавантаження сторінки для скидання всього
  clearAllData({ notify: true });
});