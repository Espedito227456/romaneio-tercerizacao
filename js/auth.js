/*
  Autenticacao compartilhada entre todas as telas.
  Guarda a sessao local, controla redirecionamentos e injeta elementos de usuario no cabecalho.
*/

// Chave unica usada no localStorage para manter o usuario logado no navegador.
const AUTH_STORAGE_KEY = 'agiAuth';

// Recupera a sessao salva; se o JSON estiver corrompido, trata como usuario deslogado.
function getAuthSession() {
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    const session = localStorage.getItem(AUTH_STORAGE_KEY);
    return session ? JSON.parse(session) : null;
  } catch (_) { /* Captura falhas da operacao protegida acima. */
    return null;
  }
}

// Salva apenas os dados que o front-end precisa para navegação e exibicao.
function setAuthSession(user) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!user || !user.username) return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    username: user.username,
    type: user.type === 'admin' ? 'admin' : 'user'
  }));
}

// Limpa a sessao de login e tambem a remessa ativa da conferencia.
function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem('remessaAtiva');
}

// Retorna o nome do arquivo HTML atual para aplicar regras por pagina.
function getPageName() {
  return window.location.pathname.split('/').pop() || 'login.html';
}

const ADMIN_IMPORT_BUTTON_ID = 'botaoVoltarImportar';
const ADMIN_IMPORT_BUTTON_EXCLUDED_PAGES = ['login.html', 'cadastro.html', 'index.html'];
const AUTH_USER_MENU_ID = 'usuarioOperador';

// Mostra no cabecalho o usuario autenticado, logout e atalho para troca de senha.
function renderAuthenticatedUser(session) {
  const header = document.querySelector('.cabecalho-operador, body > header');
  const existing = document.getElementById(AUTH_USER_MENU_ID);

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!session || !header) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (existing) existing.remove();
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (existing) return;

  const userMenu = document.createElement('div');
  userMenu.id = AUTH_USER_MENU_ID;
  userMenu.className = 'usuario-operador';
  userMenu.innerHTML = `
    <span>Usuário: ${escapeHtml(session.username)}</span>
    <a href="login.html" data-action="logout">Logout</a>
    <a href="troca-senha.html">Trocar Senha</a>
  `;

  // Evento da tela: reage a uma acao do usuario ou do navegador.
  userMenu.querySelector('[data-action="logout"]').addEventListener('click', () => {
    clearAuthSession();
  });

  header.appendChild(userMenu);
}

// Escapa texto antes de montar HTML para evitar injecao de marcação vinda do nome de usuario.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

// Para administradores, exibe o atalho "Importar Romaneio" em telas operacionais.
function renderAdminImportButton(currentPage, session) {
  const existing = document.getElementById(ADMIN_IMPORT_BUTTON_ID);

  const isAdmin = Boolean(session && session.type === 'admin');
  const shouldShow = isAdmin && !ADMIN_IMPORT_BUTTON_EXCLUDED_PAGES.includes(currentPage);

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!shouldShow) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (existing) existing.remove();
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (existing) return;

  const container = document.querySelector('.container');
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!container) return;

  const link = document.createElement('a');
  link.id = ADMIN_IMPORT_BUTTON_ID;
  link.href = 'index.html';
  link.textContent = 'Importar Romaneio';
  link.style.cssText = 'display:inline-block;margin-bottom:18px;padding:10px 15px;border-radius:5px;background:#08783d;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;';
  // Evento da tela: reage a uma acao do usuario ou do navegador.
  link.addEventListener('mouseenter', () => { link.style.background = '#056331'; });
  // Evento da tela: reage a uma acao do usuario ou do navegador.
  link.addEventListener('mouseleave', () => { link.style.background = '#08783d'; });

  container.insertBefore(link, container.firstChild);
}

// Aplica a protecao de acesso: login livre, cadastro limitado e telas internas autenticadas.
function applyAuthGuard() {
  const currentPage = getPageName().toLowerCase();
  const session = getAuthSession();

  renderAuthenticatedUser(session);
  renderAdminImportButton(currentPage, session);

  // Condicao: valida este caso antes de continuar o fluxo.
  if (currentPage === 'login.html') {
    // Keep the login form available so a user can switch accounts.
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (currentPage === 'cadastro.html') {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (session && session.type === 'admin') {
      window.location.replace('index.html');
    }
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (currentPage === 'troca-senha.html') {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!session) {
      window.location.replace('login.html');
    }
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (session.type === 'admin' && currentPage === 'index.html') {
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (session.type !== 'admin' && currentPage === 'index.html') {
    window.location.replace('remessa.html');
  }
}

// Garante que a protecao rode depois que o DOM existir.
if (document.readyState === 'loading') {
  // Evento da tela: reage a uma acao do usuario ou do navegador.
  document.addEventListener('DOMContentLoaded', applyAuthGuard, { once: true });
} else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
  applyAuthGuard();
}
