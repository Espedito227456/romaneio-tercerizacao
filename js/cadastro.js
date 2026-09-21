/*
  Tela de cadastro de usuario comum.
  Valida usuario/senha no navegador, cria o usuario pela API e ja inicia a sessao local.
*/

// Base da API para uso tanto em arquivo local quanto no servidor Node.
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// Elementos usados pelo formulario de criacao de usuario.
const cadastroForm = document.getElementById('cadastroForm');
const usuarioInput = document.getElementById('usuario');
const senhaInput = document.getElementById('senha');
const confirmarSenhaInput = document.getElementById('confirmarSenha');
const formMessage = document.getElementById('formMessage');

// Chama a rota de cadastro e devolve os dados minimos para criar a sessao do front-end.
const cadastrarUsuario = async (username, password) => {
  const resposta = await fetch(`${API_BASE}/api/cadastro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: username, senha: password })
  });
  const dados = await resposta.json().catch(() => ({}));
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Não foi possível criar o usuário.');
  }
  return { username: dados.usuario, type: dados.tipo };
};

// Exibe validacoes ou sucesso abaixo do formulario.
const showMessage = (message, isSuccess = false) => {
  formMessage.textContent = message;
  formMessage.classList.toggle('visible', Boolean(message));
  formMessage.classList.toggle('success', isSuccess);
};

// Alterna um campo de senha entre texto visivel e senha protegida.
const togglePasswordVisibility = (input, button) => {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  button.classList.toggle('is-visible', isPassword);
  button.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
  button.setAttribute('title', isPassword ? 'Ocultar senha' : 'Mostrar senha');
};

// Liga todos os botoes de olho aos seus respectivos inputs de senha.
const bindEyeToggles = () => {
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  document.querySelectorAll('.toggle-password').forEach((button) => {
    const input = button.closest('.password-wrap')?.querySelector('input');

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!input) return;

    // Evento da tela: reage a uma acao do usuario ou do navegador.
    button.addEventListener('click', () => {
      togglePasswordVisibility(input, button);
    });
  });
};

// Regras de validacao antes de enviar ao servidor.
const validateInputs = (username, password, confirmPassword) => {
  const normalized = username.trim();

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!normalized) {
    return 'Informe o usuário.';
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (normalized.length < 3) {
    return 'O usuário deve ter pelo menos 3 caracteres.';
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (password.length < 6) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (password !== confirmPassword) {
    return 'As senhas não coincidem.';
  }

  return '';
};

// Configura envio do cadastro e redirecionamento depois da criacao.
const initializeCadastro = () => {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!cadastroForm) return;

  // Evento da tela: reage a uma acao do usuario ou do navegador.
  cadastroForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usuarioInput.value;
    const password = senhaInput.value;
    const confirmPassword = confirmarSenhaInput.value;

    const errorMessage = validateInputs(username, password, confirmPassword);

    // Condicao: valida este caso antes de continuar o fluxo.
    if (errorMessage) {
      showMessage(errorMessage);
      return;
    }

    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const novoUsuario = await cadastrarUsuario(username.trim(), password);
      sessionStorage.removeItem('remessaAtiva');
      setAuthSession(novoUsuario);
      showMessage('Usuário criado com sucesso! Redirecionando...', true);
      setTimeout(() => {
        window.location.href = novoUsuario.type === 'admin' ? 'index.html' : 'remessa.html';
      }, 800);
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      showMessage(erro.message || 'Não foi possível conectar ao servidor.');
    }
  });

  bindEyeToggles();
};

// Inicializa somente quando o DOM estiver pronto.
if (document.readyState === 'loading') {
  // Evento da tela: reage a uma acao do usuario ou do navegador.
  document.addEventListener('DOMContentLoaded', initializeCadastro, { once: true });
} else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
  initializeCadastro();
}
