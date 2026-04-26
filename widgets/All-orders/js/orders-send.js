// js/orders-send.js

// --- guard від повторного підключення файлу ---
if (window.__ORDERS_SEND_LOADED__) {
  console.debug('[orders-send] already loaded — skip redefinition');
} else {
  window.__ORDERS_SEND_LOADED__ = true;

  (function () {

    // ========= CONFIG =========
    const DEFAULT_TG_CHAT_ID = String(window.DEFAULT_TG_CHAT_ID ?? ''); // chat_id групи за замовчуванням
    const STATUS_AFTER_SEND   = 'Виготовляється';                        // що ставити після відправки
    const STATUS_URL          = '/api/orders/set-status';                // робочий ендпоінт статусів

    // ========= HELPERS =========
    const $  = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

    function getTemplates() {
      try { return JSON.parse(localStorage.getItem('stTemplates') || '[]'); }
      catch { return []; }
    }
    function compile(tpl, data) {
      return (tpl || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
        const v = data?.[k];
        return (v == null) ? '' : String(v);
      });
    }
    function sendViaShare(text) {
      const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }

    // просте локальне оновлення бейджа статусу в DOM (опц.)
    function updateOrderStatus(orderId, newStatus) {
      const row =
        document.querySelector(`.order-row[data-order-group="${orderId}"]`) ||
        document.querySelector(`.order-row[data-order-id="${orderId}"]`) ||
        document.querySelector(`[data-order-group="${orderId}"]`) ||
        document.querySelector(`[data-order-id="${orderId}"]`);
      if (!row) return;
      setRowStatus(row, newStatus);
    }

    // ========= CSS модалки =========
    function injectSendModalCss() {
      if (document.getElementById('send-modal-css')) return;
      const s = document.createElement('style');
      s.id = 'send-modal-css';
      s.textContent = `
        #send-tpl-modal .backdrop { position:absolute; inset:0; background:rgba(0,0,0,.5); }
        #send-tpl-modal .send-box{
          position:absolute; left:50%; top:50%; transform: translate(-50%,-50%);
          width: min(900px, 95vw); max-height: 90vh;
          background: #0b0b0f; color: #e5e7eb;
          border:1px solid #27272a; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35);
          padding: 16px; display:flex; flex-direction:column; gap:12px;
          resize: both; overflow: auto; min-width: 560px; min-height: 360px;
        }
        #send-tpl-modal .send-box.is-full{
          position:fixed; inset:0; transform:none; left:0; top:0;
          width:100vw; height:100vh; max-width:100vw; max-height:100vh; border-radius:0;
        }
        #send-tpl-modal .send-box textarea{ flex:1 1 auto; min-height: 280px; resize: vertical; }
        #send-tpl-modal .icon-btn{
          height:36px; padding:0 10px; border:1px solid #27272a; border-radius:10px; background:rgba(24,24,27,.6);
        }
        #send-tpl-modal .foot-extra{ display:flex; gap:8px; align-items:center; margin-top:8px; }
      `;
      document.head.appendChild(s);
    }

    // ========= Рендер модалки =========
    function ensureModal() {
      injectSendModalCss();
      let root = document.getElementById('send-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'send-modal-root';
        document.body.appendChild(root);
      }
      let modal = root.querySelector('#send-tpl-modal');
      if (modal) return modal;

      root.insertAdjacentHTML('beforeend', `
        <div id="send-tpl-modal" class="fixed inset-0 hidden z-[1000]">
          <div class="backdrop"></div>
          <div class="send-box">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold">Надіслати повідомлення</h3>
              <div class="ml-auto flex items-center gap-2">
                <select id="send-tpl-select" class="h-9 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 text-sm"></select>
                <button id="send-tpl-max"   class="icon-btn" title="На весь екран">⤢</button>
                <button id="send-tpl-close" class="icon-btn" title="Закрити">✕</button>
              </div>
            </div>

            <div class="text-xs text-zinc-400 -mt-1">
              Одержувач: <span id="send-dest" class="font-medium text-zinc-200"></span>
            </div>

            <textarea id="send-tpl-preview"
              class="w-full border border-zinc-800 rounded-lg bg-zinc-900/60 p-2 font-mono text-sm whitespace-pre"></textarea>

            <div class="flex items-center justify-between gap-2">
              <div class="text-xs text-zinc-400">Після відправки статус стане “${STATUS_AFTER_SEND}”.</div>
              <div class="flex items-center gap-2">
                <button id="send-tpl-share"
                        class="h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-900/60">Відкрити в Telegram</button>
                <button id="send-tpl-send"
                        class="h-9 px-3 rounded-lg bg-emerald-600 text-white">Надіслати ботом</button>
              </div>
            </div>

            <div class="foot-extra"></div>
          </div>
        </div>
      `);

      modal = root.querySelector('#send-tpl-modal');

      const box   = modal.querySelector('.send-box');
      const btnFS = modal.querySelector('#send-tpl-max');
      const btnX  = modal.querySelector('#send-tpl-close');

      btnFS.addEventListener('click', () => {
        box.classList.toggle('is-full');
        btnFS.textContent = box.classList.contains('is-full') ? '❐' : '⤢';
      });

      // backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal.querySelector('.backdrop')) modal.classList.add('hidden');
      });
      btnX.addEventListener('click', () => modal.classList.add('hidden'));

      return modal;
    }

    // ========= Normalizers =========
    function normalizeForTemplate(ds) {
      const val = (...keys) => {
        for (const k of keys) {
          const v = ds?.[k];
          if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
      };
      const last   = val('clientSurname','recipient_last','surname','lastName','client_last','lastname');
      const first  = val('clientFirstname','recipient_first','name','firstName','client_first','firstname');
      const middle = val('recipient_middle','patronymic','middleName');

      const clientNameGuess =
        val('clientName','recipientFull','recipient','recipientName') ||
        [last, first, middle].filter(Boolean).join(' ').trim();

      const createdRaw = val('createdAt','created_at','date');
      let createdAt = createdRaw;
      try {
        const d = new Date(createdRaw);
        if (!Number.isNaN(+d)) {
          createdAt = d.toLocaleString('uk-UA', {
            year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
          });
        }
      } catch {}

      const idManager = val('idManager','id_manager','ID_ZM','id_zm');

      return {
        ...ds,
        idManager,
        clientName: clientNameGuess,
        clientSurname: last,
        clientFirstname: first,
        phone: val('phone','tel','number'),
        email: val('email'),
        region: val('region'),
        district: val('district'),
        city: val('city'),
        street: val('street'),
        npWarehouse: val('npWarehouse','warehouse','warehouseNumber'),
        warehouseType: val('warehouseType'),
        ttn: val('ttn'),
        status: val('status','shipStatus'),
        payment: val('payment','post'),
        marketplace: val('marketplace'),
        priceClient:  val('priceClient'),
        forClient:    val('forClient'),
        itemsList:    val('itemsList','items','items_list'),
        note:         val('note','comment'),
        createdAt
      };
    }
    window.normalizeForTemplate = normalizeForTemplate;

    function buildDataset(tplData = {}, rowEl, orderData = {}) {
      const row = (rowEl && rowEl.dataset) || {};
      const pick = (...names) => {
        for (const n of names) {
          const key = String(n || '');
          const v =
            tplData[key] ?? tplData[key.toLowerCase?.()] ??
            orderData[key] ?? orderData[key.toLowerCase?.()] ??
            row[key] ?? row[key.toLowerCase?.()];
          if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
      };

      // ПІБ
      let clientSurname     = pick('clientSurname','recipient_last','surname','lastName','lastname');
      let clientFirstname   = pick('clientFirstname','recipient_first','name','firstName','firstname');
      let clientPatronymic  = pick('clientPatronymic','recipient_middle','patronymic','middleName','middlename');
      let clientFullName    = pick('clientFullName','clientName','recipient_full');

      if ((!clientSurname || !clientFirstname || !clientPatronymic) && clientFullName) {
        const parts = clientFullName.replace(/\s+/g,' ').trim().split(' ');
        if (!clientSurname   && parts.length >= 1) clientSurname    = parts[0];
        if (!clientFirstname && parts.length >= 2) clientFirstname  = parts[1];
        if (!clientPatronymic && parts.length >= 3) clientPatronymic = parts.slice(2).join(' ');
      }
      if (!clientFullName) {
        clientFullName = [clientSurname, clientFirstname, clientPatronymic].filter(Boolean).join(' ').trim();
      }

      const valDiscount  = pick('discount','znizhka','znyzhka','saleDiscount');                // AE
      const valSalePrice = pick('salePrice','sale_price','priceSale','sellPrice','sale','prodazhu'); // AJ
      const valForClient = pick('forClient','forclient','priceClient','clientPrice');          // AK

      const ds = {
        // ідентифікатори
        orderId:        pick('orderId','order_group','og','id'),
        order_group:    pick('order_group','orderGroup','og'),
        idManager:      pick('idManager','id_manager','ID_ZM','id_zm'),

        // клієнт
        clientSurname,
        clientFirstname,
        clientPatronymic,
        clientFullName,
        clientName:     clientFullName || pick('clientName','recipient','recipientName','recipient_full'),
        phone:          pick('phone','tel','number'),
        email:          pick('email'),

        // адреса / НП
        country:        pick('country'),
        region:         pick('region'),
        district:       pick('district'),
        city:           pick('city'),
        street:         pick('street'),
        npWarehouse:    pick('npWarehouse','npwarehouse','warehouse'),
        warehouseNumber:pick('warehouseNumber','warehousenumber'),
        warehouseType:  pick('warehouseType','warehousetype'),
        deliveryType:   pick('deliveryType','post'),

        // логістика
        ttn:            pick('ttn'),
        status:         pick('status','shipStatus'),
        payment:        pick('payment','post'),

        // фінанси / контент
        discount:       valDiscount,
        salePrice:      valSalePrice,
        forClient:      valForClient,
        priceClient:    valForClient, // alias

        drop:           pick('drop','totalPurchaseSum'),
        marketplace:    pick('marketplace'),
        itemsList:      pick('itemsList','itemslist','items','items_list'),
        description:    pick('description'),

        // нотатки
        note:           pick('note','comment'),
        comment:        pick('comment','note'),
        manager:        pick('manager'),
        createdAt:      pick('createdAt','date','created_at')
      };

      // alias'и під старі шаблони
      ds.sale             = ds.discount;
      ds.npwarehouse     = ds.npWarehouse;
      ds.priceclient     = ds.priceClient;
      ds.forclient       = ds.forClient;
      ds.saleprice       = ds.salePrice;
      ds.warehousenumber = ds.warehouseNumber;
      ds.warehousetype   = ds.warehouseType;
      ds.clientlastname   = ds.clientSurname;
      ds.clientfirstname  = ds.clientFirstname;
      ds.clientpatronymic = ds.clientPatronymic;

      console.log('[buildDataset] final:', ds);
      return ds;
    }
    window.buildDataset = buildDataset;

    // ========= API wrappers (Telegram) =========
    window.sendViaBot ??= async function sendViaBot({ chatId, text, messageThreadId }) {
      const payload = { text };
      if (chatId) payload.chatId = chatId;
      if (messageThreadId) payload.messageThreadId = messageThreadId;

      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await res.clone().json(); }
      catch { data = { success:false, error: await res.text() }; }

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // { success:true, messageId, chatId }
      return data;
    };

    window.editViaBot ??= async function editViaBot({ chatId, messageId, text, parseMode }) {
      const payload = { chatId, messageId: Number(messageId), text };
      if (parseMode) payload.parseMode = parseMode;

      const res = await fetch('/api/telegram/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await res.clone().json(); }
      catch { data = { success:false, error: await res.text() }; }

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      return data; // { success:true }
    };

    // ========= Backend: статус у таблиці (опц.) =========
    async function persistStatusToSheet(order_group, status) {
      order_group = String(order_group ?? '').trim();
      status      = String(status ?? '').trim();
      if (!order_group || !status) throw new Error('order_group/status required');

      const r = await fetch(STATUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_group, status })
      });

      let j = null, raw = '';
      try { j = await r.clone().json(); } catch { raw = await r.text(); }

      console.log('[set-status] payload:', { order_group, status });
      console.log('[set-status] response:', r.status, j || raw);

      if (!r.ok || j?.success === false) throw new Error(j?.error || raw || 'set-status failed');
      return true;
    }

    // ========= OPEN MODAL =========
    async function openSendModal({ rowEl, orderData }) {
      const modal = ensureModal();
      if (!modal) return;

      // збережемо OG у модалку для додаткового джерела
      const guessOg =
        rowEl?.dataset?.order_group || rowEl?.dataset?.og ||
        orderData?.order_group     || orderData?.og      || '';
      modal.dataset.og = guessOg;
      modal._row = rowEl;

      // ЕЛЕМЕНТИ
      const select      = modal.querySelector('#send-tpl-select');
      const editor      = modal.querySelector('#send-tpl-preview');
      const closeBtn    = modal.querySelector('#send-tpl-close');
      const shareBtn    = modal.querySelector('#send-tpl-share');
      const sendBtn     = modal.querySelector('#send-tpl-send');
      const destEl      = modal.querySelector('#send-dest');
      const footExtra   = modal.querySelector('.foot-extra');

      // ДАНІ
      const base   = { ...(rowEl?.dataset || {}), ...(orderData || {}) };
      const rawTpl = normalizeForTemplate(base);
      const build  = () => buildDataset(rawTpl, rowEl, orderData);

      // ШАБЛОНИ
      const templates = getTemplates() || [];
      if (select) {
        select.innerHTML = '';
        if (!templates.length) {
          select.disabled = true;
          select.insertAdjacentHTML('beforeend', '<option value="">Немає шаблонів</option>');
        } else {
          select.disabled = false;
          for (const t of templates) {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name || '(без назви)';
            select.appendChild(opt);
          }
          const saved = localStorage.getItem('stTplPreferredId');
          select.value = (saved && templates.some(t => t.id === saved)) ? saved : templates[0].id;
        }
      }

      const runCompile = (tpl, data) =>
        (window.TemplateEngine?.render)
          ? window.TemplateEngine.render(tpl, data)
          : compile(tpl, data);

      const render = () => {
        if (!editor) return;
        const ds  = build();
        const tpl = templates.find(x => x.id === (select?.value || ''))?.content || '';
        editor.value = runCompile(tpl, ds);
        console.log('[buildDataset]', ds);
      };

      const who = [rawTpl.clientName, rawTpl.phone].filter(Boolean).join(' ').trim();
      if (destEl) destEl.textContent = who || 'невідомо';
      if (select) {
        select.onchange = () => { localStorage.setItem('stTplPreferredId', select.value); render(); };
      }
      if (closeBtn) closeBtn.onclick = () => { modal.classList.add('hidden'); document.body.style.overflow = ''; };
      if (shareBtn) shareBtn.onclick = () => editor && sendViaShare(editor.value);

      // --- CHAT ID блок (інпут + нижня кнопка) ---
      const chatIdWrap = (() => {
        const exists = modal.querySelector('[data-chatid-wrap]');
        if (exists) return exists;
        const d = document.createElement('div');
        d.setAttribute('data-chatid-wrap', '1');
        d.className = 'foot-extra';
        d.innerHTML = `
          <input id="chatIdInput" class="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                 placeholder="chatId групи (наприклад -4945796658)" />
          <button type="button" data-action="send-bot"
                  class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm">
            Надіслати ботом
          </button>
        `;
        modal.querySelector('.send-box').appendChild(d);
        return d;
      })();

      const chatIdInput   = chatIdWrap.querySelector('#chatIdInput');
      const chatIdInitial =
        orderData?.telegramChatId ||
        rowEl?.dataset?.telegramChatId ||
        DEFAULT_TG_CHAT_ID || '';
      if (chatIdInitial) chatIdInput.value = chatIdInitial;
      const getChatId = () =>
        String(chatIdInput?.value || rowEl?.dataset?.telegramChatId || DEFAULT_TG_CHAT_ID || '').trim();

      // --- helper: order_group/AW ---
      function resolveOrderGroup(ds = {}) {
        const c = [];
        const push = v => { const s = (v ?? '').toString().trim(); if (s) c.push(s); };

        // data-* з рядка
        const d = rowEl?.dataset || {};
        push(d.order_group); push(d.orderGroup); push(d.og); push(d.aw);
        push(d.orderid); push(d.orderId); push(d.id);

        // із нормалізованих ключів
        push(ds.order_group); push(ds.orderGroup); push(ds.orderId); push(ds.orderid);

        // із сирих orderData
        push(orderData?.order_group); push(orderData?.orderGroup);
        push(orderData?.orderId); push(orderData?.orderid); push(orderData?.id);

        // із модалки (передали на початку)
        push(modal.dataset.og);

        // пріоритет довгого числового (класичний AW)
        const numeric = c.find(s => /^\d{6,}$/.test(s));
        return numeric || (c.find(Boolean) || '');
      }

      // --- КНОПКА «Оновити ботом» ---
      let editBtn = modal.querySelector('[data-action="tg-edit"]');
      if (!editBtn) {
        editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.setAttribute('data-action', 'tg-edit');
        editBtn.className = 'h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-900/60';
        editBtn.textContent = 'Оновити ботом';
        modal.querySelector('.send-box').appendChild(editBtn);
      }

      // savedMsg: з dataset або localStorage
      const ogForEdit =
        resolveOrderGroup(build()) ||
        modal.dataset.og ||
        rowEl?.dataset?.order_group ||
        rowEl?.dataset?.og || '';

      const fromRow = (rowEl?.dataset?.tgMsgId && rowEl?.dataset?.tgChatId)
        ? { messageId: rowEl.dataset.tgMsgId, chatId: rowEl.dataset.tgChatId }
        : null;
      let fromLs = null;
      if (ogForEdit) {
        try { fromLs = JSON.parse(localStorage.getItem(`tg-msg-${ogForEdit}`) || 'null'); }
        catch { fromLs = null; }
      }
      let savedMsg = fromRow || fromLs || null;
      editBtn.style.display = savedMsg ? '' : 'none';

      if (savedMsg) {
        editBtn.onclick = async () => {
          const chatId    = savedMsg.chatId || getChatId();
          const messageId = savedMsg.messageId;
          const newText   = editor ? String(editor.value || '').trim() : '';
          if (!chatId || !messageId) return alert('Немає chatId або messageId для редагування.');
          if (!newText) return alert('Текст порожній.');
          editBtn.disabled = true;
          try {
            await editViaBot({ chatId, messageId, text: newText });
            window.toast && toast('Повідомлення оновлено ✅');
          } catch (e) {
            console.error('Edit error:', e);
            alert('❌ ' + (e?.message || e));
          } finally {
            editBtn.disabled = false;
          }
        };
      }

      // --- ВІДПРАВКА: верхня кнопка ---
      if (sendBtn) {
        sendBtn.onclick = async () => {
          const chatId = getChatId();
          if (!chatId) return alert('Немає chatId. Вкажіть його в полі.');
          const msg = editor ? String(editor.value || '').trim() : '';
          if (!msg) return alert('Текст повідомлення порожній.');

          sendBtn.disabled = true;
          try {
            const resp = await sendViaBot({
              chatId,
              text: msg,
              messageThreadId: orderData?.telegramTopicId || ''
            });

            const og = resolveOrderGroup(build());
            if (og && resp?.messageId) {
              rowEl.dataset.tgChatId = resp.chatId || chatId;
              rowEl.dataset.tgMsgId  = resp.messageId;
              localStorage.setItem(`tg-msg-${og}`, JSON.stringify({
                chatId: resp.chatId || chatId,
                messageId: resp.messageId
              }));
            }

            // зробити редагування доступним одразу (НЕ залежить від статусу)
            savedMsg = { chatId: resp.chatId || chatId, messageId: resp.messageId };
            if (editBtn) editBtn.style.display = '';

            // статус — опційно
            try {
              const ogId = og || ogForEdit;
              if (ogId) {
                await persistStatusToSheet(ogId, STATUS_AFTER_SEND);
                setRowStatus(rowEl, STATUS_AFTER_SEND);
                try { updateOrderStatus(ogId, STATUS_AFTER_SEND); } catch {}
              }
            } catch (e) {
              console.warn('Не вдалося оновити статус:', e);
            }

            modal.classList.add('hidden');
            document.body.style.overflow = '';
            window.toast && toast('Надіслано ✅');
          } catch (e) {
            console.error('Send error:', e);
            alert('❌ ' + (e?.message || e));
          } finally {
            sendBtn.disabled = false;
          }
        };
      }

      // --- ВІДПРАВКА: нижня кнопка біля chatId ---
      const sendBotBtn = chatIdWrap.querySelector('[data-action="send-bot"]');
      if (sendBotBtn) {
        sendBotBtn.onclick = async () => {
          const chatId = getChatId();
          if (!chatId) return alert('Немає chatId. Вкажіть його в полі.');
          const msg = editor ? String(editor.value || '').trim() : '';
          if (!msg) return alert('Текст повідомлення порожній.');

          sendBotBtn.disabled = true;
          try {
            const resp = await sendViaBot({
              chatId,
              text: msg,
              messageThreadId: orderData?.telegramTopicId || ''
            });

            const og = resolveOrderGroup(build());
            if (og && resp?.messageId) {
              rowEl.dataset.tgChatId = resp.chatId || chatId;
              rowEl.dataset.tgMsgId  = resp.messageId;
              localStorage.setItem(`tg-msg-${og}`, JSON.stringify({
                chatId: resp.chatId || chatId,
                messageId: resp.messageId
              }));
            }

            savedMsg = { chatId: resp.chatId || chatId, messageId: resp.messageId };
            if (editBtn) editBtn.style.display = '';

            try {
              const ogId = og || ogForEdit;
              if (ogId) {
                await persistStatusToSheet(ogId, STATUS_AFTER_SEND);
                setRowStatus(rowEl, STATUS_AFTER_SEND);
                try { updateOrderStatus(ogId, STATUS_AFTER_SEND); } catch {}
              }
            } catch (e) {
              console.warn('Не вдалося оновити статус:', e);
            }

            modal.classList.add('hidden');
            document.body.style.overflow = '';
            window.toast && toast('Надіслано ✅');
          } catch (e) {
            console.error('Send error (bot):', e);
            alert('❌ ' + (e?.message || e));
          } finally {
            sendBotBtn.disabled = false;
          }
        };
      }

      // показати модалку й перший рендер
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      render();
    }

    // зробимо доступним з інших скриптів
    window.openSendTplModal = openSendModal;

    // ========= Автокнопка 📤 у рядках (якщо потрібно) =========
    function ensureActionsCell(row) {
      return row.querySelector('.order-actions,[data-col="actions"]') || row;
    }
    function mountSendButtons() {
      const rows = $$('#ordersBody .order-row, #ordersBody [data-order-id]');
      rows.forEach(row => {
        if (row.querySelector('.btn-send-tpl')) return;
        const where = ensureActionsCell(row);
        const btn = document.createElement('button');
        btn.className = 'btn-send-tpl h-8 px-2 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-sm';
        btn.title = 'Надіслати в Telegram';
        btn.textContent = '📤';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openSendModal({ rowEl: row, orderData: row.dataset });
        });
        where.appendChild(btn);
      });
    }
    window.mountSendButtons = mountSendButtons;

    // додатково: підтримка вже існуючих кнопок у твоїй верстці
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="open-send-modal"]');
      if (!btn) return;
      const rowEl = btn.closest('tr') || btn.closest('[data-order-id],[data-order-group]');
      const orderData = rowEl ? rowEl.dataset : {};
      openSendModal({ rowEl, orderData });
    });

    // ========= Стилі бейджа статусу + апдейти рядка =========
    function applyStatusStyles(pill, ok) {
      if (!pill) return;
      const cls = pill.classList;
      cls.remove('border-zinc-600/30','bg-zinc-800/50','text-zinc-300',
                 'border-emerald-500/30','bg-emerald-500/10','text-emerald-300');
      if (ok) {
        cls.add('border-emerald-500/30','bg-emerald-500/10','text-emerald-300');
      } else {
        cls.add('border-zinc-600/30','bg-zinc-800/50','text-zinc-300');
      }
    }
    function setRowStatus(rowEl, newLabel = STATUS_AFTER_SEND) {
      if (!rowEl) return;
      const og = rowEl.dataset.orderGroup || rowEl.dataset.order_group || rowEl.dataset.orderId || '';
      const pillRoot =
        (og && document.getElementById(`status-pill-${og}`)) ||
        rowEl.querySelector('[id^="status-pill-"]') ||
        rowEl.querySelector('[data-status],[data-label]') ||
        null;

      const labelEl = pillRoot?.querySelector('[data-label]') || pillRoot;
      if (labelEl) labelEl.textContent = newLabel;

      const dot = rowEl.querySelector('.status-dot');
      if (dot) {
        dot.classList.remove('bg-zinc-500','bg-emerald-400');
        dot.classList.add('bg-emerald-400');
      }
      applyStatusStyles(pillRoot, true);
      rowEl.dataset.status = newLabel;
    }
    window.setRowStatus = setRowStatus;

  })(); // end IIFE
}
