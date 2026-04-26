// frontend/widgets/config-kv/config-kv-page.js
// UI сторінки CONFIG (KEY / VALUE / VALUE_1 / VALUE_2)
// Працює проти бекенду /api/config/kv (Netlify proxy → GAS).
// У таблиці мають бути заголовки: KEY | VALUE | VALUE_1 | VALUE_2

/** ===================== API (fetch) ===================== */
const api = {
  /** Отримати список ключів (з optional-пошуком) */
  async list(q = '') {
    const u = new URL('/api/config/kv', location.origin);
    u.searchParams.set('res', 'kv');
    u.searchParams.set('mode', 'list');
    if (q) u.searchParams.set('search', q);

    const r = await fetch(u.toString(), { method: 'GET' });
    const j = await r.json();
    if (!j || j.success === false) throw new Error((j && j.error) || 'KV list failed');
    return j.items || [];
  },

  /** Оновити один ключ (можна передати одразу кілька колонок) */
  async set(payload) {
    const u = new URL('/api/config/kv', location.origin);
    u.searchParams.set('res', 'kv');
    u.searchParams.set('mode', 'set');

    const r = await fetch(u.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!j || j.success === false) throw new Error((j && j.error) || 'KV set failed');
    return j;
  },

  /** Масове оновлення:
   *   1) [{key, col:'VALUE'|'VALUE_1'|'VALUE_2', value}, ...]
   *   2) [{key, value, value1, value2}, ...]
   */
  async bulkSet(items) {
    const u = new URL('/api/config/kv', location.origin);
    u.searchParams.set('res', 'kv');
    u.searchParams.set('mode', 'bulk_set');

    const r = await fetch(u.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const j = await r.json();
    if (!j || j.success === false) throw new Error((j && j.error) || 'KV bulk_set failed');
    return j;
  },

  /** Видалити ключ повністю (GAS: mode=remove) */
  async remove(key) {
    const u = new URL('/api/config/kv', location.origin);
    u.searchParams.set('res', 'kv');
    u.searchParams.set('mode', 'remove');

    console.log('[KV] REMOVE →', u.toString(), { key });

    const r = await fetch(u.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    const text = await r.text();
    console.log('[KV] REMOVE status=', r.status, 'raw=', text);

    let j = {};
    try { j = JSON.parse(text || '{}'); } catch (_) {}
    if (!r.ok || j.success === false) {
      console.error('[KV] REMOVE fail:', j?.error || `HTTP ${r.status}`);
      throw new Error(j?.error || `HTTP ${r.status}`);
    }
    console.log('[KV] REMOVE ok:', j);
    return j;
  },
};

/** ===================== Мінімальне модальне підтвердження ===================== */
function ensureConfirmModal() {
  if (document.getElementById('kv-confirm-modal')) return;

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div id="kv-confirm-modal" style="
      position: fixed; inset: 0; display:none; align-items:center; justify-content:center;
      background: rgba(0,0,0,.35); z-index: 9999;">
      <div style="
        width: min(520px, 92vw); border-radius: 16px; padding: 18px;
        background: white; color: #111; box-shadow: 0 10px 30px rgba(0,0,0,.25);">
        <div id="kv-confirm-title" style="font-weight:600; font-size:18px; margin-bottom:8px;">
          Підтвердження
        </div>
        <div id="kv-confirm-message" style="font-size:14px; opacity:.85; white-space:pre-wrap;"></div>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
          <button id="kv-confirm-cancel" style="
            padding:8px 12px; border-radius:10px; border:1px solid #e5e7eb; background:#fff;">
            Скасувати
          </button>
          <button id="kv-confirm-ok" style="
            padding:8px 12px; border-radius:10px; border:1px solid transparent; color:#fff; background:#ef4444;">
            Так, видалити
          </button>
        </div>
      </div>
    </div>
  `.trim();
  document.body.appendChild(tpl.content);
}

function confirmDialog(message, { title = 'Підтвердження', okText = 'Так', cancelText = 'Скасувати' } = {}) {
  ensureConfirmModal();

  const root    = document.getElementById('kv-confirm-modal');
  const titleEl = document.getElementById('kv-confirm-title');
  const msgEl   = document.getElementById('kv-confirm-message');
  const okBtn   = document.getElementById('kv-confirm-ok');
  const cancel  = document.getElementById('kv-confirm-cancel');

  titleEl.textContent = title;
  msgEl.textContent   = message;
  okBtn.textContent   = okText;
  cancel.textContent  = cancelText;

  root.style.display = 'flex';

  return new Promise((resolve) => {
    const close = (val) => {
      root.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      root.removeEventListener('click', onBackdrop);
      resolve(val);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = (e) => { if (e.target === root) close(false); };

    okBtn.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    root.addEventListener('click', onBackdrop);
  });
}

// ✅ єдине API, яке викликає UI
function confirmDeleteModal(key) {
  // Використовуємо наш діалог; fallback — window.confirm (на випадок, якщо стилі не підвантажаться)
  if (typeof confirmDialog === 'function') {
    return confirmDialog(`Видалити ключ "${key}"?`, {
      title: 'Підтвердження видалення',
      okText: 'Видалити',
      cancelText: 'Скасувати',
    });
  }
  return Promise.resolve(window.confirm(`Видалити ключ "${key}"?`));
}

/** ===================== Утиліти для textarea ===================== */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
function bindAutoGrow(textarea) {
  autoGrow(textarea);
  textarea.addEventListener('input', () => autoGrow(textarea));
}

/** ===================== Основна ініціалізація сторінки ===================== */
export async function initConfigKVPage(root = document) {
  const page = (root === document)
    ? document.getElementById('config-kv-page')
    : root.querySelector('#config-kv-page');
  if (!page) return;

  // Контроли зі сторінки
  const tableWrap  = page.querySelector('#kv-table');
  const searchEl   = page.querySelector('#kv-search');
  const refreshBtn = page.querySelector('#kv-refresh');
  const saveAllBtn = page.querySelector('#kv-save-all');
  const addForm    = page.querySelector('#kv-add-form');

  const newKeyEl  = page.querySelector('#kv-new-key');
  const newValEl  = page.querySelector('#kv-new-value');
  const newVal1El = page.querySelector('#kv-new-value1');
  const newVal2El = page.querySelector('#kv-new-value2');

  const envSelect = page.querySelector('#kv-env'); // селектор «Середовище» для підсвічування

  // Мапа "змінена клітинка" → {key, col, value}
  // col ∈ {'VALUE','VALUE_1','VALUE_2'}
  const dirty = new Map();
  const makeCellId = (key, col) => `${key}::${col}`;

  function applyTableScroll() {
    if (!tableWrap) return;
    tableWrap.style.maxHeight = 'calc(100vh - 320px)'; // підрегулюй за макетом
    tableWrap.style.overflowY = 'auto';
  }

  /** Рендер таблиці ключів */
  function renderTable(items) {
    // Сортуємо за KEY для стабільності
    items.sort((a, b) => a.key.localeCompare(b.key));

    const activeCol = envSelect?.value || 'VALUE'; // підсвічуємо вибране середовище

    const makeCell = (key, colName, val) => {
      const cid = makeCellId(key, colName);
      return `
        <td class="px-2 py-2 align-top ${activeCol === colName ? 'env-active' : ''}">
          <textarea class="kv-textarea border rounded w-full px-2 py-1"
            rows="1" data-key="${key}" data-col="${colName}">${val || ''}</textarea>
          <div class="flex gap-2 mt-1 text-xs items-center">
            <span class="kv-status opacity-60" data-cell="${cid}-status"></span>
          </div>
        </td>
      `;
    };

    const rows = items.map((it) => `
      <tr class="border-b">
        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono align-top w-[260px]">${it.key}</td>
        ${makeCell(it.key, 'VALUE',   it.value)}
        ${makeCell(it.key, 'VALUE_1', it.value1)}
        ${makeCell(it.key, 'VALUE_2', it.value2)}
        <td class="px-2 py-2 align-top w-[160px]">
          <div class="flex gap-2">
            <button class="row-save px-2 py-1 rounded border w-full" data-rowkey="${it.key}">
              Зберегти рядок
            </button>
            <button class="row-del px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                    title="Видалити ключ" data-rowkey="${it.key}">
              ✖
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tableWrap.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th class="px-3 py-2 text-left w-[260px]">KEY</th>
            <th class="px-2 py-2 text-left">VALUE</th>
            <th class="px-2 py-2 text-left">VALUE_1</th>
            <th class="px-2 py-2 text-left">VALUE_2</th>
            <th class="px-2 py-2 text-left w-[140px]">Дія</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Прив'язка автозбільшення та трекінгу змін
    tableWrap.querySelectorAll('textarea.kv-textarea').forEach((ta) => {
      bindAutoGrow(ta);
      ta.addEventListener('input', () => {
        const key = ta.getAttribute('data-key');
        const col = ta.getAttribute('data-col'); // VALUE | VALUE_1 | VALUE_2
        const cid = makeCellId(key, col);
        dirty.set(cid, { key, col, value: ta.value });
        const s = tableWrap.querySelector(`[data-cell="${cid}-status"]`);
        if (s) s.textContent = 'не збережено';
      });
    });

    applyTableScroll();
  }

  /** Завантажити та перемалювати таблицю */
  async function refresh() {
    const items = await api.list(searchEl.value.trim());
    renderTable(items);
    dirty.clear();
  }

  /** ========== Обробники ========== */
  refreshBtn.addEventListener('click', refresh);

  // пошук з невеликим debounce
  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refresh(), 250);
  });

  envSelect?.addEventListener('change', () => {
    refresh(); // лише підсвітка колонки
  });

  // Зберегти один рядок (усі незбережені клітинки цього key)
  tableWrap.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button.row-save');
    if (!btn) return;

    const rowKey = (btn.getAttribute('data-rowkey') || '').trim();
    if (!rowKey) return;

    // зберемо dirty-елементи по цьому ключу
    const items = [];
    for (const [cid, entry] of dirty.entries()) {
      if (entry.key === rowKey) {
        items.push({ key: entry.key, col: entry.col, value: entry.value });
      }
    }

    if (items.length === 0) {
      alert('Для цього рядка немає незбережених змін.');
      return;
    }

    btn.disabled = true;
    try {
      await api.bulkSet(items);
      // Позначимо збереження та приберемо dirty по цьому ключу
      for (const [cid, entry] of Array.from(dirty.entries())) {
        if (entry.key === rowKey) {
          dirty.delete(cid);
          const st = tableWrap.querySelector(`[data-cell="${cid}-status"]`);
          if (st) st.textContent = '✔ збережено';
        }
      }
    } catch (err) {
      alert('Помилка збереження рядка: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Видалити рядок цілком
  tableWrap.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button.row-del');
    if (!btn) return;

    const rowKey = btn.getAttribute('data-rowkey');
    if (!rowKey) return;

    console.log('[UI] Click delete for key=', rowKey);

    const ok = await confirmDeleteModal(rowKey);
    if (!ok) return;

    btn.disabled = true;
    try {
      await api.remove(rowKey);
      await refresh();
    } catch (err) {
      console.error('[UI] delete error:', err);
      alert('Помилка видалення: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Зберегти всі зміни одразу
  saveAllBtn.addEventListener('click', async () => {
    const items = Array.from(dirty.values()).map((e) => ({
      key: e.key,
      col: e.col,
      value: e.value,
    }));

    if (items.length === 0) {
      alert('Немає змінених полів.');
      return;
    }

    saveAllBtn.disabled = true;
    try {
      await api.bulkSet(items);
      // Позначити “збережено” та очистити dirty
      items.forEach((it) => {
        const cid = makeCellId(it.key, it.col);
        const s = tableWrap.querySelector(`[data-cell="${cid}-status"]`);
        if (s) s.textContent = '✔ збережено';
        dirty.delete(cid);
      });
    } catch (err) {
      alert('Помилка bulk збереження: ' + err.message);
    } finally {
      saveAllBtn.disabled = false;
    }
  });

  // Додати новий ключ (з трьома значеннями)
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = (newKeyEl.value || '').trim();
    const value  = newValEl.value  || '';
    const value1 = newVal1El.value || '';
    const value2 = newVal2El.value || '';

    if (!key) {
      alert('Вкажіть KEY');
      return;
    }

    try {
      await api.set({ key, value, value1, value2 });

      // очистка форми
      newKeyEl.value = '';
      newValEl.value = '';
      newVal1El.value = '';
      newVal2El.value = '';
      [newValEl, newVal1El, newVal2El].forEach(autoGrow);

      await refresh();
    } catch (err) {
      alert('Помилка додавання: ' + err.message);
    }
  });

  // перше завантаження
  applyTableScroll();
  await refresh();
}

/* ====== Трошки локальних стилів (можеш перенести у CSS) ======
#config-kv-page textarea.kv-textarea {
  overflow: hidden;             // без горизонтального скролу
  resize: none;                 // автогроу у JS
  line-height: 1.35rem;
  font-family: ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", Consolas, "Liberation Mono", monospace;
  word-break: break-word;       // переносимо довгі токени
  white-space: pre-wrap;        // показуємо перенос рядків
}
#config-kv-page .env-active {
  outline: 2px solid rgba(99,102,241,0.45); // легке підсвічування активної колонки
  outline-offset: 2px;
  border-radius: 10px;
}
*/
