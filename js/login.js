/*
  Tela de login.
  Valida os campos, chama a API de autenticacao e redireciona conforme o perfil do usuario.
*/

// Usa o servidor local quando a pagina e aberta como arquivo, e caminho relativo quando servida pelo Node.
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// Referencias aos campos e mensagens do formulario.
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usuario');
const passwordInput = document.getElementById('senha');
const messageElement = document.getElementById('formMessage');
const toggleButton = document.querySelector('.toggle-password');

// Atualiza a mensagem visual do formulario, podendo marcar como sucesso.
const showLoginMessage = (message, isSuccess = false) => {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.classList.toggle('visible', Boolean(message));
  messageElement.classList.toggle('success', isSuccess);
};

// Envia usuario/senha ao backend e transforma a resposta no formato de sessao usado pelo front-end.
const resolveUserLogin = async (username, password) => {
  const resposta = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: username, senha: password })
  });
  const dados = await resposta.json().catch(() => ({}));
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Usuário ou senha inválidos.');
  }
  return { username: dados.usuario, type: dados.tipo, destination: dados.tipo === 'admin' ? 'index.html' : 'remessa.html' };
};

// Controla o botao de mostrar/ocultar senha.
if (passwordInput && toggleButton) {
  // Funcao applyToggleState: concentra uma acao reutilizada neste arquivo.
  const applyToggleState = () => {
    const isVisible = passwordInput.type === 'text';
    toggleButton.classList.toggle('is-visible', isVisible);
    toggleButton.setAttribute('aria-label', isVisible ? 'Ocultar senha' : 'Mostrar senha');
    toggleButton.setAttribute('title', isVisible ? 'Ocultar senha' : 'Mostrar senha');
  };

  // Evento da tela: reage a uma acao do usuario ou do navegador.
  toggleButton.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    applyToggleState();
  });

  applyToggleState();
}

// Registra o evento de envio do formulario e executa o fluxo completo de login.
const initializeLogin = () => {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!loginForm) return;

  // Evento da tela: reage a uma acao do usuario ou do navegador.
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!username.trim() || !password.trim()) {
      showLoginMessage('Informe usuário e senha.');
      return;
    }

    showLoginMessage('Entrando...', true);

    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const userSession = await resolveUserLogin(username, password);
      sessionStorage.removeItem('remessaAtiva');
      setAuthSession(userSession);
      window.location.href = userSession.destination;
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      showLoginMessage(erro.message || 'Não foi possível conectar ao servidor.');
    }
  });
};

// Espera o DOM quando necessario antes de ligar os eventos.
if (document.readyState === 'loading') {
  // Evento da tela: reage a uma acao do usuario ou do navegador.
  document.addEventListener('DOMContentLoaded', initializeLogin, { once: true });
} else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
  initializeLogin();
}
