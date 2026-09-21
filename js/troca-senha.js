/*
  Tela de troca de senha.
  Usa a sessao atual para identificar o usuario e envia a nova senha para a API.
*/

// Base da API para pagina aberta pelo servidor ou diretamente pelo arquivo.
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// Elementos do formulario e sessao recuperada do modulo auth.js.
const trocaSenhaForm = document.getElementById('trocaSenhaForm');
const senhaInput = document.getElementById('senha');
const confirmarSenhaInput = document.getElementById('confirmarSenha');
const formMessage = document.getElementById('formMessage');
const session = getAuthSession();

// Exibe mensagens de erro/sucesso para o usuario.
const showMessage = (message, isSuccess = false) => {
  formMessage.textContent = message;
  formMessage.classList.toggle('visible', Boolean(message));
  formMessage.classList.toggle('success', isSuccess);
};

// Controla os botoes de mostrar/ocultar senha.
const togglePasswordVisibility = (input, button) => {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  button.classList.toggle('is-visible', isPassword);
  button.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
  button.setAttribute('title', isPassword ? 'Ocultar senha' : 'Mostrar senha');
};

// Liga cada botao de olho ao input de senha dentro do mesmo bloco visual.
document.querySelectorAll('.toggle-password').forEach((button) => {
  const input = button.closest('.password-wrap')?.querySelector('input');
  // Condicao: valida este caso antes de continuar o fluxo.
  if (input) {
    // Evento da tela: reage a uma acao do usuario ou do navegador.
    button.addEventListener('click', () => togglePasswordVisibility(input, button));
  }
});

// Envia a nova senha, valida localmente e redireciona ao final.
trocaSenhaForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!session) {
    showMessage('Sessão expirada. Faça login novamente.');
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (senhaInput.value.length < 6) {
    showMessage('A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (senhaInput.value !== confirmarSenhaInput.value) {
    showMessage('As senhas não coincidem.');
    return;
  }

  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    const resposta = await fetch(`${API_BASE}/api/trocar-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: session.username, senha: senhaInput.value })
    });
    const dados = await resposta.json().catch(() => ({}));
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!resposta.ok) {
      showMessage(dados.erro || 'Não foi possível alterar a senha.');
      return;
    }
    showMessage('Senha alterada com sucesso! Redirecionando...', true);
    setTimeout(() => {
      window.location.href = session.type === 'admin' ? 'index.html' : 'remessa.html';
    }, 800);
  } catch (erro) { /* Captura falhas da operacao protegida acima. */
    showMessage('Não foi possível conectar ao servidor.');
  }
});
