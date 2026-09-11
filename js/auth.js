const AUTH_STORAGE_KEY = 'agiAuth';

function getAuthSession() {
  try {
    const session = localStorage.getItem(AUTH_STORAGE_KEY);
    return session ? JSON.parse(session) : null;
  } catch (_) {
    return null;
  }
}

function setAuthSession(user) {
  if (!user || !user.username) return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    username: user.username,
    type: user.type === 'admin' ? 'admin' : 'user'
  }));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getPageName() {
  return window.location.pathname.split('/').pop() || 'login.html';
}

const ADMIN_IMPORT_BUTTON_ID = 'botaoVoltarImportar';
const ADMIN_IMPORT_BUTTON_EXCLUDED_PAGES = ['login.html', 'cadastro.html', 'index.html'];
const AUTH_USER_MENU_ID = 'usuarioOperador';

function renderAuthenticatedUser(session) {
  const header = document.querySelector('.cabecalho-operador, body > header');
  const existing = document.getElementById(AUTH_USER_MENU_ID);

  if (!session || !header) {
    if (existing) existing.remove();
    return;
  }

  if (existing) return;

  const userMenu = document.createElement('div');
  userMenu.id = AUTH_USER_MENU_ID;
  userMenu.className = 'usuario-operador';
  userMenu.innerHTML = `
    <span>Usuário: ${escapeHtml(session.username)}</span>
    <a href="login.html" data-action="logout">Logout</a>
    <a href="troca-senha.html">Trocar Senha</a>
  `;

  userMenu.querySelector('[data-action="logout"]').addEventListener('click', () => {
    clearAuthSession();
  });

  header.appendChild(userMenu);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function renderAdminImportButton(currentPage, session) {
  const existing = document.getElementById(ADMIN_IMPORT_BUTTON_ID);

  const isAdmin = Boolean(session && session.type === 'admin');
  const shouldShow = isAdmin && !ADMIN_IMPORT_BUTTON_EXCLUDED_PAGES.includes(currentPage);

  if (!shouldShow) {
    if (existing) existing.remove();
    return;
  }

  if (existing) return;

  const container = document.querySelector('.container');
  if (!container) return;

  const link = document.createElement('a');
  link.id = ADMIN_IMPORT_BUTTON_ID;
  link.href = 'index.html';
  link.textContent = 'Importar Romaneio';
  link.style.cssText = 'display:inline-block;margin-bottom:18px;padding:10px 15px;border-radius:5px;background:#08783d;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;';
  link.addEventListener('mouseenter', () => { link.style.background = '#056331'; });
  link.addEventListener('mouseleave', () => { link.style.background = '#08783d'; });

  container.insertBefore(link, container.firstChild);
}

function applyAuthGuard() {
  const currentPage = getPageName().toLowerCase();
  const session = getAuthSession();

  renderAuthenticatedUser(session);
  renderAdminImportButton(currentPage, session);

  if (currentPage === 'login.html') {
    // Keep the login form available so a user can switch accounts.
    return;
  }

  if (currentPage === 'cadastro.html') {
    if (session && session.type === 'admin') {
      window.location.replace('index.html');
    }
    return;
  }

  if (currentPage === 'troca-senha.html') {
    if (!session) {
      window.location.replace('login.html');
    }
    return;
  }

  if (!session) {
    window.location.replace('login.html');
    return;
  }

  if (session.type === 'admin' && currentPage === 'index.html') {
    return;
  }

  if (session.type !== 'admin' && currentPage === 'index.html') {
    window.location.replace('remessa.html');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyAuthGuard, { once: true });
} else {
  applyAuthGuard();
}
