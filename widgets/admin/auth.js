// /frontend/widgets/admin/auth.js
// Авторизація для адмін-панелі ShiftTime CRM

const STORAGE_KEY  = 'st_user';         // 🔐 де зберігаємо сесію
const API_AUTH_URL = '/api/auth';       // 🌐 Netlify proxy → GAS
let _user = null;

/* ====================== USER SESSION ====================== */

export function getCurrentUser() {
  if (_user) return _user;
  try { _user = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { _user = null; }
  return _user;
}

export function setCurrentUser(u) {
  _user = u;
  if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  else localStorage.removeItem(STORAGE_KEY);
}

export function signOut() {
  setCurrentUser(null);
}

/* ====================== HELPERS =========================== */

function waitForEl(selector, { timeout = 5000, interval = 100 } = {}) {
  return new Promise(resolve => {
    const el0 = document.querySelector(selector);
    if (el0) return resolve(el0);
    let t = 0;
    const iv = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) { clearInterval(iv); resolve(el); return; }
      t += interval;
      if (t >= timeout) { clearInterval(iv); resolve(null); }
    }, interval);
  });
}

async function openLoginModal() {
  let modal = document.getElementById('admin-login-modal');
  if (!modal) {
    if (location.hash !== '#admin') location.hash = '#admin';
    modal = await waitForEl('#admin-login-modal');
  }
  modal?.classList.remove('hidden');
}

async function apiAuth(action, payload) {
  try {
    const res = await fetch(API_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const txt = await res.text();
    return JSON.parse(txt);
  } catch {
    return { success:false, error:'Bad JSON from server' };
  }
}

/* ====================== UI SYNC =========================== */

function switchPane(to = 'login') {
  const isLogin = to === 'login';
  document.getElementById('pane-login')?.classList.toggle('hidden', !isLogin);
  document.getElementById('pane-register')?.classList.toggle('hidden', isLogin);
  document.getElementById('tab-login')?.classList.toggle('bg-white', isLogin);
  document.getElementById('tab-login')?.classList.toggle('text-black', isLogin);
  document.getElementById('tab-register')?.classList.toggle('bg-white', !isLogin);
  document.getElementById('tab-register')?.classList.toggle('text-black', !isLogin);
}

function syncHeader(headerTargets) {
  const u = getCurrentUser();
  if (!headerTargets) return;

  const headerLoginBtn = document.getElementById(headerTargets.loginBtn);
  const headerBadge    = document.getElementById(headerTargets.badgeEl);
  if (!headerLoginBtn || !headerBadge) return;

  if (u) {
    headerLoginBtn.classList.add('hidden');
    headerBadge.classList.remove('hidden');

    const roleLabel = uaRole(u.roles);
    const nameLabel = u.name || u.email || 'Користувач';
    headerBadge.textContent = `${roleLabel} — ${nameLabel}`;
    headerBadge.setAttribute('aria-expanded', 'false'); // ⬅️ ADDED
  } else {
    headerBadge.classList.add('hidden');
    headerLoginBtn.classList.remove('hidden');
  }
}

function syncAdminUI(onAuth, headerTargets) {
  const u = getCurrentUser();
  const loginBtn   = document.getElementById('admin-btn-login');
  const logoutBtn  = document.getElementById('admin-btn-logout');
  const badge      = document.getElementById('admin-user-badge');
  const nameEl     = document.getElementById('admin-user-name');
  const emailEl    = document.getElementById('admin-user-email');
  const photoEl    = document.getElementById('admin-user-photo');

  if (u) {
    loginBtn?.classList.add('hidden'); badge?.classList.remove('hidden');
    if (nameEl)  nameEl.textContent  = u.name  || 'Користувач';
    if (emailEl) emailEl.textContent = u.email || '';
    if (photoEl && u.photoURL) { photoEl.src = u.photoURL; photoEl.alt = u.name || 'user'; }
    logoutBtn?.addEventListener('click', () => {
      signOut();
      syncAdminUI(onAuth, headerTargets);
      syncHeader(headerTargets);
      onAuth?.(null);
    }, { once:true });
  } else {
    badge?.classList.add('hidden'); loginBtn?.classList.remove('hidden');
  }
}

/* ---------- ⬇️ ADDED: Пряме та безпечне прив’язування хедер-меню ---------- */
function bindHeaderMenuSafe() {
  const userMenu = document.getElementById('user-menu');
  const badge    = document.getElementById('global-user-badge');
  const dd       = document.getElementById('global-user-dropdown');
  const logout   = document.getElementById('global-logout-btn');

  if (!userMenu || !badge || !dd) return;

  // Не дублюємо слухачі
  if (!badge.dataset.bound) {
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      dd.classList.toggle('hidden');
      const expanded = dd.classList.contains('hidden') ? 'false' : 'true';
      badge.setAttribute('aria-expanded', expanded);
    });
    badge.dataset.bound = '1';
  }

  if (!document.body.dataset.userMenuOutsideBound) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#user-menu')) {
        dd.classList.add('hidden');
        badge.setAttribute('aria-expanded', 'false');
      }
    });
    document.body.dataset.userMenuOutsideBound = '1';
  }

  if (logout && !logout.dataset.bound) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
      dd.classList.add('hidden');
      badge.setAttribute('aria-expanded', 'false');
      // оновити UI
      syncHeader({ loginBtn:'global-login-btn', badgeEl:'global-user-badge' });
    });
    logout.dataset.bound = '1';
  }
}
/* ---------- ⬆️ ADDED ------------------------------------------------------ */

/* ====================== MAIN INIT ========================= */

export function initAuth({ onAuth, headerTargets } = {}) {
  // Делегування кліків
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('#global-login-btn, #admin-btn-login');
    if (openBtn) { e.preventDefault(); openLoginModal(); }

    if (e.target.closest('#admin-modal-close'))
      document.getElementById('admin-login-modal')?.classList.add('hidden');

    if (e.target.closest('#tab-login'))    switchPane('login');
    if (e.target.closest('#tab-register')) switchPane('register');

    // Вхід
    if (e.target.closest('#btnDoLogin')) {
      const idf  = String(document.getElementById('login-identifier')?.value || '').trim();
      const pass = String(document.getElementById('login-password')?.value   || '');
      const err  = document.getElementById('login-error');
      if (!idf || !pass) {
        err?.classList.remove('hidden');
        if (err) err.textContent = 'Заповніть логін/email і пароль';
        return;
      }
      err?.classList.add('hidden');
      apiAuth('login', { identifier:idf, password:pass }).then(r => {
        if (!r?.success) {
          err?.classList.remove('hidden');
          if (err) err.textContent = r?.error || 'Помилка входу';
          return;
        }
        const u = r.user || {};
        setCurrentUser({
          uid: 'row_' + (u.id ?? ''),
          name: `${u.surname || ''} ${u.name || ''}`.trim() || u.login || u.email,
          email: u.email, login: u.login, roles: u.roles || [u.role || 'user'],
          photoURL: '',
        });
        document.getElementById('admin-login-modal')?.classList.add('hidden');
        syncAdminUI(onAuth, headerTargets);
        syncHeader(headerTargets);
        bindHeaderMenuSafe();                  // ⬅️ ADDED
        onAuth?.(getCurrentUser());
      });
    }

    // Реєстрація
    if (e.target.closest('#btnDoRegister')) {
      const p = {
        surname:  String(document.getElementById('reg-surname')?.value  || '').trim(),
        name:     String(document.getElementById('reg-name')?.value     || '').trim(),
        phone:    String(document.getElementById('reg-phone')?.value    || '').trim(),
        email:    String(document.getElementById('reg-email')?.value    || '').trim(),
        login:    String(document.getElementById('reg-login')?.value    || '').trim(),
        password: String(document.getElementById('reg-password')?.value || ''),
      };
      const err = document.getElementById('reg-error');
      if (!p.surname || !p.name || !p.phone || !p.email || !p.login || !p.password) {
        err?.classList.remove('hidden');
        if (err) err.textContent = 'Заповніть усі поля';
        return;
      }
      err?.classList.add('hidden');
      apiAuth('register', p).then(r => {
        if (!r?.success) {
          err?.classList.remove('hidden');
          if (err) err.textContent = r?.error || 'Помилка реєстрації';
          return;
        }
        const u = r.user || {};
        setCurrentUser({
          uid: 'row_' + (u.id ?? ''),
          name: `${u.surname || ''} ${u.name || ''}`.trim() || u.login || u.email,
          email: u.email, login: u.login, roles: u.roles || [u.role || 'user'],
          photoURL: '',
        });
        document.getElementById('admin-login-modal')?.classList.add('hidden');
        switchPane('login');
        syncAdminUI(onAuth, headerTargets);
        syncHeader(headerTargets);
        bindHeaderMenuSafe();                  // ⬅️ ADDED
        onAuth?.(getCurrentUser());
      });
    }

    // Mock Google login
    if (e.target.closest('#btnLoginWithGoogle')) {
      const mock = {
        uid: 'uid_' + Math.random().toString(36).slice(2),
        name: 'Shift Admin',
        email: 'admin@example.com',
        roles: ['owner'],
        photoURL: ''
      };
      setCurrentUser(mock);
      document.getElementById('admin-login-modal')?.classList.add('hidden');
      syncAdminUI(onAuth, headerTargets);
      syncHeader(headerTargets);
      bindHeaderMenuSafe();                    // ⬅️ ADDED
      onAuth?.(mock);
    }

    // === ДРОПДАУН У ШАПЦІ =================================================

    // Відкрити/закрити меню користувача при кліку на бейдж
    if (e.target.closest('#global-user-badge')) {
      const dd = document.getElementById('global-user-dropdown');
      dd?.classList.toggle('hidden');
    }

    // Натискання на "Вихід" у дропдауні
    if (e.target.closest('#global-logout-btn')) {
      e.preventDefault();
      signOut();
      document.getElementById('global-user-dropdown')?.classList.add('hidden');
      syncAdminUI(onAuth, headerTargets);
      syncHeader(headerTargets);
      onAuth?.(null);
      return;
    }

    // Клік поза меню — закриваємо дропдаун
    if (!e.target.closest('#user-menu')) {
      document.getElementById('global-user-dropdown')?.classList.add('hidden');
    }
  });

  // Віддзеркалення стану у глобальній шапці
  if (headerTargets && headerTargets.loginBtn && headerTargets.badgeEl) {
    const headerLoginBtn = document.getElementById(headerTargets.loginBtn);
    const renderHeader = () => {
      syncHeader(headerTargets);
      bindHeaderMenuSafe();                    // ⬅️ ADDED
    };
    headerLoginBtn?.addEventListener('click', (e) => { e.preventDefault(); openLoginModal(); });
    renderHeader();
    window.addEventListener('storage', renderHeader);
  }

  // Слухач змін localStorage (універсальний)
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) {
      _user = null;
      syncAdminUI(onAuth, headerTargets);
      syncHeader(headerTargets);
      bindHeaderMenuSafe();                    // ⬅️ ADDED
      onAuth?.(getCurrentUser());
    }
  });

  // Початковий sync
  syncAdminUI(onAuth, headerTargets);
  syncHeader(headerTargets);
  bindHeaderMenuSafe();                        // ⬅️ ADDED

  // ⬅️ ADDED: коли довантажилися header/sidebar/footer — переприв’язати ще раз
  window.addEventListener('components:loaded', () => {
    syncHeader(headerTargets);
    bindHeaderMenuSafe();
  });
}


function uaRole(roles){
  const r = String((roles && roles[0]) || 'user').toLowerCase();
  if (r === 'admin') return 'Адмін';
  if (r === 'manager') return 'Менеджер';
  return 'Користувач';
}
