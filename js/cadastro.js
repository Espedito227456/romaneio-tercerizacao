const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

const cadastroForm = document.getElementById('cadastroForm');
const usuarioInput = document.getElementById('usuario');
const senhaInput = document.getElementById('senha');
const confirmarSenhaInput = document.getElementById('confirmarSenha');
const formMessage = document.getElementById('formMessage');

const cadastrarUsuario = async (username, password) => {
  const resposta = await fetch(`${API_BASE}/api/cadastro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: username, senha: password })
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Não foi possível criar o usuário.');
  }
  return { username: dados.usuario, type: dados.tipo };
};

const showMessage = (message, isSuccess = false) => {
  formMessage.textContent = message;
  formMessage.classList.toggle('visible', Boolean(message));
  formMessage.classList.toggle('success', isSuccess);
};

const togglePasswordVisibility = (input, button) => {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  button.classList.toggle('is-visible', isPassword);
  button.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
  button.setAttribute('title', isPassword ? 'Ocultar senha' : 'Mostrar senha');
};

const bindEyeToggles = () => {
  document.querySelectorAll('.toggle-password').forEach((button) => {
    const input = button.closest('.password-wrap')?.querySelector('input');

    if (!input) return;

    button.addEventListener('click', () => {
      togglePasswordVisibility(input, button);
    });
  });
};

const validateInputs = (username, password, confirmPassword) => {
  const normalized = username.trim();

  if (!normalized) {
    return 'Informe o usuário.';
  }

  if (normalized.length < 3) {
    return 'O usuário deve ter pelo menos 3 caracteres.';
  }

  if (password.length < 6) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  if (password !== confirmPassword) {
    return 'As senhas não coincidem.';
  }

  return '';
};

const initializeCadastro = () => {
  if (!cadastroForm) return;

  cadastroForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usuarioInput.value;
    const password = senhaInput.value;
    const confirmPassword = confirmarSenhaInput.value;

    const errorMessage = validateInputs(username, password, confirmPassword);

    if (errorMessage) {
      showMessage(errorMessage);
      return;
    }

    try {
      const novoUsuario = await cadastrarUsuario(username.trim(), password);
      setAuthSession(novoUsuario);
      showMessage('Usuário criado com sucesso! Redirecionando...', true);
      setTimeout(() => {
        window.location.href = novoUsuario.type === 'admin' ? 'index.html' : 'remessa.html';
      }, 800);
    } catch (erro) {
      showMessage(erro.message || 'Não foi possível conectar ao servidor.');
    }
  });

  bindEyeToggles();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCadastro, { once: true });
} else {
  initializeCadastro();
}
