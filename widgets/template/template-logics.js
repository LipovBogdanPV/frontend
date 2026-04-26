// frontend/widgets/template/template-logics.js
// Меню вставки логічних конструкцій у редактор шаблонів
// Експортує mountLogicSnippets(host=document)

(function(){
  // ─────────────────────────────────────────────────────────────
  // 1) Набір готових вставок (українські описи + приклади)
  // ─────────────────────────────────────────────────────────────
  const SNIPPETS = [
    {
      group: 'IF / ELSE',
      items: [
        {
          label: 'IF (не порожнє)',
          desc:  'Показати блок, якщо значення існує і не порожнє.',
          code: `{{#if {{key}}}}
Текст, якщо {{key}} заповнений
{{/if}}`,
          demo: `Напр.: показати {{phone}}, лише якщо він є.`
        },
        {
          label: 'IF == (дорівнює)',
          desc:  'Вивести блок, якщо значення дорівнює константі.',
          code: `{{#ifEq {{key}} "значення"}}
Текст для рівності
{{/ifEq}}`,
          demo: `Напр.: якщо payment == "наложка".`
        },
        {
          label: 'IF != (НЕ дорівнює)',
          desc:  'Вивести блок, якщо значення НЕ дорівнює константі.',
          code: `{{#ifNe {{key}} "значення"}}
Текст для НЕ рівності
{{/ifNe}}`,
          demo: `Напр.: якщо city != "Київ".`
        },
        {
          label: 'IF > (більше)',
          desc:  'Показати, якщо число більше порогу.',
          code: `{{#ifGt {{key}} 0}}
Текст, якщо {{key}} > 0
{{/ifGt}}`,
          demo: `Напр.: якщо prepaid > 0.`
        },
        {
          label: 'IF < (менше)',
          desc:  'Показати, якщо число менше порогу.',
          code: `{{#ifLt {{key}} 10}}
Текст, якщо {{key}} < 10
{{/ifLt}}`,
          demo: `Напр.: якщо itemsCount < 10.`
        },
        {
          label: 'IF ≥ / ≤ (границі включно)',
          desc:  'Перевірка з включенням меж (>= або <=).',
          code: `{{#ifGte {{key}} 100}}
Тут для >= 100
{{/ifGte}}

{{#ifLte {{key}} 5}}
Тут для <= 5
{{/ifLte}}`,
          demo: `Напр.: якщо знижка ≥ 100 або ≤ 5.`
        },
        {
          label: 'IF … ELSE',
          desc:  'Гілка ІСТИНА / ІНАКШЕ.',
          code: `{{#if {{key}}}}
Так...
{{else}}
Інакше...
{{/if}}`,
          demo: `Класична конструкція.`
        },
      ]
    },
    {
      group: 'Логіка (AND / OR / NOT)',
      items: [
        {
          label: 'AND (І)',
          desc:  'Обидві умови мають бути істинними.',
          code: `{{#and {{a}} {{b}}}}
Текст якщо (a І b)
{{/and}}`,
          demo: `Напр.: payment == "наложка" І region == "Київська".`
        },
        {
          label: 'OR (АБО)',
          desc:  'Достатньо, щоб будь-яка умова була істинною.',
          code: `{{#or {{a}} {{b}}}}
Текст якщо (a АБО b)
{{/or}}`,
          demo: `Напр.: city == "Львів" АБО "Дніпро".`
        },
        {
          label: 'NOT (НЕ)',
          desc:  'Заперечення умови.',
          code: `{{#not {{key}}}}
Текст якщо умова хибна
{{/not}}`,
          demo: `Напр.: якщо немає ttn — показати "Очікуйте ТТН".`
        },
      ]
    },
    {
      group: 'Перебір / Вибір',
      items: [
        {
          label: 'EACH (список)',
          desc:  'Пройти по масиву і вивести елементи.',
          code: `{{#each {{list}}}}
• {{this}}
{{/each}}`,
          demo: `Напр.: вивести itemsList построково.`
        },
        {
          label: 'SWITCH / CASE',
          desc:  'Вибір гілки за значенням.',
          code: `{{#switch {{key}}}}
{{#case "A"}}Варіант A{{/case}}
{{#case "B"}}Варіант B{{/case}}
{{#default}}Інше{{/default}}
{{/switch}}`,
          demo: `Напр.: різні тексти для marketplace.`
        },
      ]
    },
    {
      group: 'Форматування',
      items: [
        {
          label: 'UPPERCASE',
          desc:  'Рядок у ВЕРХНЬОМУ регістрі.',
          code: `{{upper {{key}}}}`,
          demo: `Напр.: прізвище великими літерами.`
        },
        {
          label: 'lowercase',
          desc:  'Рядок у нижньому регістрі.',
          code: `{{lower {{key}}}}`,
          demo: `Напр.: email у нижньому регістрі.`
        },
        {
          label: 'trim()',
          desc:  'Зрізати пробіли з початку/кінця.',
          code: `{{trim {{key}}}}`,
          demo: `Корисно для "чистих" значень.`
        },
        {
          label: 'Дата (uk-UA)',
          desc:  'Форматувати дату локалізовано.',
          code: `{{date {{key}} "uk-UA"}}`,
          demo: `Напр.: createdAt → 31.08.2025, 11:05.`
        },
      ]
    }
  ];

  // ─────────────────────────────────────────────────────────────
  // 2) CSS меню
  // ─────────────────────────────────────────────────────────────
  function ensureCss() {
    if (document.getElementById('tpl-logic-css')) return;
    const s = document.createElement('style');
    s.id = 'tpl-logic-css';
    s.textContent = `
      .logic-menu-wrap{ position:relative; display:inline-block; margin-left:.5rem; }
      .logic-menu{ position:absolute; top:100%; right:0; z-index:9999;
        width:min(760px,96vw); max-height:70vh; overflow:auto;
        background:#111827; color:#e5e7eb; border:1px solid #374151; border-radius:12px;
        box-shadow:0 10px 30px rgba(0,0,0,.35); padding:10px; }
      .logic-row{ display:flex; gap:12px; align-items:flex-start; }
      .logic-list{ flex:0 0 320px; max-height:64vh; overflow:auto; }
      .logic-help{ flex:1 1 auto; min-height:200px; background:#0b1020; border:1px solid #253053; border-radius:10px; padding:10px; }
      .logic-title{ font-size:12px; opacity:.8; padding:6px 8px 2px; }
      .logic-item{ display:block; width:100%; text-align:left;
        padding:8px 10px; border-radius:8px; border:1px solid transparent;
        background:transparent; color:inherit; cursor:pointer; }
      .logic-item:hover{ background:#1f2937; border-color:#374151; }
      .logic-desc{ font-size:12px; opacity:.8; margin-top:2px; }
      .logic-pre{ white-space:pre; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        background:#0b0f16; border:1px solid #233; border-radius:8px; padding:8px; margin-top:8px; }
      .logic-hidden{ display:none; }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────────
  // 3) Пошук textarea редактора
  // ─────────────────────────────────────────────────────────────
  function findEditor(root=document){
    return root.querySelector('#tpl-editor') ||
           root.querySelector('#tpl-text')   ||
           root.querySelector('textarea');
  }
  function insertAtCursor(textarea, text) {
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? textarea.value.length;
    textarea.value = textarea.value.slice(0,start) + text + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', {bubbles:true}));
  }

  // ─────────────────────────────────────────────────────────────
  // 4) Побудова меню
  // ─────────────────────────────────────────────────────────────
  function buildMenu(host, editor) {
    ensureCss();

    const wrap = document.createElement('div');
    wrap.className = 'logic-menu-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-secondary btn-sm';
    btn.id = 'logic-btn';
    btn.textContent = 'Вставити {{логіку}}';

    const menu = document.createElement('div');
    menu.className = 'logic-menu logic-hidden';

    const row  = document.createElement('div');
    row.className = 'logic-row';

    const list = document.createElement('div');
    list.className = 'logic-list';

    const help = document.createElement('div');
    help.className = 'logic-help';
    help.innerHTML = `<div style="opacity:.8">Виберіть елемент ліворуч — праворуч з’явиться опис і приклад. Клік по пункту вставляє код у шаблон.</div>`;

    // наповнюємо список
    SNIPPETS.forEach(group => {
      const title = document.createElement('div');
      title.className = 'logic-title';
      title.textContent = group.group;
      list.appendChild(title);

      group.items.forEach(it => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'logic-item';
        b.innerHTML = `<div>${it.label}</div><div class="logic-desc">${it.desc}</div>`;

        const showHelp = () => {
          help.innerHTML = `
            <div><b>${it.label}</b></div>
            <div class="logic-desc">${it.desc}</div>
            <div class="logic-pre">${escapeHtml(it.code)}</div>
            <div class="logic-desc" style="margin-top:6px">${it.demo || ''}</div>`;
        };
        b.addEventListener('mouseenter', showHelp);
        b.addEventListener('focus', showHelp);

        b.addEventListener('click', () => {
          const code = (it.code || '').replaceAll('{{key}}','{{key}}'); // залишаємо плейсхолдер
          insertAtCursor(editor, code);
          menu.classList.add('logic-hidden');
        });

        list.appendChild(b);
      });
    });

    row.appendChild(list);
    row.appendChild(help);
    menu.appendChild(row);
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    host.appendChild(wrap);

    btn.addEventListener('click', () => menu.classList.toggle('logic-hidden'));
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) menu.classList.add('logic-hidden');
    });
  }

  function escapeHtml(s=''){
    return String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;');
  }

  // ─────────────────────────────────────────────────────────────
  // 5) Публічна функція
  // ─────────────────────────────────────────────────────────────
  function mountLogicSnippets(host=document) {
    const editor = findEditor(host) || findEditor(document);
    if (!editor) { console.warn('[logic] textarea не знайдено'); return; }

    // Куди кріпити — поруч із селектором «Вставити {{ключ}}»
    const slot =
      host.querySelector('#logic-tools-slot') ||
      host.querySelector('#tpl-insert-key')?.parentElement ||
      host.querySelector('#tpl-toolbar') ||
      host;

    if (slot.querySelector('#logic-btn')) return; // вже змонтовано
    buildMenu(slot, editor);
  }



// робимо доступним глобально
window.mountLogicSnippets = mountLogicSnippets;
window.__tplLogicMounted = true;
})();
