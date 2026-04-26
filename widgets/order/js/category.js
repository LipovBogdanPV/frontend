// ===== КОШИК ЗАМОВЛЕННЯ (має бути ПЕРЕД initOrderWidget) =====
let order = [];        // було const — ОБОВ’ЯЗКОВО let, бо нижче робимо присвоєння
let total = 0;

// === Публічний ресетер кошика для інших модулів (submit-all.js) ===
window.resetOrder = function () {
  try {
    order.length = 0;                  // очистити локальний масив, з якого малюється таблиця
    if (typeof saveOrderToLS === "function") saveOrderToLS(); // синхронізувати LS
    if (typeof updateOrderView === "function") updateOrderView(); // перемалювати таблицю
    if (typeof reattachOpisHandlers === "function") reattachOpisHandlers();
  } catch (e) {
    console.warn("resetOrder error:", e);
  }
};



import { PriceSchema as P } from './price-cols.js';
// опціонально для дебагу з консолі:
window.PriceSchema = P;


// (ці дві функції можуть бути хоч нижче — це function declarations, вони хоїстяться)
function saveOrderToLS() {
  try { localStorage.setItem('order', JSON.stringify(order)); } catch(e) { console.warn(e); }
}
function loadOrderFromLS() {
  try { return JSON.parse(localStorage.getItem('order') || '[]'); } catch(e) { return []; }
}




export function initOrderWidget() {
// ================= ПОВЕРТАЄМО КОШИК З localStorage =================
  // ================= ПОВЕРТАЄМО КОШИК З localStorage =================
  order = loadOrderFromLS();     // ⬅️ Читаємо дані з пам'яті браузера

  window.order = order;          // ⬅️ Робимо доступним глобально (щоб submit-сторінка теж бачила)
  updateOrderView();             // ⬅️ Перемальовуємо список

  console.log("✅ initOrderWidget ЗАПУЩЕНО");



// ===== Хелпер для читання конфігу з KV або з window =====
function cfg(key, fallback) {
  try {
    const fromKV = window._CONFIG && window._CONFIG[key]; // те, що приїжджає з листа "CONFIG"
    const fromWin = window[key];                           // глобалка з index.html (на випадок, якщо KV ще не встиг підвантажитись)
    const v = (fromKV ?? fromWin);
    return (v == null || String(v).trim() === '') ? fallback : String(v);
  } catch (_) {
    return fallback;
  }
}



  //const scriptUrl = "https://script.google.com/macros/s/AKfycbxx-dNE1v-q9AgRY3SrJMJXNGvuGANM8QCboXJPT2O5kh6YU1LAYLf9unQy-783isVD/exec";



// ===== База для прайсу (тільки звідси читаємо URL) =====
const PRICES_BASE = cfg(
  'SHEETS_WEBAPP_URL',
  // останній аварійний фолбек (щоб нічого не поламалось, якщо ні KV, ні window нема)
  'https://script.google.com/macros/s/AKfycbxx-dNE1v-q9AgRY3SrJMJXNGvuGANM8QCboXJPT2O5kh6YU1LAYLf9unQy-783isVD/exec'
);

// 2) Обовʼязково передаєм mode (у твоєму GAS має існувати гілка для нього)
//    і додаємо cache-buster.
const url = `${PRICES_BASE}?mode=prices&_=${Date.now()}`;
console.log('[prices] GET', url);

fetch(url, { cache: 'no-store', credentials: 'omit' })
  .then(async (res) => {
    const txt = await res.text();                       // читаємо як текст — зручно дебажити
    console.log('[prices] status', res.status, 'body:', txt.slice(0, 200));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // якщо Apps Script віддав HTML (бо mode не той) — JSON.parse впаде і ти це побачиш
    return JSON.parse(txt);
  })


  .then(data => {

       // ⬇️ ДОДАЙ САМЕ ТУТ
    // зберігаємо карту індексів з GAS або підставляємо дефолт
if (data.colIdx) {
  P.set(data.colIdx);
} else {
  // fallback під твою поточну таблицю (після вставки D,E,F)
  P.set({
    'категорія': 0,
    'підкатегорія': 1,
    'розмір': 2,
    'аксесуари категорії': 6,               // було D -> стало G
    'параметри аксесуарів додатково': 8,    // було F -> стало I
    'вартість': 12                          // було J -> стало M
  });
}
window.ALL_DATA = data;






    const categoryContainer = document.getElementById("categoryContainer");
    const subcategoryContainer = document.getElementById("subcategoryContainer");
    const subcategoryTitle = document.getElementById("subcategoryTitle");

    const sizeContainer = document.getElementById("sizeContainer");       // ➕ Контейнер для розмірів
    const sizeTitle = document.getElementById("sizeTitle");               // ➕ Заголовок для розмірів

    const categories = data.categories || [];
    const subcategories = data.subcategories || {};
    const accessories = data.accessories || [];
    const sizes = data.sizes || {}; // ➕ Об’єкт розмірів {Підкатегорія: [30, 40, 50]}
    const fullRows = data.full || []; // ⬅️ нове поле — повний масив усіх рядків таблиці
    data.full = fullRows; // зберігаємо для передачі далі



//========================Кнопка вибір КАТЕГОРІЇ==============================================

    const categoryBlock = document.querySelector(".category-block"); // ⬅️ Отримаємо блок категорій
const headerPlaceholder = document.getElementById("active-category-wrapper"); // ⬅️ Шапка (у index.html вона є)
let activeCategoryButton = null; // Збережемо активну кнопку

categories.forEach(category => {
  const button = document.createElement("button");
  button.className = "category-button";
  button.textContent = category;





  button.onclick = () => {
//-------------------------------

// Очистити кнопку активної підкатегорії
document.getElementById("active-subcategory-wrapper").innerHTML = "";

// Очистити підкатегорії
subcategoryContainer.innerHTML = "";

// Показати блок підкатегорій знову (раптом він був прихований)
document.getElementById("subcategoryBlock").style.display = "block";




//-------------------------------
    subcategoryContainer.innerHTML = "";
    sizeContainer.innerHTML = "";
    sizeTitle.textContent = "";
    subcategoryTitle.textContent = `Підкатегорії: ${category}`;

    
    categoryBlock.style.display = "none";                                  // ⬇️ Ховаємо блок категорій

    
    if (activeCategoryButton) {                                            // ⬇️ Якщо кнопка вже є — видаляємо стару
      headerPlaceholder.removeChild(activeCategoryButton);
    }

    
    activeCategoryButton = document.createElement("button");               // ⬇️ Створюємо кнопку з назвою категорії
    activeCategoryButton.className = "active-category-button";
    activeCategoryButton.textContent = category;

    
    activeCategoryButton.onclick = () => {                                 // ⬇️ Додаємо обробник — повернути назад блок
      categoryBlock.style.display = "block";                               // показати блок назад
      headerPlaceholder.removeChild(activeCategoryButton);                 // видалити кнопку
      activeCategoryButton = null;
    };

    headerPlaceholder.appendChild(activeCategoryButton);                   // Додаємо в шапку

//========================Кнопка вибір ПІДКАТЕГОРІЇ==============================================




        const subList = subcategories[category] || [];
        const filtered = subList.filter(sub => !accessories.includes(sub));
        const accessoryContainer = document.getElementById("accessoryContainer");
        const accessoryTitle = document.getElementById("accessoryTitle");



      
                 filtered.forEach(sub => {
          const subBtn = document.createElement("button");
          subBtn.className = "category-button";
          subBtn.textContent = sub;




           //=============== Вставлення найменування =================================
// повертає одиницю виміру (Найменування) для підкатегорії
function getUnitForSubcategory(subcategory, allData) {
  const rows = (allData && allData.full) || [];
  const norm = s => String(s || '').trim().toLowerCase();

  const row = rows.find(r =>
    norm(P.get(r, 'Підкатегорія')) === norm(subcategory) &&
    !['аксесуари', 'додатково'].includes(norm(P.get(r, 'Аксесуари Категорії')))
  );

  const raw = row ? P.get(row, 'Найменування') : '';
  return String(raw || '').trim(); // приклади: "см", "шампурів", "d"
}

// красиво форматує підпис розміру з одиницею
function formatSizeLabel(size, unit) {
  const u = String(unit || '').trim();
  if (!u) return String(size);
  // спеціальний кейс для "d" → "d50"
  if (/^d$/i.test(u)) return `d${size}`;
  return `${size} ${u}`; // звичайний кейс → "50 см", "10 шампурів"
}


           //=============== Виведення блоку діаметріва =================================

function renderSizesForSub(sub) {
  sizeContainer.innerHTML = "";
  sizeTitle.textContent = `Діаметри: ${sub}`;

  const sizeList = sizes[sub] || [];
  // ⬇️ беремо одиницю виміру з нової колонки "Найменування"
  const unit = getUnitForSubcategory(sub, data);

  sizeList.forEach(size => {
    const sizeBtn = document.createElement("button");
    sizeBtn.className = "category-button";
    sizeBtn.textContent = formatSizeLabel(size, unit);  // <<< тут магія

    sizeBtn.onclick = () => {
      sizeTitle.textContent = `Діаметри: ${sub}`;

      // показати релевантні аксесуари (передаємо unit, щоб у заголовку теж було красиво)
      showAccessoriesBySize(sub, size, data, unit);

      // додати основний товар у кошик
      const fullData = data.full || [];
      const match = fullData.find(row => {
        const subc   = String(P.get(row,'Підкатегорія') || '');
        const sz     = P.get(row,'Розмір');
        const marker = String(P.get(row,'Аксесуари Категорії') || '').toUpperCase();
        return subc === sub && Number(sz) === Number(size) && !marker.includes('АКСЕСУАРИ');
      });

      if (match) {
        const name     = P.get(match,'Підкатегорія');
        const diameter = P.get(match,'Розмір');
        const price = parsePrice(P.get(match,'Вартість')); // або parsePrice(match[12]) якщо ще на індексах
        // ⬇️ у замовлення кладемо відформатований підпис розміру
        
        
       const priceNum = parsePrice(P.get(match,'Вартість')); // поверне число або null
        order.unshift({ name, size: formatSizeLabel(diameter, unit), price: priceNum ?? 0 });
        if (priceNum != null) total += priceNum;
        updateOrderView();
      }

      // сховати блок кнопок розмірів і показати активний чіп
      document.getElementById("sizeSubcategoryBlock").style.display = "none";
      const sizeHeaderWrapper = document.getElementById("active-size-subcategory-wrapper");
      sizeHeaderWrapper.innerHTML = "";

      const activeSizeBtn = document.createElement("button");
      activeSizeBtn.className = "active-category-button";
      activeSizeBtn.textContent = formatSizeLabel(size, unit); // <<< і тут

      activeSizeBtn.onclick = () => {
        document.getElementById("sizeSubcategoryBlock").style.display = "block";
        sizeHeaderWrapper.innerHTML = "";
      };

      sizeHeaderWrapper.appendChild(activeSizeBtn);
    };

    sizeContainer.appendChild(sizeBtn);
  });

  document.getElementById("sizeSubcategoryBlock").style.display = "block";
}


           //=============== Натискаємо кнопку Вибір підкатегорії =======================

          subBtn.onclick = () => {
            sizeContainer.innerHTML = "";
            accessoryContainer.innerHTML = "";
            sizeTitle.textContent = `Діаметри: ${sub}`;
            accessoryTitle.textContent = "";

            



             document.getElementById("subcategoryBlock").style.display = "none";                 // ⬇️ Ховаємо весь блок підкатегорій




             const subHeaderWrapper = document.getElementById("active-subcategory-wrapper");      // Додаємо кнопку підкатегорії в шапку
             subHeaderWrapper.innerHTML = "";                                                     // очищаємо попередню кнопку, якщо була

            const activeSubBtn = document.createElement("button");
            activeSubBtn.className = "active-category-button";                                    // або створи окремий клас, якщо хочеш інший стиль
            activeSubBtn.textContent = sub;

            activeSubBtn.onclick = () => {
              document.getElementById("subcategoryBlock").style.display = "block";               // показати блок підкатегорій назад
              subHeaderWrapper.innerHTML = "";                                                   // приховати кнопку назад
            };

            subHeaderWrapper.appendChild(activeSubBtn);

           renderSizesForSub(sub);
          
          
          
          
          };


          subcategoryContainer.appendChild(subBtn);
        });

//--------------------------------------------------------------------------------------------------
             
       
      };

      categoryContainer.appendChild(button);
    });
  })










  //////////////////////////////////////////////////////////////////////////////////////////////
  .catch(error => {
    console.error("Помилка при завантаженні:", error);
  });
//===========================================================================================






 //=======Вона відповідає за виведення списку замовлених товарів + додавання кнопки "Видалити".==========
 function updateOrderView() {
  const tbody = document.getElementById("orderBody");
  const totalEl = document.getElementById("totalPrice");

  tbody.innerHTML = "";

  order.forEach((item, index) => {
    const row = document.createElement("tr");

    const cell1 = document.createElement("td");
    cell1.textContent = index + 1;
    cell1.classList.add("center-column");

    const cell2 = document.createElement("td");
    cell2.textContent = item.name;

    const cell3 = document.createElement("td");
    cell3.textContent = item.size;
    cell3.classList.add("center-column");

    // 🔸 НОВА КОЛОНКА — ДОДАТКОВО (ОПИС)
    const extraCell = document.createElement("td");
    extraCell.classList.add("center-column");
    extraCell.innerHTML = item.extra || ""; // 🟢 Вставляємо HTML-кнопку


    const cell4 = document.createElement("td");
    cell4.textContent = `${item.price} грн`;
    cell4.classList.add("center-column");

    const cell5 = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "❌";
    deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
    deleteBtn.onclick = () => {
      order.splice(index, 1);
      saveOrderToLS(); // 💾
      updateOrderView();
      reattachOpisHandlers();  //----------------------------------------------------------77
    };
    cell5.appendChild(deleteBtn);

    // ✅ Додаємо клітинки у правильному порядку
    row.appendChild(cell1);
    row.appendChild(cell2);
    row.appendChild(cell3);
    row.appendChild(extraCell); // 🟢 Додатково (ОПИС)
    row.appendChild(cell4);
    row.appendChild(cell5);

    tbody.appendChild(row);
  });

  // 🔻 Оновлення загальної вартості
  const total = order.reduce((sum, item) => sum + item.price, 0);
  totalEl.textContent = `Загальна вартість: ${total} грн`;

//----------------------------------------------------------------------------------
  // ⬇️ ЦЕ ВСТАВ В КІНЦІ ФУНКЦІЇ updateOrderView() ПЕРЕД ЇЇ ЗАКРИТТЯМ
  setTimeout(() => {
    const allOpisButtons = document.querySelectorAll("button.category-button[id^='Опис']");
    allOpisButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        console.log(`Натиснено кнопку ${btn.id}`);

        const saved = localStorage.getItem(btn.id);
        if (!saved) {
          console.log("Немає збережених даних для", btn.id);
          return;
        }

        const data = JSON.parse(saved);
        console.log("Збережені дані:", data);

        const orderIndex = btn.dataset.orderIndex;
        const existingWrapper = document.querySelector(`[data-description-id="${btn.id}"]`);
        
        
        if (existingWrapper) {
          const inputs = existingWrapper.querySelectorAll("input");
          Object.entries(data).forEach(([key, value]) => {
            inputs.forEach(input => {
              if (input.placeholder.includes(dataLabel(key))) {
                input.value = value;
                input.readOnly = false;
                input.style.backgroundColor = "#ffffff";
              }
            });
          });
          document.getElementById("extraBlock").style.display = "block";
          existingWrapper.style.display = "block";
        }



        
      });
    });
  }, 100); // ⏱ Пауза, щоб DOM оновився перед пошуком кнопок



}

// ДОДАЙ ОЦЕ ЗНИЗУ (1 рядок)
window.updateOrderView = updateOrderView;
//==================================Зявляються аксесуари===========================
//*******************************************************************************
// ====================== 🔧 DEBUG/HELPERS (поклади поруч із функцією) ======================

// глобальний прапорець дебагу
const ACC_DEBUG = true;

// безпечні логери
function dlog(...args){ if (ACC_DEBUG) console.log('[ACC]', ...args); }
function dgroup(label){ if (ACC_DEBUG) console.group(label); }
function dgroupEnd(){ if (ACC_DEBUG) console.groupEnd(); }

// нормалізація рядків для порівняння
function _norm(s){ return String(s || '').trim().toLowerCase(); }

// порівняння розмірів "50" vs "50 см" vs "d50" → виділяємо лише цифри
function eqSize(a, b) {
  const A = String(a ?? '').toLowerCase().replace(/[^\d]/g, '');
  const B = String(b ?? '').toLowerCase().replace(/[^\d]/g, '');
  return A !== '' && A === B;
}

// Парсер колонки "Аксесуари Товару":
// підтримує: "Сковорода 4 мм (50)", "Сковорода 4 мм (30);(40);(50)",
// а також кілька позицій, розділених "/", напр. "Сковорода 4 мм (50) / Котелок (12)"
function parseAccessoryTargets(raw) {
  if (!raw) return [];
  const parts = String(raw).split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    const name = p.split('(')[0].trim();     // до першої "(" це назва базового товару
    let m; const rgx = /\(([^)]+)\)/g;       // усі дужки (..)
    const sizes = [];
    while ((m = rgx.exec(p)) !== null) sizes.push((m[1] || '').trim());
    if (sizes.length) sizes.forEach(sz => out.push({ name, size: sz }));
    else out.push({ name, size: '' });       // без розміру — окрема позначка
  });
  return out;
}

// ====================== 📦 ОСНОВНА ФУНКЦІЯ З ЛОГАМИ ======================
// ======================================================================
// 🔧 DEBUG та УТИЛІТИ (поклади поруч із функцією) 
// ======================================================================
// ======================================================================
// 🔧 DEBUG та УТИЛІТИ (поклади поруч із функцією) 
// ======================================================================

// глобальний прапорець дебагу (можеш вимкнути = false)


// безпечні логери
function dlog(...args){ if (ACC_DEBUG) console.log('[ACC]', ...args); }
function dgroup(label){ if (ACC_DEBUG) console.group(label); }
function dgroupEnd(){ if (ACC_DEBUG) console.groupEnd(); }


// === NEW: фіксуємо стилі головного товару, щоб їх не перебивали глобальні CSS ===
// === NEW: стилізація блоку ОСНОВНОГО товару ==============================
// === стилі для головного товару ==============================
function styleMainCard(el){
  el.style.setProperty('border', '1px solid #3399ff', 'important');   // товщина і колір рамки
  el.style.setProperty('background-color', '#e6f7ff', 'important');   // фон
  el.style.setProperty('padding', '12px');                            // внутрішні відступи
  el.style.setProperty('border-radius', '8px');                       // скруглені кути
  el.style.setProperty('margin-bottom', '12px');                      // відстань між картками
  el.style.setProperty('min-width', '200px');                         // мінімальна ширина
  el.style.setProperty('cursor', 'pointer');                          // курсор-рука при наведенні
  el.style.setProperty('transition', 'all 0.2s ease');                // плавний перехід

  // 🟦 Hover
  el.addEventListener('mouseenter', () => {
    el.style.setProperty('background-color', '#d9f0ff', 'important'); // трішки темніший фон
    el.style.setProperty('border-color', '#7daee0ff', 'important');     // більш насичений контур
  });
  el.addEventListener('mouseleave', () => {
    el.style.setProperty('background-color', '#e6f7ff', 'important');
    el.style.setProperty('border-color', '#6999c9ff', 'important');
  });

  // 🟦 Focus
  el.addEventListener('focusin', () => {
    el.style.setProperty('box-shadow', '0 0 6px rgba(0,123,255,0.6)', 'important');
  });
  el.addEventListener('focusout', () => {
    el.style.setProperty('box-shadow', 'none', 'important');
  });

  // 🟦 Active (при кліку)
  el.addEventListener('mousedown', () => {
    el.style.setProperty('transform', 'scale(0.98)');                 // легке стискання
  });
  el.addEventListener('mouseup', () => {
    el.style.setProperty('transform', 'scale(1)');                    // повертається назад
  });
}

// === стилі для аксесуарів =====================================
function styleAccessoryCard(el){
  el.style.setProperty('border', '1px solid #ccc');
  el.style.setProperty('background-color', '#fafafa');
  el.style.setProperty('padding', '10px');
  el.style.setProperty('border-radius', '8px');
  el.style.setProperty('margin-bottom', '10px');
  el.style.setProperty('min-width', '180px');
  el.style.setProperty('cursor', 'pointer');
  el.style.setProperty('transition', 'all 0.2s ease');

  // 🟫 Hover
  el.addEventListener('mouseenter', () => {
    el.style.setProperty('background-color', '#f0f0f0');  // темніше
    el.style.setProperty('border-color', '#999');         // темніший контур
  });
  el.addEventListener('mouseleave', () => {
    el.style.setProperty('background-color', '#fafafa');
    el.style.setProperty('border-color', '#ccc');
  });

  // 🟫 Focus
  el.addEventListener('focusin', () => {
    el.style.setProperty('box-shadow', '0 0 4px rgba(0,0,0,0.3)');
  });
  el.addEventListener('focusout', () => {
    el.style.setProperty('box-shadow', 'none');
  });

  // 🟫 Active (при кліку)
  el.addEventListener('mousedown', () => {
    el.style.setProperty('transform', 'scale(0.98)');
  });
  el.addEventListener('mouseup', () => {
    el.style.setProperty('transform', 'scale(1)');
  });
}



// Нова, більш стійка нормалізація (згортання пробілів + уніфікація лапок)
function _norm(s){
  return String(s || '')
    .replace(/[\u00A0\r\n]+/g, ' ')   // NBSP + перенос рядка → пробіл
    .replace(/[“”«»]/g, '"')          // типографські лапки → "
    .replace(/"{2,}/g, '"')           // подвоєні лапки → одинарні "
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Нормалізація НАЗВИ ТОВАРУ для порівняння (лапки ігноруємо повністю)
function normalizeProductName(s){
  return _norm(s).replace(/["']/g, ''); // прибрали всі лапки
}

// порівняння розмірів "50" vs "50 см" vs "d50" → беремо лише цифри
function eqSize(a, b) {
  const A = String(a ?? '').toLowerCase().replace(/[^\d]/g, '');
  const B = String(b ?? '').toLowerCase().replace(/[^\d]/g, '');
  return A !== '' && A === B;
}

// Парсер колонки "Аксесуари Товару":
// Підтримує: "Сковорода 4 мм (50)", "Сковорода 4 мм (30);(40);(50)", 
// та кілька позицій, розділених "/"

// Оновлений парсер "Аксесуари Товару"
// Оновлений парсер "Аксесуари Товару"
function parseAccessoryTargets(raw) {
  if (!raw) return [];
  const cleaned = String(raw)
    .replace(/[\u00A0\r\n]+/g, ' ')
    .replace(/[“”«»]/g, '"')
    .replace(/"{2,}/g, '"');

  const parts = cleaned.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
  const out = [];

  parts.forEach(p => {
    // назва до першої "(" + чистка пробілів і лапок
    const name = p.split('(')[0].replace(/\s+/g, ' ').trim();

    // витягнути ВСІ розміри (40);(45) ...
    let m; const rgx = /\(([^)]+)\)/g;
    const sizes = [];
    while ((m = rgx.exec(p)) !== null) {
      const sz = String(m[1] || '')
        .replace(/[\u00A0\r\n]+/g,' ')
        .replace(/[^\d]/g,'')   // залишаємо лише цифри
        .trim();
      if (sz) sizes.push(sz);
    }

    if (sizes.length) sizes.forEach(sz => out.push({ name, size: sz }));
    else out.push({ name, size: '' }); // WILDCARD — для всіх розмірів
  });

  dlog('parseAccessoryTargets:', raw, '→', out);
  return out;
}

// Універсальний геттер по мапі заголовків: повертає r[idx] для першого наявного заголовка
function makeHeaderGetter(colMap){
  const norm = s => String(s||'').toLowerCase().trim();
  return function getByHeader(r, ...names){
    for (const n of names) {
      const idx = colMap[norm(n)];
      if (idx != null && idx >= 0) return r[idx];
    }
    return '';
  };
}

// Показати / сховати ТІЛЬКИ блок "Додатково"
function toggleExtraBlock(show){
  const block     = document.getElementById('extraBlock');
  const container = document.getElementById('extraContainer');
  const closeBtn  = document.getElementById('closeExtraBlockBtn');

  if (!block) return;

  if (show) {
    block.style.display = 'block';              // показати лише extraBlock
    if (closeBtn) closeBtn.style.display = 'inline-block';
  } else {
    // при закритті чистимо контент і ховаємо лише extraBlock
    if (container) container.innerHTML = '';
    block.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
  }
}





// ======================================================================
// 📦 ОСНОВНА ФУНКЦІЯ: показ аксесуарів для підкатегорії + діаметра
//  Коментар до практично кожного кроку + детальні логи
// ======================================================================
function showAccessoriesBySize(subcategory, size, allData) {
  dgroup('showAccessoriesBySize START');

  // 1) DOM-елементи
  const accessoryContainer = document.getElementById("accessoryContainer");
  const accessoryTitle = document.getElementById("accessoryTitle");
  accessoryContainer.innerHTML = "";

  // 2) Дані з doGet
  const rows = (allData && allData.full) || [];
  const colMap = (allData && allData.colIdx && allData.colIdx.map) || {};

  // 3) Вхідні параметри
  dlog('INPUT:', { subcategory, size, rows: rows.length });
  dlog('HAS colMap?', Object.keys(colMap).length > 0);

  // 4) Без мапи заголовків далі не йдемо
  if (!Object.keys(colMap).length) {
    accessoryTitle.textContent = `Аксесуари для d${size}`;
    accessoryContainer.textContent = "Не знайдено мапи заголовків (colIdx.map).";
    dgroupEnd();
    return;
  }

  // 5) Геттери по шапці
  const getByHeader = makeHeaderGetter(colMap);
  const getSub   = r => getByHeader(r,'Підкатегорія-товар','Підкатегорія','Товар','Назва');
  const getCat   = r => getByHeader(r,'Категорія');
  const getMark  = r => getByHeader(r,'Аксесуари Категорії','Маркер','Мітка');
  const getSize  = r => getByHeader(r,'Розмір','D','Ø','Size');
  const getPrice = r => getByHeader(r,'Вартість','Ціна','Price');
  const getMapTo = r => getByHeader(r,'Аксесуари Товару','Аксесуари товару');

  // 6) Контрольний зразок
  if (rows.length) {
    dlog('SAMPLE ROW[0]:', rows[0]);
    dlog('HEADERS MAP:', colMap);
  }

  // 7) Знаходимо базовий товар
  let mainRow = rows.find(r =>
    _norm(getSub(r)) === _norm(subcategory) &&
    eqSize(getSize(r), size) &&
    !['аксесуари','додатково'].includes(_norm(getMark(r)))
  );
  if (!mainRow) mainRow = rows.find(r =>
    _norm(getSub(r)) === _norm(subcategory) && eqSize(getSize(r), size)
  );
  if (!mainRow) mainRow = rows.find(r =>
    _norm(getSub(r)) === _norm(subcategory)
  );

  // 8) Категорія
  const selectedCategory = mainRow ? String(getCat(mainRow) || "").trim() : "";
  dlog('mainRow found:', !!mainRow, { selectedCategory });

  // 9) Заголовок
  accessoryTitle.textContent = selectedCategory
    ? `Аксесуари для ${selectedCategory} — ${size}`
    : `Аксесуари для d${size}`;

  // 10) Пошук аксесуарів
  const matches = [];
  rows.forEach((r, idx) => {
    const rowSub   = getSub(r);
    const rowCat   = getCat(r);
    const rowMark  = String(getMark(r) || '');
    const rowSize  = getSize(r);
    const rowPrice = getPrice(r);
    const mapTo    = getMapTo(r);

    if (_norm(rowMark) !== 'аксесуари') return;
    if (selectedCategory && _norm(rowCat) !== _norm(selectedCategory)) return;

    const targets = parseAccessoryTargets(mapTo);
    if (!targets.length) return;

    const ok = targets.some(t => {
      const okName = normalizeProductName(t.name) === normalizeProductName(subcategory);
      const okSize = (String(t.size).trim() === '') ? true : eqSize(t.size, size);
      return okName && okSize;
    });

    if (ok) matches.push(r);
  });

  // 11) Якщо порожньо
  if (!matches.length && !mainRow) {
    accessoryContainer.textContent = "Аксесуари для цього діаметра не знайдено.";
    dgroupEnd();
    return;
  }

  // 🔹 Додаємо блок ОСНОВНОГО товару
  if (mainRow) {
    const mainSub   = getSub(mainRow);
    const mainSize  = getSize(mainRow);
    const mainPrice = Number(getPrice(mainRow));

    const mainCard = document.createElement("div");
    styleMainCard(mainCard); // ✅ стилі основного товару

    const title = document.createElement("div");
    title.style.fontWeight = "bold";
    title.textContent = `${mainSub} — d${mainSize} — ${mainPrice} грн`;

  const btn = document.createElement("button");
btn.textContent = "Додати";
btn.className = "category-button";
btn.style.marginLeft = "16px";

// --- Фікс, щоб кнопка не розтягувалась на всю ширину ---
btn.style.setProperty('width', 'auto', 'important');
btn.style.flex = '0 0 auto';
btn.style.display = 'inline-flex';
btn.style.whiteSpace = 'nowrap';



    btn.onclick = () => {
      order.push({ name: mainSub, size: mainSize, price: mainPrice });
      if (typeof saveOrderToLS === 'function') saveOrderToLS();
      if (!Number.isNaN(mainPrice)) { total += mainPrice; }
      if (typeof updateOrderView === 'function') updateOrderView();
      if (typeof reattachOpisHandlers === 'function') reattachOpisHandlers();
      if (typeof showExtraOptions === 'function') showExtraOptions(mainSub, mainSize, allData);
    };

    mainCard.appendChild(title);
    mainCard.appendChild(btn);
    accessoryContainer.appendChild(mainCard);
  }

  // 13) Малюємо картки АКСЕСУАРІВ
  matches.forEach((row, i) => {
    const sub      = getSub(row);
    const diameter = getSize(row);
    const price    = Number(getPrice(row));

    const card = document.createElement("div");
    // після: const card = document.createElement("div");
   card.classList.add('card-row');   // <--- ось тут
   card.style.border = "1px solid #ccc";
    styleAccessoryCard(card); // ✅ стилі аксесуарів

    const title = document.createElement("div");

// після: const title = document.createElement("div");
title.textContent = `${sub} — d${diameter} — ${price} грн`;
title.classList.add('card-title'); // <--- ось тут // <- заголовок тягнеться, але НЕ кнопка

    title.textContent = `${sub} — d${diameter} — ${price} грн`;

    const btn = document.createElement("button");
    btn.textContent = "Додати";
    btn.className = "category-button";
    btn.style.marginTop = "8px";
/* ⬇️ Фіксуємо поведінку лише для карток ДОДАТКОВО */
btn.style.flex = "0 0 auto";
btn.style.width = "auto";
btn.style.display = "inline-block";
btn.style.whiteSpace = "nowrap";
btn.style.minWidth = "90px";
btn.style.alignSelf = "center";





    btn.onclick = () => {
      order.push({ name: sub, size: diameter, price });
      if (typeof saveOrderToLS === 'function') saveOrderToLS();
      if (!Number.isNaN(price)) { total += price; }
      if (typeof updateOrderView === 'function') updateOrderView();
      if (typeof reattachOpisHandlers === 'function') reattachOpisHandlers();
      if (typeof showExtraOptions === 'function') showExtraOptions(sub, diameter, allData);
    };

    card.appendChild(title);
    card.appendChild(btn);
    accessoryContainer.appendChild(card);
  });

  dgroupEnd();
}



//******************************************************************************************** */
//=================================================================
// ...твій основний код JS (обробка категорій, підкатегорій і т.д.)

// 🔽 Прокрутка до елемента з певним id
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}


//================== Вивіт товарів ДОДАТКОВО =================================
// Перевіряємо чи є лічильник у памʼяті браузера, якщо нема — ставимо 1
if (!localStorage.getItem('descriptionCounter')) {
    localStorage.setItem('descriptionCounter', '1');
}



//================== Вивід товарів ДОДАТКОВО (через колонку "Додатково" у АКСЕСУАРІ) =================
function showExtraOptions(subcategory, size, allData) {
  const extraBlock     = document.getElementById("extraBlock");
  const extraContainer = document.getElementById("extraContainer");
  const extraTitle     = document.getElementById("extraTitle");
  const closeBtn       = document.getElementById("closeExtraBlockBtn");

  // 🔄 Показуємо блок додатково:
  if (extraContainer) {
    // 1) Прибрати ТІЛЬКИ попередні картки (щоб не дублювались)
    extraContainer.querySelectorAll(".extra-card").forEach(el => el.remove());
    // 2) Сховати всі існуючі форми-обгортки (але не видаляти)
    extraContainer.querySelectorAll("[data-description-id]").forEach(w => {
      w.style.display = "none";
    });
    extraContainer.style.display = "block";
  }
  if (extraTitle) {
    extraTitle.textContent = "Додатково:";
    extraTitle.style.display = "block";
  }
  if (extraBlock) extraBlock.style.display = "block";
  if (closeBtn)   closeBtn.style.display   = "inline-block";

  // Дані + мапа шапки
  const rows   = (allData && allData.full) || [];
  const colMap = (allData && allData.colIdx && allData.colIdx.map) || {};
  if (!Object.keys(colMap).length) {
    if (extraContainer) extraContainer.textContent = "Не знайдено мапи заголовків (colIdx.map).";
    return;
  }

  // Геттери по назвах колонок
  const getByHeader = makeHeaderGetter(colMap);
  const getSub   = r => getByHeader(r,'Підкатегорія-товар','Підкатегорія','Товар','Назва');
  const getCat   = r => getByHeader(r,'Категорія');
  const getMark  = r => getByHeader(r,'Аксесуари Категорії','Маркер','Мітка');
  const getSizeV = r => getByHeader(r,'Розмір','D','Ø','Size');
  const getPrice = r => getByHeader(r,'Вартість','Ціна','Price');
  const getAdd   = r => getByHeader(r,'Додатково','Параметри аксесуарів додатково','Параметри додатково');

  // 1) Рядок самого аксесуара
  const accRow = rows.find(r =>
    normalizeProductName(getSub(r)) === normalizeProductName(subcategory) &&
    eqSize(getSizeV(r), size) &&
    _norm(getMark(r)) === 'аксесуари'
  );
  if (!accRow) return;

  const accessoryCategory = String(getCat(accRow) || '').trim();
  const addRaw = String(getAdd(accRow) || '').trim();

  // 2) Імена послуг із "Додатково"
  const extraNames = addRaw
    .replace(/[“”«»]/g, '"')
    .replace(/"{2,}/g, '"')
    .split(/[,/;\r\n]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  if (!extraNames.length) {
    if (extraContainer) extraContainer.style.display = "none";
    if (extraTitle)     extraTitle.style.display     = "none";
    if (closeBtn)       closeBtn.style.display       = "none";
    return;
  }

  // 3) Реальні товари "ДОДАТКОВО" із таблиці
  const extras = rows.filter(r => {
    if (_norm(getMark(r)) !== 'додатково') return false;
    if (accessoryCategory && _norm(getCat(r)) !== _norm(accessoryCategory)) return false;
    if (!eqSize(getSizeV(r), size)) return false;
    return extraNames.some(n =>
      normalizeProductName(n) === normalizeProductName(getSub(r))
    );
  });
  if (!extras.length) {
    if (extraContainer) extraContainer.style.display = "none";
    if (extraTitle)     extraTitle.style.display     = "none";
    if (closeBtn)       closeBtn.style.display       = "none";
    return;
  }

  // 4) Рендеримо картки ДОДАТКОВО
  extras.forEach(row => {
    const sub      = getSub(row);
    const diameter = getSizeV(row);
    const price    = Number(getPrice(row));

    const card = document.createElement("div");
    card.classList.add("extra-card");               // ← маркер картки (щоб можна було чистити тільки їх)
    card.style.border = "1px solid #ccc";
    card.style.padding = "10px";
    card.style.borderRadius = "8px";
    card.style.backgroundColor = "#fff9e6";
    card.style.marginBottom = "10px";
    card.style.display = "flex";
    card.style.alignItems = "center";
    card.style.justifyContent = "space-between";
    card.style.flexWrap = "wrap";

    const title = document.createElement("div");
    title.textContent = `${sub} — d${diameter} — ${price} грн`;
    title.style.flex = "1";

    const btn = document.createElement("button");
    btn.textContent = "Додати";
    btn.className = "category-button";
    btn.style.marginLeft = "16px";
    btn.style.flex = "0";
    btn.style.width = "auto";

    // Форма для опису (wrapper)
    const inputWrapper = document.createElement("div");
    inputWrapper.style.display = "none";
    inputWrapper.style.width = "100%";
    inputWrapper.style.boxSizing = "border-box";
    inputWrapper.style.padding = "20px 24px";
    inputWrapper.style.marginTop = "15px";
    inputWrapper.style.border = "1px solid #ccc";
    inputWrapper.style.borderRadius = "12px";
    inputWrapper.style.backgroundColor = "#fefefe";
    inputWrapper.style.boxShadow = "0 0 10px rgba(0,0,0,0.05)";
    inputWrapper.style.marginBottom = "20px";

    const fields = [
      { label: "Напис зверху",   key: "top"    },
      { label: "Напис по центру",key: "center" },
      { label: "Напис знизу",    key: "bottom" },
      { label: "Опис рисунка",   key: "drawing"}
    ];

    const descriptionId = `Опис ${order.length + 1}`;
    inputWrapper.dataset.descriptionId = descriptionId;
    const savedData = localStorage.getItem(descriptionId);
    const inputData = savedData ? JSON.parse(savedData) : {};

    fields.forEach(field => {
      const label = document.createElement("label");
      label.textContent = field.label;
      label.style.display = "block";
      label.style.marginTop = "5px";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = field.label;
      input.style.width = "98%";
      input.style.padding = "6px 10px";
      input.style.marginBottom = "10px";
      input.style.border = "1px solid #ccc";
      input.style.borderRadius = "6px";

      input.id = field.key + "Input"; // залишаю як у тебе
      input.value = inputData[field.key] || "";
      input.oninput = () => { inputData[field.key] = input.value; };

      inputWrapper.appendChild(label);
      inputWrapper.appendChild(input);
    });

    btn.onclick = () => {
      btn.id = "add_description";

      let currentCounter = parseInt(localStorage.getItem('descriptionCounter') || '1', 10);
      const newDescId = `Опис ${currentCounter}`;
      localStorage.setItem('descriptionCounter', (currentCounter + 1).toString());
      inputWrapper.dataset.descriptionId = newDescId;

      const opisBtnHtml = `<button class="category-button" id="${newDescId}" data-order-index="${order.length}">ОПИС</button>`;

      order.push({
        name: sub,
        size: diameter,
        price,
        extra: opisBtnHtml,
        details: { ...inputData }
      });

      saveOrderToLS && saveOrderToLS();

      const orderIndex = order.length - 1;
      inputWrapper.dataset.index = orderIndex;

      if (!Number.isNaN(price)) total += Number(price);
      updateOrderView && updateOrderView();
      reattachOpisHandlers && reattachOpisHandlers();

      // 🔽 показуємо тільки поточну форму
      if (extraContainer) {
        extraContainer.querySelectorAll("[data-description-id]").forEach(w => {
          w.style.display = "none";
        });
      }
      inputWrapper.style.display = "block";

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Зберегти опис";
      saveBtn.className = "category-button";
      saveBtn.style.marginTop = "10px";

      saveBtn.onclick = () => {
        const index = inputWrapper.dataset.index;
        order[index].details = { ...inputData };
        const key = inputWrapper.dataset.descriptionId;
        localStorage.setItem(key, JSON.stringify(inputData));

        const inputs = inputWrapper.querySelectorAll("input");
        inputs.forEach(input => {
          input.readOnly = true;
          input.style.backgroundColor = "#f0f0f0";
        });

        saveBtn.disabled = true;
        saveBtn.textContent = "Збережено ✅";

        updateOrderView && updateOrderView();
        reattachOpisHandlers && reattachOpisHandlers();

        // ✅ Ховаємо ТІЛЬКИ extraContainer, нічого не чистимо
        if (extraContainer) {
          extraContainer.style.display = "none";
        }
      };

      inputWrapper.appendChild(saveBtn);
      btn.style.display = "none";
    };

    card.appendChild(title);
    card.appendChild(btn);
    extraContainer.appendChild(card);
    extraContainer.appendChild(inputWrapper);
  });
}



//======функція для генерації унікального ключа:============
function generateDescriptionKey(name, size, index) {
  return `опис_${name}_d${size}_${index}`;
}

function dataLabel(key) {
  switch (key) {
    case "top": return "зверху";
    case "center": return "по центру";
    case "bottom": return "знизу";
    case "drawing": return "рисунка";
    default: return key;
  }
}
//========================Кнопка закрити вікно ДОДАТКОВО ================================

const closeBtn = document.getElementById("closeExtraBlockBtn");
if (closeBtn) {
  // один єдиний обробник — щоб не треба було клікати 9 разів
  closeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const extraContainer = document.getElementById("extraContainer");
    if (extraContainer) extraContainer.style.display = "none";
    // НІЧОГО більше не ховаємо й не чистимо
  };
}
//========================Записуємо дані у Google Sheets ================================



/*
document.getElementById("submitAll").addEventListener("click", async (event) => {
event.preventDefault();

  if (order.length === 0) {
    alert("Додайте хоча б один товар перед оформленням.");
    return;
  }

  const discount = parseFloat(document.getElementById("discountInput").value) || 0;
  const prepay = parseFloat(document.getElementById("prepaymentInput").value) || 0;

  try {
    const total = order.reduce((sum, item) => sum + item.price, 0);

    const payload = order.map((item, index) => {
  const { top, center, bottom, drawing } = item.details || {};
  const descriptionParts = [];

  if (top) descriptionParts.push(`Напис в Верху: ${top}`);
  if (center) descriptionParts.push(`Напис по центру: ${center}`);
  if (bottom) descriptionParts.push(`Напис з низу: ${bottom}`);
  if (drawing) descriptionParts.push(`Рисунок: ${drawing}`);

  const descriptionText = descriptionParts.join('\n');

  // ✅ Правильно отримуємо значення з DOM
  const olxDelivery = document.getElementById("olxInput")?.value || "";
  const promDelivery = document.getElementById("promInput")?.value || "";
  const paidDelivery = document.getElementById("deliveryInput")?.value || "";




  return {
    product: item.name,
    size: item.size,
    price: item.price,
    description: descriptionText || "",             // ✅ це під колонку X
    total: index === 0 ? ((parseFloat(olxDelivery) > 0 || parseFloat(promDelivery) > 0) ? "0" : total) : "",  //======================================
    discount: index === 0 ? discount : "",
    prepay: index === 0 ? prepay : "",

                      // ➕ ДОДАНО
    olxDelivery: index === 0 ? olxDelivery : "",
    promDelivery: index === 0 ? promDelivery : "",
    paidDelivery: index === 0 ? paidDelivery : ""




  };
});

    const response = await fetch("https://shifttime-crm-test.onrender.com/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("✅ Відповідь від сервера:", result);

    alert("✅ Успішно надіслано всі товари одним запитом!");
    order.length = 0;
    updateOrderView();
    reattachOpisHandlers();  //----------------------------------------------------------77

  } catch (error) {
    console.error("❌ Помилка при надсиланні замовлення:", error);
    alert("❌ Помилка при надсиланні. Перевірте інтернет або зверніться до розробника.");
  }
});
*/




//============================= Кнопка ОЛХ ДОСТАВКА ==============================================================
const olxBtn = document.getElementById("olxBtn");                 // Отримуємо кнопку "ОЛХ ДОСТАВКА"
const olxWrapper = document.getElementById("olxInputWrapper");    // Обгортка для поля вводу вартості доставки ОЛХ
const olxInput = document.getElementById("olxInput");             // Поле вводу вартості доставки ОЛХ

olxBtn.addEventListener("click", () => {                          // Додаємо подію на клік кнопки

          olxInput.value = "";                                    // 🧹 Очищаємо поле ОЛХ при відкритті ПРОМ
          promInput.value = "";                                   // 🧹 Очищаємо поле ПРОМ при відкритті
          deliveryInput.value = "";                               // 🧹 Очищаємо поле ДОСТАВКИ при відкритті



  if (olxWrapper && olxWrapper.style.display === "none") {
  olxWrapper.style.display = "block";
} else if (olxWrapper) {
  olxWrapper.style.display = "none";
}
});

//============================= Кнопка ПРОМ Замовлення ===========================================================
const promBtn = document.getElementById("promBtn");               // Отримуємо кнопку "ПРОМ Замовлення"
const promWrapper = document.getElementById("promInputWrapper"); // Обгортка для поля вводу вартості ПРОМ доставки
const promInput = document.getElementById("promInput");           // Поле вводу вартості ПРОМ доставки

promBtn.addEventListener("click", () => {                         // Додаємо подію на клік кнопки
          olxInput.value = "";                                    // 🧹 Очищаємо поле ОЛХ при відкритті ПРОМ
          promInput.value = "";                                   // 🧹 Очищаємо поле ПРОМ при відкритті
          deliveryInput.value = "";                               // 🧹 Очищаємо поле ДОСТАВКИ при відкритті

          if (promWrapper && promWrapper.style.display === "none") {
  promWrapper.style.display = "block";
} else if (promWrapper) {
  promWrapper.style.display = "none";
}
});

//============================= Кнопка Оплата Доставки ===========================================================
const deliveryBtn = document.getElementById("deliveryBtn");                 // Отримуємо кнопку "Оплата Доставки"
const deliveryWrapper = document.getElementById("deliveryInputWrapper");   // Обгортка для поля вводу доставки
const deliveryInput = document.getElementById("deliveryInput");            // Поле вводу вартості доставки

deliveryBtn.addEventListener("click", () => {                               // Додаємо подію на клік кнопки

          olxInput.value = "";                                    // 🧹 Очищаємо поле ОЛХ при відкритті ПРОМ
          promInput.value = "";                                   // 🧹 Очищаємо поле ПРОМ при відкритті
          deliveryInput.value = "";                               // 🧹 Очищаємо поле ДОСТАВКИ при відкритті




  if (deliveryWrapper && deliveryWrapper.style.display === "none") {
    deliveryWrapper.style.display = "block";
  } else if (deliveryWrapper) {
    deliveryWrapper.style.display = "none";
  }
});

//============================= Функція перемикання блоків (не використовується зараз) ===========================
function toggleInput(inputId) {                                             // Функція для перемикання видимості одного з полів
  const input = document.getElementById(inputId);                           // Отримуємо поле по ID
  const isVisible = input.style.display === 'inline-block';                // Перевіряємо, чи воно зараз видно

  ['olxInput', 'promInput', 'deliveryInput'].forEach(id => {               // 🔁 Ховаємо усі три поля
    document.getElementById(id).style.display = 'none';                    
  });

  if (!isVisible) {                                                        // Якщо поле було приховане
    input.style.display = 'inline-block';                                  // ➕ показуємо його
  }
}

//============================= Прив’язка кнопок до toggleInput (можна видалити, якщо не використовується) ======
document.getElementById('olxBtn').addEventListener('click', () => {        // Прив’язка кнопки ОЛХ до toggleInput
  toggleInput('olxInput');
});
document.getElementById('promBtn').addEventListener('click', () => {       // Прив’язка кнопки ПРОМ до toggleInput
  toggleInput('promInput');
});
document.getElementById('deliveryBtn').addEventListener('click', () => {   // Прив’язка кнопки ДОСТАВКА до toggleInput
  toggleInput('deliveryInput');
});


//************************************************************************************* */
}













// СТАБІЛЬНЕ делегування кліку по кнопках "ОПИС …"

function reattachOpisHandlers() {
  // знімаємо старий хендлер (щоб не дублювався)
  if (window.__opisClickHandler) {
    document.removeEventListener('click', window.__opisClickHandler, true);
  }

  window.__opisClickHandler = function (e) {
    const btn = e.target.closest('button[id^="Опис"]');
    if (!btn) return;

    const descriptionId = btn.id; // наприклад: "Опис 3"

    const extraBlock     = document.getElementById('extraBlock');
    const extraContainer = document.getElementById('extraContainer');
    const extraTitle     = document.getElementById('extraTitle');
    const closeBtn       = document.getElementById('closeExtraBlockBtn');

    if (!extraContainer) {
      console.warn('❗ Не знайдено #extraContainer');
      return;
    }

    // Показуємо секцію "Додатково"
    if (extraBlock) extraBlock.style.display = 'block';
    if (extraTitle) { extraTitle.textContent = 'Додатково:'; extraTitle.style.display = 'block'; }
    if (closeBtn)   closeBtn.style.display   = 'inline-block';
    extraContainer.style.display = 'block';

    // 🔒 У режимі перегляду опису ховаємо ВСІ кнопки "Додати" в extraContainer
    extraContainer.querySelectorAll('.extra-card .category-button').forEach(b => {
      if (b.textContent.trim().toLowerCase() === 'додати') b.style.display = 'none';
    });

    // Ховаємо всі інші форми-обгортки
    extraContainer.querySelectorAll('[data-description-id]').forEach(w => {
      w.style.display = 'none';
    });

    // Знаходимо/створюємо wrapper саме для цієї кнопки
    let wrapper = extraContainer.querySelector(`[data-description-id="${descriptionId}"]`);

    if (!wrapper) {
      // Відновлюємо дані з localStorage (якщо є)
      const data = JSON.parse(localStorage.getItem(descriptionId) || '{}');

      wrapper = document.createElement('div');
      wrapper.dataset.descriptionId = descriptionId;
      wrapper.style.display = 'none';
      wrapper.style.width = '100%';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.padding = '20px 24px';
      wrapper.style.marginTop = '15px';
      wrapper.style.border = '1px solid #ccc';
      wrapper.style.borderRadius = '12px';
      wrapper.style.backgroundColor = '#fefefe';
      wrapper.style.boxShadow = '0 0 10px rgba(0,0,0,0.05)';
      wrapper.style.marginBottom = '20px';

      const fields = [
        { label: 'Напис зверху',   key: 'top' },
        { label: 'Напис по центру',key: 'center' },
        { label: 'Напис знизу',    key: 'bottom' },
        { label: 'Опис рисунка',   key: 'drawing' }
      ];

      fields.forEach(f => {
        const lab = document.createElement('label');
        lab.textContent = f.label;
        lab.style.display = 'block';
        lab.style.marginTop = '5px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = f.label;
        input.style.width = '98%';
        input.style.padding = '6px 10px';
        input.style.marginBottom = '10px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '6px';

        // лишаємо твої id для сумісності
        input.id = f.key + 'Input';
        input.value = (data && data[f.key]) || '';
        input.oninput = () => {
          // оновлюємо чернетку одразу в LS
          const cur = JSON.parse(localStorage.getItem(descriptionId) || '{}');
          cur[f.key] = input.value;
          localStorage.setItem(descriptionId, JSON.stringify(cur));
        };

        wrapper.appendChild(lab);
        wrapper.appendChild(input);
      });

      // Кнопка "Зберегти опис" у відновленому wrapper (щоб можна було редагувати і зберегти)
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Зберегти опис';
      saveBtn.className = 'category-button';
      saveBtn.style.marginTop = '10px';
      saveBtn.dataset.role = 'saveOpis';
      saveBtn.onclick = () => {
        // знімаємо актуальні значення з інпутів
        const payload = {
          top:     wrapper.querySelector('#topInput')?.value || '',
          center:  wrapper.querySelector('#centerInput')?.value || '',
          bottom:  wrapper.querySelector('#bottomInput')?.value || '',
          drawing: wrapper.querySelector('#drawingInput')?.value || ''
        };
        localStorage.setItem(descriptionId, JSON.stringify(payload));

        // опційно: оновити таблицю замовлення
        if (typeof updateOrderView === 'function') updateOrderView();
        if (typeof reattachOpisHandlers === 'function') reattachOpisHandlers();

        // підтвердження збереження
        saveBtn.disabled = true;
        saveBtn.textContent = 'Збережено ✅';

        // ❗ Лише ховаємо extraContainer (за потреби — залиш як є)
        const ec = document.getElementById('extraContainer');
        if (ec) ec.style.display = 'none';
      };
      wrapper.appendChild(saveBtn);

      extraContainer.appendChild(wrapper);
    }

    // Показуємо потрібний wrapper
    wrapper.style.display = 'block';
  };

  // Вішаємо один-єдиний делегований слухач (capture=true)
  document.addEventListener('click', window.__opisClickHandler, true);
}

// виклич один раз після ініціалізації сторінки:
reattachOpisHandlers();



function insertDataToFields(data) {
  const topInput = document.getElementById("topInput");
  const centerInput = document.getElementById("centerInput");
  const bottomInput = document.getElementById("bottomInput");
  const drawingInput = document.getElementById("drawingInput");

  if (!topInput || !centerInput || !bottomInput || !drawingInput) {
    console.warn("❗️Поля опису ще не завантажені у DOM");
    return;
  }

  topInput.value = data.top || "";
  centerInput.value = data.center || "";
  bottomInput.value = data.bottom || "";
  drawingInput.value = data.drawing || "";
}

function waitForElement(selector, callback, maxAttempts = 30, interval = 50) {
  let attempts = 0;

  const timer = setInterval(() => {
    const el = document.querySelector(selector);
    if (el) {
      clearInterval(timer);
      callback(); // Викликаємо, коли знайдено
    } else {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        console.warn("❗️Елемент не знайдено: " + selector);
      }
    }
  }, interval);
}
// ---- helper: перетворення ціни в число ----
function parsePrice(v) {
  if (typeof v === 'number') return v;
  if (v == null) return null;
  let s = String(v)
    .replace(/грн|uah|₴/gi, '')
    .replace(/\s/g, '')
    .replace(/(?<=\d)\.(?=\d{3}\b)/g, '') // прибрати тисячні крапки: 1.200 → 1200
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ✅ Закривати ТІЛЬКИ #extraContainer і лише одним хендлером
(function bindCloseExtraContainerOnce() {
  if (window.__closeExtraDelegBound) return;
  window.__closeExtraDelegBound = true;

  document.addEventListener('click', function onCloseClick(e) {
    const closeBtn = e.target.closest('#closeExtraBlockBtn');
    if (!closeBtn) return;

    const extraContainer = document.getElementById('extraContainer');
    if (!extraContainer) return;

    // Глушимо всі інші слухачі на цій кнопці
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();

    // Закриваємо тільки контейнер з формами
    extraContainer.style.display = 'none';
    // НІЧОГО не чистимо й не ховаємо (#extraBlock, #extraTitle не чіпаємо)
  }, true); // capture=true — перехопимо подію першими
})();