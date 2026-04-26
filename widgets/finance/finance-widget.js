// frontend/widgets/finance/finance-widget.js
// Віджет "Дохід / Розхід / Борг"
// ──────────────────────────────────────────────────────────────────────────────
// ✅ ЛОГІКА:
//   • На старті тягнемо метадані з таблиці (рядки 2–4) через GAS: mode=finance_meta
//   • Будуємо 3 списки категорій: income / expense / debt (лише НЕтехнічні колонки)
//   • Технічні колонки зі зірочкою:
//       *КОМЕНТАР         → збереження коментаря в колонку з її ключем
//       *(Я / САША)       → автогенерований <select> із пунктами зі дужок, запис у її ключ
//   • Жодного хардкоду ключів у коді — все приходить з таблиці
//   • Відправка POST на FINANCE_API (налаштуй у лоадері або в AppConfig)
//   • Пресети дизайну (localStorage) + on-the-fly налаштування теми
// ──────────────────────────────────────────────────────────────────────────────

(function () {

  console.log('[FW] finance-widget boot v1.0.3b');
  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 0) КОНСТАНТИ, СТАН, КЕШ                                               │
  // ╰────────────────────────────────────────────────────────────────────────╯
  const LS_KEYS = {
    presetList: "fw_presets_list",
    lastPreset: "fw_presets_last",
    styleBase:  "fw_style_vars",
    pp:         "fw_auto_pp"
  };

  // Джерела
  const FINANCE_POST = window.FINANCE_API || "/.netlify/functions/finance"; // POST endpoint
  const GAS_BASE_URL = (window.SHEETS_WEBAPP_URL || "").replace(/\/+$/, ""); // for finance_meta

  // Мета/категорії/технічні
  let META = null;
  let CATS = { income: [], expense: [], debt: [] };
  let TECH = { income: {}, expense: {}, debt: {} };

  // Стан
  let state = {
    mode: "income",
    categories: [],
    selectedCategory: null,
    tech: { commentKey: null, selectKey: null, selectOptions: [] },
  };

  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 1) ДОСТУП ДО DOM                                                       │
  // ╰────────────────────────────────────────────────────────────────────────╯
  const root           = document.getElementById("finance-widget");
  if (!root) return;

  const modeBtns       = Array.from(root.querySelectorAll(".fw-segment"));

  const catSearch      = root.querySelector("#fw-cat-search");
  const catList        = root.querySelector("#fw-cat-list");
  const activeCatName  = root.querySelector("#fw-active-cat-name");

  const form           = root.querySelector("#fw-entry-form");
  const amountInput    = root.querySelector("#fw-amount");
  const commentInput   = root.querySelector("#fw-comment");
  const autoPP         = root.querySelector("#fw-auto-pp");
  const autoDate       = root.querySelector("#fw-auto-date");
  const toast          = root.querySelector("#fw-toast");

  // Опційний технічний селект *(Я / САША)
  const selectWrap     = root.querySelector("#fw-select-wrap");
  const selectEl       = root.querySelector("#fw-select");
  const selectLabel    = root.querySelector("#fw-select-label");

  // Аналітика + Налаштування
  const analyticsBtn     = root.querySelector("#fw-analytics-btn");
  const analyticsSection = root.querySelector("#fw-analytics");
  const settingsBtn      = root.querySelector("#fw-settings-btn");
  const settingsPanel    = root.querySelector("#fw-settings-panel");
  const settingsClose    = root.querySelector("#fw-settings-close");

  // Налаштування / тема
  const cBg        = root.querySelector("#fw-c-bg");
  const cText      = root.querySelector("#fw-c-text");
  const cPrimary   = root.querySelector("#fw-c-primary");
  const cSecondary = root.querySelector("#fw-c-secondary");
  const cSuccess   = root.querySelector("#fw-c-success");
  const cDanger    = root.querySelector("#fw-c-danger");

  const rangeRadius  = root.querySelector("#fw-radius");
  const rangePad     = root.querySelector("#fw-padding");
  const rangeOpacity = root.querySelector("#fw-opacity");
  const rangeShadow  = root.querySelector("#fw-shadow");
  const maxwInput    = root.querySelector("#fw-maxw");
  const catsH        = root.querySelector("#fw-cats-h");
  const showLogo     = root.querySelector("#fw-show-logo");
  const titleText    = root.querySelector("#fw-title-text");

  const presetSelect = root.querySelector("#fw-preset-select");
  const presetSave   = root.querySelector("#fw-preset-save");
  const presetSaveAs = root.querySelector("#fw-preset-save-as");
  const presetDelete = root.querySelector("#fw-preset-delete");
  const presetReset  = root.querySelector("#fw-preset-reset");
  const settingsApply  = root.querySelector("#fw-settings-apply");
  const settingsCancel = root.querySelector("#fw-settings-cancel");

  const headerTitle = root.querySelector(".fw-title");
  const logoEl      = root.querySelector(".fw-logo");

  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 2) УТИЛІТИ                                                            │
  // ╰────────────────────────────────────────────────────────────────────────╯
  function fmtDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getNextPP() {
    const cur = Number(localStorage.getItem(LS_KEYS.pp) || "0");
    return cur + 1;
  }
  function commitPP(pp) {
    localStorage.setItem(LS_KEYS.pp, String(pp || 0));
  }

  function showToast(msg, type = "info") {
    toast.textContent = msg;
    toast.style.color =
      type === "error"   ? "var(--fw-danger)"  :
      type === "success" ? "var(--fw-success)" :
                           "var(--fw-text)";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.textContent = ""), 4000);
  }

  function setCSSVar(name, value) { root.style.setProperty(name, value); }

  function readCurrentStyleVars() {
    const gs = getComputedStyle(root);
    const get = (v) => gs.getPropertyValue(v).trim();
    return {
      "--fw-bg": get("--fw-bg"),
      "--fw-text": get("--fw-text"),
      "--fw-card": get("--fw-card"),
      "--fw-border": get("--fw-border"),
      "--fw-primary": get("--fw-primary"),
      "--fw-secondary": get("--fw-secondary"),
      "--fw-success": get("--fw-success"),
      "--fw-danger": get("--fw-danger"),
      "--fw-radius": get("--fw-radius"),
      "--fw-pad": get("--fw-pad"),
      "--fw-opacity": get("--fw-opacity"),
      "--fw-maxw": get("--fw-maxw"),
      "--fw-cats-h": get("--fw-cats-h"),
      "--fw-shadow": get("--fw-shadow"),
    };
  }

  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 3) РОБОТА З МЕТАДАНИМИ ТАБЛИЦІ                                         │
  // ╰────────────────────────────────────────────────────────────────────────╯
 async function fetchFinanceMeta() {
  const base = (window.SHEETS_WEBAPP_URL || '').trim();
  console.log('[FW][meta] SHEETS_WEBAPP_URL =', base);
  if (!base) {
    throw new Error('SHEETS_WEBAPP_URL is empty (не підставився URL вебапки GAS)');
  }

  const url = base + (base.includes('?') ? '&' : '?') + 'mode=finance_meta&ts=' + Date.now();
  console.log('[FW][meta] GET:', url);

  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    throw new Error('fetch failed: ' + e.message);
  }

  const ct = res.headers.get('content-type') || '';
  const raw = await res.text();
  console.log('[FW][meta] HTTP', res.status, 'CT=', ct, 'RAW(200ch)=', raw.slice(0, 200));

  if (!res.ok) {
    throw new Error('HTTP ' + res.status + ' ' + raw.slice(0, 120));
  }
  if (!ct.includes('application/json')) {
    throw new Error('Not JSON from GAS: ' + raw.slice(0, 120));
  }

  let j;
  try { j = JSON.parse(raw); } catch (e) {
    throw new Error('JSON parse error: ' + e.message);
  }
  if (!j.success) {
    throw new Error(j.error || 'meta failed');
  }
  console.log('[FW][meta] items=', Array.isArray(j.items) ? j.items.length : 0);
  return j;
}

  function buildCategoriesFromMeta(metaItems) {
    const byCat = { income: [], expense: [], debt: [] };
    const mapMode = (catName) => {
      const s = String(catName || '').toLowerCase();
      if (s.includes('дох')) return 'income';
      if (s.includes('розх')) return 'expense';
      if (s.includes('борг')) return 'debt';
      return 'other';
    };
    for (const it of metaItems) {
      const mode = mapMode(it.category);
      if (mode === 'other') continue;
      if (it.isTech) continue;
      byCat[mode].push({
        key: it.key,
        label: it.key,
        col: it.col, a1: it.a1,
        category: it.category, subcategory: it.subcategory,
      });
    }
    return byCat;
  }

  function pickTech(metaItems, modeName) {
  const res = { commentKey: null, commentCol: null, selectKey: null, selectCol: null, selectOptions: [] };
  const inCat = metaItems.filter(it => {
    const s = String(it.category || '').toLowerCase();
    if (modeName === 'income')  return s.includes('дох');
    if (modeName === 'expense') return s.includes('розх');
    if (modeName === 'debt')    return s.includes('борг');
    return false;
  });
  for (const it of inCat) {
    if (!it.isTech) continue;
    if (it.techType === 'comment' && !res.commentKey) {
      res.commentKey = it.key;
      res.commentCol = it.col;       // ← збережемо точний номер колонки
    }
    if (it.techType === 'options' && !res.selectKey) {
      res.selectKey = it.key;
      res.selectCol = it.col;        // ← і це теж
      res.selectOptions = it.options || [];
    }
  }
  return res;
}

// ...в onSubmit, перед fetch:
const payload = {
  sheet: "Дохід розхід",
  mode: state.mode,
  key: state.selectedCategory.key,
  label: state.selectedCategory.label,
  amount,
  // коментар:
  commentKey: state.tech.commentKey || null,
  commentCol: state.tech.commentCol || null,      // ← ДОДАЛИ
  comment: String(commentInput.value || "").trim(),
  // селект:
  selectKey: state.tech.selectKey || null,
  selectCol: state.tech.selectCol || null,        // ← ДОДАЛИ
  selectValue: (state.tech.selectKey && selectEl) ? selectEl.value : null,
  pp: Number(autoPP.textContent),
  date_local: autoDate.textContent,
  ts: Date.now(),
  SHEETS_WEBAPP_URL: (window.SHEETS_WEBAPP_URL || "").trim()
};


  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 4) ІНІЦІАЛІЗАЦІЯ UI                                                    │
  // ╰────────────────────────────────────────────────────────────────────────╯
  async function init() {
    // 4.1) Метадані
    try {
      const meta = await fetchFinanceMeta();
      META = meta.items || [];
      if (!META.length) throw new Error('empty items');

      CATS = buildCategoriesFromMeta(META);
      TECH = {
        income:  pickTech(META, 'income'),
        expense: pickTech(META, 'expense'),
        debt:    pickTech(META, 'debt'),
      };
    console.log('[FW][meta] items=%d', META.length, META);



    } catch (e) {
      console.error('[FW] Не вдалося завантажити метадані:', e?.message || e);
      if (catList) {
        catList.innerHTML = '<div class="fw-muted" style="padding:12px">Немає з’єднання з GAS (finance_meta). Перевір SHEETS_WEBAPP_URL або Apps Script.</div>';
      }
      return;
    }

    // 4.2) Автополя
    autoPP.textContent   = getNextPP();
    autoDate.textContent = fmtDate();

    // 4.3) Початковий режим
    switchMode('income');

    updateSubmitDisabled();


    // 4.4) Слухачі
    modeBtns.forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));
    catSearch.addEventListener("input", renderCategories);

    analyticsBtn?.addEventListener("click", toggleAnalytics);
    settingsBtn?.addEventListener("click", openSettings);
    settingsClose?.addEventListener("click", closeSettings);
    settingsCancel?.addEventListener("click", closeSettings);
    settingsApply?.addEventListener("click", applySettings);

    bindLiveThemeControls();

    loadPresetList();
    const last = localStorage.getItem(LS_KEYS.lastPreset);
    if (last) { presetSelect.value = last; applyPresetByName(last); }

    presetSave?.addEventListener("click", () => savePresetCurrent(presetSelect?.value || "default"));
    presetSaveAs?.addEventListener("click", savePresetAs);
    presetDelete?.addEventListener("click", deletePreset);
    presetReset?.addEventListener("click", resetToDefault);
    presetSelect?.addEventListener("change", () => applyPresetByName(presetSelect.value));

    form.addEventListener("submit", onSubmit);
    form.addEventListener("reset",  onReset);

    titleText?.addEventListener("input", () => (headerTitle.textContent = titleText.value || "Дохід / Розхід"));
    showLogo?.addEventListener("change", () => (logoEl.style.display = showLogo.checked ? "" : "none"));
  }

  function switchMode(mode) {
    if (!["income", "expense", "debt"].includes(mode)) return;
    state.mode = mode;

    state.categories = CATS[mode] || [];
    const t = TECH[mode] || {};
    state.tech = {
      commentKey:   t.commentKey   || null,
      selectKey:    t.selectKey    || null,
      selectOptions: t.selectOptions || []
    };

    console.log('[FW][mode] %s: categories=%d, tech=%o', mode, state.categories.length, state.tech);



    // технічний селект
    if (selectWrap && selectEl && selectLabel) {
      if (state.tech.selectKey && state.tech.selectOptions.length) {
        selectWrap.hidden = false;
        selectLabel.textContent = state.tech.selectKey;
        selectEl.innerHTML = '';
        for (const opt of state.tech.selectOptions) {
          const o = document.createElement('option');
          o.value = o.textContent = opt;
          selectEl.appendChild(o);
        }
      } else {
        selectWrap.hidden = true;
        selectLabel.textContent = '';
        selectEl.innerHTML = '';
      }
    }

    state.selectedCategory = null;
    activeCatName.textContent = "—";

    modeBtns.forEach((b) => {
      const is = b.dataset.mode === mode;
      b.classList.toggle("is-active", is);
      b.setAttribute("aria-pressed", String(is));
    });

    renderCategories();
    showToast(mode === "income" ? "Режим: Дохід" : mode === "expense" ? "Режим: Розхід" : "Режим: Борг");

    updateSubmitDisabled();                     // ← див. п.3
  }

  function renderCategories() {
    const q = (catSearch.value || "").toLowerCase().trim();
    catList.innerHTML = "";
    const frag = document.createDocumentFragment();

    state.categories
      .filter((c) => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q))
      .forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fw-cat";
        btn.textContent = c.label;
        btn.dataset.key = c.key;
        btn.addEventListener("click", () => {
          state.selectedCategory = c;
          activeCatName.textContent = c.label;
          amountInput.focus();
           updateSubmitDisabled();
        });
        frag.appendChild(btn);
      });

    if (!frag.childNodes.length) {
      const empty = document.createElement("div");
      empty.className = "fw-muted";
      empty.style.padding = "8px";
      empty.textContent = "Нічого не знайдено…";
      frag.appendChild(empty);
    }
    catList.appendChild(frag);
  }

  function toggleAnalytics() {
    const isHidden = analyticsSection?.hasAttribute("hidden");
    if (!analyticsSection || !analyticsBtn) return;
    if (isHidden) {
      analyticsSection.removeAttribute("hidden");
      analyticsBtn.setAttribute("aria-expanded", "true");
    } else {
      analyticsSection.setAttribute("hidden", "");
      analyticsBtn.setAttribute("aria-expanded", "false");
    }
  }

  function openSettings()  { settingsPanel?.removeAttribute("hidden"); settingsBtn?.setAttribute("aria-expanded", "true"); }
  function closeSettings() { settingsPanel?.setAttribute("hidden", ""); settingsBtn?.setAttribute("aria-expanded", "false"); }

  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 5) ВІДПРАВКА ЗАПИСУ                                                   │
  // ╰────────────────────────────────────────────────────────────────────────╯
async function onSubmit(e) {
  e.preventDefault();

  // Жорсткі логи стану
  console.log('[FW][submit] state =', JSON.stringify({
    mode: state.mode,
    selectedCategory: state.selectedCategory,
    tech: state.tech
  }, null, 2));

  // ❶ БЕЗПЕЧНО ДІСТАЄМО ОБРАНУ КАТЕГОРІЮ
  const sel = state && state.selectedCategory ? state.selectedCategory : null;
  const key = sel && sel.key ? String(sel.key) : null;
  const label = sel && sel.label ? String(sel.label) : null;

  if (!key) {                                     // ← головний гард!
    showToast('Оберіть категорію зліва.', 'error');
    console.warn('[FW][submit] abort: no selectedCategory.key');
    return;
  }

  const amount = Number(String(amountInput.value).replace(',', '.'));
  if (!amount || amount <= 0) {
    showToast('Вкажіть суму > 0.', 'error');
    return;
  }

  const pp = Number(autoPP.textContent) || getNextPP();

  const payload = {
    sheet: 'Дохід розхід',
    mode: state.mode,

    // використовуємо значення з гарда:
    key,
    label,

    amount,

    // технічні
    commentKey:  state?.tech?.commentKey || null,
    commentCol:  state?.tech?.commentCol || null,
    comment:     String(commentInput.value || '').trim(),
    selectKey:   state?.tech?.selectKey || null,
    selectCol:   state?.tech?.selectCol || null,
    selectValue: (state?.tech?.selectKey && selectEl) ? selectEl.value : null,

    pp,
    date_local: autoDate.textContent,
    ts: Date.now(),
    SHEETS_WEBAPP_URL: (window.SHEETS_WEBAPP_URL || '').trim(),
  };

  console.log('[FW][submit] payload =', payload);

  try {
    const res = await submitEntry(payload);
    console.log('[FW][submit] response =', res);

    if (!res?.success) throw new Error(res?.error || 'Помилка збереження');

    commitPP(pp);
    autoPP.textContent = getNextPP();
    autoDate.textContent = fmtDate();
    form.reset();
    activeCatName.textContent = '—';
    state.selectedCategory = null;
    updateSubmitDisabled();
    showToast('Запис збережено.', 'success');
  } catch (err) {
    console.error('[FW][submit] ERROR:', err);
    showToast('Не вдалося зберегти. Перевір FINANCE_API.', 'error');
  }
}



function onReset() { setTimeout(() => amountInput.blur(), 0); }

function updateSubmitDisabled() {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  const disabled = !state.selectedCategory;
  btn.disabled = disabled;
  btn.style.opacity = disabled ? 0.6 : 1;
  btn.style.cursor  = disabled ? 'not-allowed' : 'pointer';
}

  
async function submitEntry(data) {
  const url = (window.FINANCE_API || FINANCE_POST);
  const body = {
    ...data,
    SHEETS_WEBAPP_URL: (window.SHEETS_WEBAPP_URL || "").trim(),
  };

  console.log("[FINANCE][req] url=", url);
  console.log("[FINANCE][req] payload=", JSON.stringify(body));

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("[FINANCE] fetch failed:", e);
    throw new Error("fetch failed: " + (e?.message || e));
  }

  const ct = resp.headers.get("content-type") || "";
  const text = await resp.text();
  console.log("[FINANCE][resp] status=", resp.status, "ct=", ct);
  console.log("[FINANCE][resp] raw=", text);

  // Прагнемо розпарсити будь-що
  let json = null;
  try { json = JSON.parse(text); } catch { /* залишаємо null */ }

  // Нормалізація успіху
  const upstreamBody = json?.upstreamBody || json || {};
  const success =
    upstreamBody.success === true ||
    upstreamBody.ok === true ||
    upstreamBody.route === "finance_add";

  if (!resp.ok || !success) {
    const msg =
      upstreamBody.error ||
      upstreamBody.message ||
      (resp.ok ? "Backend returned success:false" : `HTTP ${resp.status}`);

    console.error("[FINANCE] NOT OK:", { status: resp.status, msg, upstreamBody });
    throw new Error(msg);
  }

  console.log("[FINANCE] OK:", upstreamBody);
  return { success: true, upstream: upstreamBody, raw: text, status: resp.status };
}



// ============================================================================


  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 6) НАЛАШТУВАННЯ / ПРЕСЕТИ (безпечні сетери/дефолти)                    │
  // ╰────────────────────────────────────────────────────────────────────────╯
  function bindLiveThemeControls() {
    const on = (el, ev, fn) => { if (el && el.addEventListener) el.addEventListener(ev, fn); };

    // Кольори
    on(cBg,        "input", () => setCSSVar("--fw-bg",        cBg.value        || "#0f172a"));
    on(cText,      "input", () => setCSSVar("--fw-text",      cText.value      || "#e5e7eb"));
    on(cPrimary,   "input", () => setCSSVar("--fw-primary",   cPrimary.value   || "#4f46e5"));
    on(cSecondary, "input", () => setCSSVar("--fw-secondary", cSecondary.value || "#0ea5e9"));
    on(cSuccess,   "input", () => setCSSVar("--fw-success",   cSuccess.value   || "#10b981"));
    on(cDanger,    "input", () => setCSSVar("--fw-danger",    cDanger.value    || "#ef4444"));

    // Геометрія/тіні
    on(rangeRadius,  "input", () => setCSSVar("--fw-radius",  (rangeRadius.value  ?? 16) + "px"));
    on(rangePad,     "input", () => setCSSVar("--fw-pad",     (rangePad.value     ?? 16) + "px"));
    on(rangeOpacity, "input", () => setCSSVar("--fw-opacity", (rangeOpacity.value ?? 0.96)));
    on(rangeShadow,  "input", () => {
      const v = Number(rangeShadow?.value ?? 12) || 12;
      setCSSVar("--fw-shadow", `0 ${Math.round(v/2)}px ${v + 8}px rgba(0,0,0,.35)`);
    });
    on(maxwInput, "input", () => {
      const v = Math.max(960, Number(maxwInput?.value ?? 1280) || 1280);
      setCSSVar("--fw-maxw", v + "px");
    });
    on(catsH, "input", () => {
      const v = Math.max(240, Number(catsH?.value ?? 520) || 520);
      setCSSVar("--fw-cats-h", v + "px");
    });
  }

  function loadPresetList() {
    if (!presetSelect) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_KEYS.presetList) || "[]"); } catch {}
    presetSelect.innerHTML = "";
    const optDefault = document.createElement("option");
    optDefault.value = "default";
    optDefault.textContent = "Default (вбудований)";
    presetSelect.appendChild(optDefault);
    for (const name of list) {
      const o = document.createElement("option");
      o.value = name; o.textContent = name;
      presetSelect.appendChild(o);
    }
  }

  function captureCurrentPreset() {
    const vars = readCurrentStyleVars?.() || {};
    return {
      title: headerTitle?.textContent || "Дохід / Розхід",
      showLogo: !!(showLogo?.checked ?? true),
      vars,
      values: {
        cBg: cBg?.value || "#0f172a",
        cText: cText?.value || "#e5e7eb",
        cPrimary: cPrimary?.value || "#4f46e5",
        cSecondary: cSecondary?.value || "#0ea5e9",
        cSuccess: cSuccess?.value || "#10b981",
        cDanger: cDanger?.value || "#ef4444",
        radius: Number(rangeRadius?.value ?? 16) || 16,
        pad: Number(rangePad?.value ?? 16) || 16,
        opacity: Number(rangeOpacity?.value ?? 0.96) || 0.96,
        shadow: Number(rangeShadow?.value ?? 12) || 12,
        maxw: Number(maxwInput?.value ?? 1280) || 1280,
        catsH: Number(catsH?.value ?? 520) || 520
      }
    };
  }

  function applyPreset(p) {
    if (!p) return;
    const v = p.values || {};
    Object.entries(p.vars || {}).forEach(([k, val]) => setCSSVar(k, String(val)));

    if (cBg)        cBg.value        = v.cBg        ?? "#0f172a";
    if (cText)      cText.value      = v.cText      ?? "#e5e7eb";
    if (cPrimary)   cPrimary.value   = v.cPrimary   ?? "#4f46e5";
    if (cSecondary) cSecondary.value = v.cSecondary ?? "#0ea5e9";
    if (cSuccess)   cSuccess.value   = v.cSuccess   ?? "#10b981";
    if (cDanger)    cDanger.value    = v.cDanger    ?? "#ef4444";

    if (rangeRadius)  rangeRadius.value  = v.radius  ?? 16;
    if (rangePad)     rangePad.value     = v.pad     ?? 16;
    if (rangeOpacity) rangeOpacity.value = v.opacity ?? 0.96;
    if (rangeShadow)  rangeShadow.value  = v.shadow  ?? 12;
    if (maxwInput)    maxwInput.value    = v.maxw    ?? 1280;
    if (catsH)        catsH.value        = v.catsH   ?? 520;

    const title = p.title || "Дохід / Розхід";
    if (headerTitle) headerTitle.textContent = title;
    if (titleText)   titleText.value = title;
    if (logoEl)      logoEl.style.display = (p.showLogo ?? true) ? "" : "none";
  }

  function applyPresetByName(name) {
    if (name === "default") { resetToDefault(true); return; }
    let data = null;
    try { data = JSON.parse(localStorage.getItem("fw_preset_" + name) || "null"); } catch {}
    if (data) {
      applyPreset(data);
      localStorage.setItem(LS_KEYS.lastPreset, name);
      showToast(`Застосовано шаблон: ${name}`);
    } else {
      showToast("Шаблон не знайдено", "error");
    }
  }

  function savePresetCurrent(name) {
    if (!name || name === "default") name = "Мій шаблон";
    const p = captureCurrentPreset();
    try { localStorage.setItem("fw_preset_" + name, JSON.stringify(p)); } catch {}
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_KEYS.presetList) || "[]"); } catch {}
    const set = new Set(list); set.add(name);
    try {
      localStorage.setItem(LS_KEYS.presetList, JSON.stringify(Array.from(set)));
      loadPresetList();
      if (presetSelect) presetSelect.value = name;
      localStorage.setItem(LS_KEYS.lastPreset, name);
    } catch {}
    showToast(`Збережено як шаблон: ${name}`, "success");
  }

  function savePresetAs() {
    const name = prompt("Назва нового шаблону:", "Preset " + new Date().toLocaleString());
    if (!name) return;
    savePresetCurrent(name);
  }

  function deletePreset() {
    const name = presetSelect?.value;
    if (!name || name === "default") { showToast("Неможливо видалити дефолтний шаблон.", "error"); return; }
    try { localStorage.removeItem("fw_preset_" + name); } catch {}
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_KEYS.presetList) || "[]"); } catch {}
    const set = new Set(list); set.delete(name);
    try { localStorage.setItem(LS_KEYS.presetList, JSON.stringify(Array.from(set))); } catch {}
    loadPresetList();
    if (presetSelect) presetSelect.value = "default";
    resetToDefault(true);
    showToast(`Шаблон видалено: ${name}`, "success");
  }

  function resetToDefault(silent = false) {
    setCSSVar("--fw-bg",        "#0f172a");
    setCSSVar("--fw-text",      "#e5e7eb");
    setCSSVar("--fw-primary",   "#4f46e5");
    setCSSVar("--fw-secondary", "#0ea5e9");
    setCSSVar("--fw-success",   "#10b981");
    setCSSVar("--fw-danger",    "#ef4444");
    setCSSVar("--fw-radius",    "16px");
    setCSSVar("--fw-pad",       "16px");
    setCSSVar("--fw-opacity",   "0.96");
    setCSSVar("--fw-maxw",      "1280px");
    setCSSVar("--fw-cats-h",    "520px");
    setCSSVar("--fw-shadow",    "0 10px 30px rgba(0,0,0,.35)");

    if (cBg)        cBg.value        = "#0f172a";
    if (cText)      cText.value      = "#e5e7eb";
    if (cPrimary)   cPrimary.value   = "#4f46e5";
    if (cSecondary) cSecondary.value = "#0ea5e9";
    if (cSuccess)   cSuccess.value   = "#10b981";
    if (cDanger)    cDanger.value    = "#ef4444";
    if (rangeRadius)  rangeRadius.value  = 16;
    if (rangePad)     rangePad.value     = 16;
    if (rangeOpacity) rangeOpacity.value = 0.96;
    if (rangeShadow)  rangeShadow.value  = 12;
    if (maxwInput)    maxwInput.value    = 1280;
    if (catsH)        catsH.value        = 520;

    if (headerTitle)  headerTitle.textContent = "Дохід / Розхід";
    if (titleText)    titleText.value         = "Дохід / Розхід";
    if (logoEl)       logoEl.style.display    = "";

    if (!silent) showToast("Скинуто до значень за замовчуванням");
  }

  function applySettings() {
    savePresetCurrent(presetSelect?.value || "default");
    closeSettings?.();
  }

  // ╭────────────────────────────────────────────────────────────────────────╮
  // │ 7) СТАРТ                                                               │
  // ╰────────────────────────────────────────────────────────────────────────╯
  init();
})();
