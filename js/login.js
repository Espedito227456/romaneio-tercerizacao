const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usuario');
const passwordInput = document.getElementById('senha');
const messageElement = document.getElementById('formMessage');
const toggleButton = document.querySelector('.toggle-password');

const showLoginMessage = (message, isSuccess = false) => {
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.classList.toggle('visible', Boolean(message));
  messageElement.classList.toggle('success', isSuccess);
};

const resolveUserLogin = async (username, password) => {
  const resposta = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: username, senha: password })
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Usuário ou senha inválidos.');
  }
  return { username: dados.usuario, type: dados.tipo, destination: dados.tipo === 'admin' ? 'index.html' : 'remessa.html' };
};

if (passwordInput && toggleButton) {
  const applyToggleState = () => {
    const isVisible = passwordInput.type === 'text';
    toggleButton.classList.toggle('is-visible', isVisible);
    toggleButton.setAttribute('aria-label', isVisible ? 'Ocultar senha' : 'Mostrar senha');
    toggleButton.setAttribute('title', isVisible ? 'Ocultar senha' : 'Mostrar senha');
  };

  toggleButton.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    applyToggleState();
  });

  applyToggleState();
}

const initializeLogin = () => {
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username.trim() || !password.trim()) {
      showLoginMessage('Informe usuário e senha.');
      return;
    }

    showLoginMessage('Entrando...', true);

    try {
      const userSession = await resolveUserLogin(username, password);
      sessionStorage.removeItem('remessaAtiva');
      setAuthSession(userSession);
      window.location.href = userSession.destination;
    } catch (erro) {
      showLoginMessage(erro.message || 'Não foi possível conectar ao servidor.');
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLogin, { once: true });
} else {
  initializeLogin();
}
