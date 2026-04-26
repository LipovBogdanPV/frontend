// frontend/widgets/config-kv/config-page-init.js
// -----------------------------------------------------------------------------
// ДЛЯ ЧОГО ЦЕЙ ФАЙЛ:
// Ініціалізує сторінку "Конфігурація" у CRM. Тягне чинні значення ключів
// із Google Apps Script (через GAS WebApp), заповнює форму, а також відправляє
// оновлення назад у GAS при натисканні "Зберегти".
// Працює через маленький API-шар (config-api.js): fetchConfigFromGAS / saveConfigToGAS.
// -----------------------------------------------------------------------------
// ВАЖЛИВО:
// - Поля форми шукаються або за id виду #config-KEY, або за data-key="KEY".
// - Зараз у прикладі читаємо/записуємо 4 ключі: SHEETS_WEBAPP_URL, RENDER_BASE,
//   NETLIFY_BASE, TELEGRAM_FN_PATH. (Можеш залишити тільки ті, що використовуєш.)
// -----------------------------------------------------------------------------

import { saveConfigToGAS, fetchConfigFromGAS } from './config-api.js';                                            // 🔌 API (GET/POST до GAS)

/** Дістаємо елемент поля з 2-ма варіантами селекторів (id або data-key) */
function pick(container, key) {                                                                                   // 🔎 універсальний пошук інпуту
  return (                                                                                                        // ▼ повертаємо перший знайдений елемент
    container.querySelector(`#config-${key.toLowerCase()}`) ||                                                    // ▶️ варіант 1: інпут має id="config-key"
    container.querySelector(`[data-key="${key}"]`)                                                                // ▶️ варіант 2: інпут має data-key="KEY"
  );
}

/** Прочитати значення полів форми → { KEY: value } */
function readForm(container) {                                                                                    // 📥 зчитування всіх контрольованих полів
  const map = {};                                                                                                 // об’єкт-результат
  ['SHEETS_WEBAPP_URL','RENDER_BASE','NETLIFY_BASE','TELEGRAM_FN_PATH'].forEach(k => {                           // 🗝️ список ключів, які очікуємо у формі
    const el = pick(container, k);                                                                                // знайти відповідний елемент
    if (el) map[k] = el.value || '';                                                                              // якщо є — забрати значення, інакше ''
  });
  return map;                                                                                                     // 📤 повертаємо зібрану мапу
}

/** Заповнити форму з об’єкта config */
function fillForm(container, config) {                                                                            // 📤 проставлення значень у форму
  ['SHEETS_WEBAPP_URL','RENDER_BASE','NETLIFY_BASE','TELEGRAM_FN_PATH'].forEach(k => {                           // 🗝️ список ключів для відображення
    const el = pick(container, k);                                                                                // знайти елемент поля
    if (el && config && k in config) el.value = String(config[k] ?? '');                                          // ✍️ записати значення (як текст)
  });
}

/** Ініціалізація сторінки Конфігурації */
export async function initConfigPage(container) {                                                                 // 🚀 стартова функція для сторінки
  // 1) Визначимо базовий SHEETS_WEBAPP_URL (пріоритет: глобальний APP_CONFIG → поле форми)
  const fallbackEl = pick(container, 'SHEETS_WEBAPP_URL');                                                        // 🛟 елемент-підстраховка з форми
  const SHEETS_WEBAPP_URL =                                                                                       // кінцевий базовий URL GAS WebApp
    (window.APP_CONFIG && window.APP_CONFIG.SHEETS_WEBAPP_URL) ||                                                 // — якщо в пам'яті вже лежить APP_CONFIG
    (fallbackEl ? fallbackEl.value : '');                                                                         // — інакше беремо з поля форми (якщо воно заповнене)

  // 2) Якщо є SHEETS_WEBAPP_URL — тягнемо конфіг із GAS і заповнюємо форму
  try {                                                                                                           // спроба запиту
    if (SHEETS_WEBAPP_URL) {                                                                                      // тільки якщо URL заданий
      const cfg = await fetchConfigFromGAS(SHEETS_WEBAPP_URL);                                                    // 📦 GET конфіг з GAS (об’єкт ключів)
      if (cfg && typeof cfg === 'object') {                                                                       // перевірка формату
        fillForm(container, cfg);                                                                                 // ✍️ показати у формі
        // оновимо кеш у вікні (щоб інші модулі могли скористатися без повторного GET)
        window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, cfg);                                      // ♻️ оновити глобальний кеш
      }
    }
  } catch (e) {
    console.warn('⚠️ Не вдалося підвантажити CONFIG з GAS:', e);                                                  // 🐞 короткий лог, якщо щось пішло не так
  }

  // 3) Кнопка «Зберегти» (дозволяємо два способи розмітки)
  const btn =                                                                                                     // елемент кнопки
    container.querySelector('#config-save-btn') ||                                                                // варіант 1: id
    container.querySelector('[data-role="config-save"]');                                                         // варіант 2: дата-роль

  // 4) PIN поле (для захисту оновлень)
  const pinEl =                                                                                                   // елемент із PIN-ом
    container.querySelector('#config-pin') ||                                                                     // варіант 1: id
    container.querySelector('[data-key="ADMIN_PIN"]') ||                                                          // варіант 2: використати існуюче поле ADMIN_PIN
    container.querySelector('[name="pin"]');                                                                      // варіант 3: інпут name="pin"

  if (btn) {                                                                                                      // якщо кнопку знайшли
    btn.addEventListener('click', async () => {                                                                   // 👆 обробник кліку «Зберегти»
      try {
        const pin = pinEl ? String(pinEl.value || '') : '';                                                       // 🔑 зчитати PIN (може бути пустим, якщо не вимагається)
        const updates = readForm(container);                                                                      // 📝 забрати дані з форми
        const baseUrl = updates.SHEETS_WEBAPP_URL || SHEETS_WEBAPP_URL;                                           // 🌐 куди відправляти (пріоритет новому значенню)

        // Готуємо payload: PIN окремо, а самі оновлення — тільки по потрібних ключах
        const payload = {                                                                                         // 📦 тіло POST
          pin,                                                                                                    // → захисний PIN (перевіряється на бекенді)
          updates: {                                                                                              // → набір ключів, які хочемо оновити
            SHEETS_WEBAPP_URL: updates.SHEETS_WEBAPP_URL,                                                         //   URL GAS WebApp
            RENDER_BASE: updates.RENDER_BASE,                                                                     //   (за потреби) бекенд Render
            NETLIFY_BASE: updates.NETLIFY_BASE,                                                                   //   (за потреби) базовий шлях Netlify
            TELEGRAM_FN_PATH: updates.TELEGRAM_FN_PATH                                                            //   (за потреби) шлях до Netlify-функції для Telegram
          },
          SHEETS_WEBAPP_URL: baseUrl                                                                              // дублюємо базовий URL для зручності API
        };

        const res = await saveConfigToGAS(payload);                                                               // 🚀 POST у GAS (оновлення KV)
        console.log('CONFIG SAVE RESULT:', res);                                                                  // 🐞 сервісний лог

        if (res && res.success) {                                                                                 // ✅ успішна відповідь
          // оновлюємо глобальний кеш APP_CONFIG (або беремо те, що повернув бекенд)
          window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, (res.config || updates));                // ♻️ зберегти у глобальній пам’яті
          alert('✅ Конфіг збережено');                                                                           // UX: повідомлення користувачу
        } else {                                                                                                  // ❌ помилка від бекенда
          alert('❌ Помилка: ' + (res && res.error ? res.error : 'невідома'));                                    // UX: показати причину
        }
      } catch (err) {
        console.error('❌ Помилка збереження CONFIG:', err);                                                      // 🐞 лог помилки мережі/парсингу
        alert('❌ Помилка збереження: ' + String(err));                                                           // UX: показати текст помилки
      }
    });
  } else {
    console.warn('Кнопку "Зберегти" не знайдено (ID #config-save-btn або [data-role="config-save"]).');           // 🐞 попередження, якщо розмітка відрізняється
  }
}
