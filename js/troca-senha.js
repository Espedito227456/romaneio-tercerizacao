const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
const trocaSenhaForm = document.getElementById('trocaSenhaForm');
const senhaInput = document.getElementById('senha');
const confirmarSenhaInput = document.getElementById('confirmarSenha');
const formMessage = document.getElementById('formMessage');
const session = getAuthSession();

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

document.querySelectorAll('.toggle-password').forEach((button) => {
  const input = button.closest('.password-wrap')?.querySelector('input');
  if (input) {
    button.addEventListener('click', () => togglePasswordVisibility(input, button));
  }
});

trocaSenhaForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!session) {
    showMessage('Sessão expirada. Faça login novamente.');
    return;
  }

  if (senhaInput.value.length < 6) {
    showMessage('A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  if (senhaInput.value !== confirmarSenhaInput.value) {
    showMessage('As senhas não coincidem.');
    return;
  }

  try {
    const resposta = await fetch(`${API_BASE}/api/trocar-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: session.username, senha: senhaInput.value })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      showMessage(dados.erro || 'Não foi possível alterar a senha.');
      return;
    }
    showMessage('Senha alterada com sucesso! Redirecionando...', true);
    setTimeout(() => {
      window.location.href = session.type === 'admin' ? 'index.html' : 'remessa.html';
    }, 800);
  } catch (erro) {
    showMessage('Não foi possível conectar ao servidor.');
  }
});
