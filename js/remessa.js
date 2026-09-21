/*
  Tela de conferencia operacional.
  Permite selecionar uma remessa, localizar pecas por codigo, registrar quantidade encontrada,
  anexar fotos e salvar o progresso no servidor com atualizacao em tempo real.
*/

// Estado geral mantido no navegador enquanto a tela esta aberta.
let remessas = [];
let remessa = null;
let pecaAtiva = null;
let fotosPendentes = [];
let envioEmAndamento = false;
const chaveRemessaAtiva = "remessaAtiva";

// API e canal SSE usados para buscar/salvar remessas e receber mudancas de outros usuarios.
const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const canalTempoReal = new EventSource(API_BASE + "/api/tempo-real");
// Evento da tela: reage a uma acao do usuario ou do navegador.
canalTempoReal.addEventListener("remessa:atualizada", evento => {
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try { receberAtualizacaoTempoReal(JSON.parse(evento.data)); } catch (_) {}
});
// Evento da tela: reage a uma acao do usuario ou do navegador.
canalTempoReal.addEventListener("remessa:criada", () => {
  carregarRemessas().catch(() => mensagemBusca("Não foi possível atualizar as remessas.", true));
});

// Elementos de formulario usados com frequencia durante a conferencia.
const numeroBusca = document.getElementById("numeroBusca");
const codigoManual = document.getElementById("codigoManual");
const buscarCodigo = document.getElementById("buscarCodigo");
const fotoConferencia = document.getElementById("fotoConferencia");
const quantidadeEncontrada = document.getElementById("quantidadeEncontrada");
const iniciarNovaRemessa = new URLSearchParams(window.location.search).get("nova") === "1";

// O parametro ?nova=1 força a tela a esquecer a remessa anterior neste aparelho.
if (iniciarNovaRemessa) {
  sessionStorage.removeItem(chaveRemessaAtiva);
  window.history.replaceState({}, "", "remessa.html");
}

// Eventos principais da tela: busca de remessa, busca de peca, foto, quantidade e envio.
document.getElementById("buscarRemessa").addEventListener("click", buscarRemessa);
// Evento da tela: reage a uma acao do usuario ou do navegador.
numeroBusca.addEventListener("keydown", evento => {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (evento.key === "Enter") buscarRemessa();
});
// Evento da tela: reage a uma acao do usuario ou do navegador.
buscarCodigo.addEventListener("click", localizarCodigo);
// Evento da tela: reage a uma acao do usuario ou do navegador.
codigoManual.addEventListener("keydown", evento => {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (evento.key === "Enter") localizarCodigo();
});
// Evento da tela: reage a uma acao do usuario ou do navegador.
fotoConferencia.addEventListener("change", adicionarFoto);
// Evento da tela: reage a uma acao do usuario ou do navegador.
quantidadeEncontrada.addEventListener("input", atualizarEstadoEnvio);
// Evento da tela: reage a uma acao do usuario ou do navegador.
document.getElementById("enviarConferencia").addEventListener("click", enviarConferencia);
// Evento da tela: reage a uma acao do usuario ou do navegador.
document.getElementById("fecharModalRemessa").addEventListener("click", fecharModalRemessa);
// Evento da tela: reage a uma acao do usuario ou do navegador.
document.getElementById("selecionarNovaRemessa").addEventListener("click", () => sessionStorage.removeItem(chaveRemessaAtiva));

// Busca remessas na API e saneia os dados antes de usar na interface.
function carregarRemessas() {
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  return fetch(API_BASE + "/api/remessas").then(resposta => resposta.ok ? resposta.json() : Promise.reject()).then(dados => dados.filter(item => item && Array.isArray(item.pecas)).map(item => ({
      ...item,
      // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
      pecas: item.pecas.filter(peca => peca && String(peca.codigo || "").trim() && Number.isInteger(Number(peca.quantidade)) && Number(peca.quantidade) > 0).map(peca => ({
        ...peca,
        codigo: String(peca.codigo).trim(),
        quantidade: Number(peca.quantidade),
        encontrada: Math.max(0, Math.min(Number(peca.quantidade), Number(peca.encontrada) || 0)),
        // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
        fotos: Array.isArray(peca.fotos) ? peca.fotos.filter(foto => {
          const imagem = typeof foto === "string" ? foto : foto?.imagem;
          return typeof imagem === "string" && (imagem.startsWith("data:image/") || imagem.startsWith("/uploads/"));
        }) : []
      }))
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    })).filter(item => item.pecas.length));
}

// Primeira carga da tela: lista remessas, mostra recentes e restaura a ultima remessa ativa.
carregarRemessas().then(dados => {
  remessas = dados;
  renderizarRemessasRecentes();
  restaurarRemessaAtiva();
}).catch(() => {
  renderizarRemessasRecentes();
  mensagemBusca("Não foi possível conectar ao servidor.", true);
});

// Monta uma chave de historico por usuario para nao misturar recentes entre operadores.
function obterChaveRecentes() {
  const sessao = typeof getAuthSession === "function" ? getAuthSession() : null;
  const usuario = sessao && sessao.username ? sessao.username.trim() : "geral";
  return "remessasRecentes_" + usuario;
}

// Le as ultimas remessas acessadas no localStorage.
function obterRemessasRecentes() {
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    const chave = obterChaveRecentes();
    const dados = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch (_) { /* Captura falhas da operacao protegida acima. */
    return [];
  }
}

// Salva a remessa aberta no topo da lista de recentes, limitada a 5 itens.
function salvarRemessaRecente(numero) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!numero) return;
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    const chave = obterChaveRecentes();
    let recentes = obterRemessasRecentes();
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    recentes = recentes.filter(item => normalizar(item) !== normalizar(numero));
    recentes.unshift(String(numero).trim());
    recentes = recentes.slice(0, 5);
    localStorage.setItem(chave, JSON.stringify(recentes));
  } catch (_) { /* Captura falhas da operacao protegida acima. */}
  renderizarRemessasRecentes();
}

// Renderiza botoes rapidos para as remessas usadas recentemente.
function renderizarRemessasRecentes() {
  const container = document.getElementById("containerRemessasRecentes");
  const lista = document.getElementById("listaRemessasRecentes");
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!container || !lista) return;

  const recentes = obterRemessasRecentes();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!recentes.length) {
    container.hidden = true;
    lista.innerHTML = "";
    return;
  }

  container.hidden = false;
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  lista.innerHTML = recentes.map(num => `
    <button type="button" class="btn-remessa-recente" data-numero="${escapar(num)}" title="Abrir remessa ${escapar(num)}">
      📦 ${escapar(num)}
    </button>
  `).join("");

  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  lista.querySelectorAll(".btn-remessa-recente").forEach(botao => {
    // Evento da tela: reage a uma acao do usuario ou do navegador.
    botao.addEventListener("click", () => {
      const num = botao.getAttribute("data-numero");
      // Condicao: valida este caso antes de continuar o fluxo.
      if (numeroBusca) {
        numeroBusca.value = num;
        buscarRemessa();
      }
    });
  });
}

// Procura a remessa digitada, aceitando o numero completo ou final do identificador.
function buscarRemessa() {
  const busca = normalizar(numeroBusca.value);
  const encontrada = remessas.find(item => {
    const codigo = normalizar(item.numero);
    return busca && (codigo === busca || codigo.endsWith(busca));
  });
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!encontrada) return mensagemBusca("Remessa não encontrada.", true);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (remessaConcluida(encontrada)) return abrirModalRemessaConcluida(encontrada);
  abrirRemessa(encontrada);
}

// Abre a remessa selecionada e habilita a area de conferencia.
function abrirRemessa(encontrada) {
  remessa = encontrada;
  sessionStorage.setItem(chaveRemessaAtiva, remessa.id || remessa.numero);
  salvarRemessaRecente(remessa.numero);
  document.getElementById("selecaoRemessa").hidden = true;
  document.getElementById("conteudoRemessa").hidden = false;
  document.getElementById("numeroRemessa").textContent = remessa.numero;
  document.getElementById("semanaRemessa").textContent = remessa.semana || "—";
  codigoManual.disabled = false;
  buscarCodigo.disabled = false;
  atualizarTela();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  window.scrollTo(0, 0);
}

// Reabre automaticamente a remessa ativa salva na sessao do navegador.
function restaurarRemessaAtiva() {
  const identificador = sessionStorage.getItem(chaveRemessaAtiva);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!identificador) return;
  const encontrada = remessas.find(item => String(item.id || item.numero) === identificador);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (encontrada) abrirRemessa(encontrada);
  else sessionStorage.removeItem(chaveRemessaAtiva);
}

// Filtra fotos validas e conta fotos expiradas como evidencia existente.
function obterFotosPeca(peca) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!Array.isArray(peca?.fotos)) return [];
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  return peca.fotos.filter(foto => {
    // Uma foto expirada (arquivo removido do R2 apos 90 dias) nao tem mais imagem,
    // mas o registro continua contando como evidencia valida da conferencia.
    if (foto && typeof foto === "object" && foto.expirada) return true;
    const imagem = typeof foto === "string" ? foto : foto?.imagem;
    return typeof imagem === "string" && (imagem.startsWith("data:image/") || imagem.startsWith("/uploads/"));
  });
}

// Indica se a quantidade da peca ja foi totalmente debitada.
function quantidadeConferidaPeca(peca) {
  return Number(peca?.encontrada) >= Number(peca?.quantidade);
}

// Uma peca so e concluida quando quantidade total foi encontrada e existe evidencia.
function pecaConcluida(peca) {
  return quantidadeConferidaPeca(peca) && obterFotosPeca(peca).length > 0;
}

// Detecta peca com quantidade completa, mas sem foto, para alertar o usuario.
function pecaComFotoPendente(peca) {
  return quantidadeConferidaPeca(peca) && obterFotosPeca(peca).length === 0;
}

// A remessa fica concluida quando todas as pecas passam pela regra de conclusao.
function remessaConcluida(item) {
  return item.pecas.length > 0 && item.pecas.every(peca => pecaConcluida(peca));
}

// Mostra modal quando o usuario tenta abrir uma remessa ja finalizada.
function abrirModalRemessaConcluida(item) {
  salvarRemessaRecente(item.numero);
  const nomeRemessa = /^remessa\b/i.test(String(item.numero)) ? item.numero : "remessa " + item.numero;
  document.getElementById("mensagemRemessaConcluida").textContent = "A " + nomeRemessa + " já foi totalmente conferida. Consulte as fotos e os detalhes na tela de conferência.";
  document.getElementById("consultarRemessaConcluida").href = "conferencia-remessa.html?remessa=" + encodeURIComponent(item.numero);
  document.getElementById("modalRemessaConcluida").hidden = false;
  document.getElementById("fecharModalRemessa").focus();
}

// Fecha o modal de remessa concluida e devolve foco para a busca.
function fecharModalRemessa() {
  document.getElementById("modalRemessaConcluida").hidden = true;
}

// Localiza a peca pelo codigo digitado e prepara o formulario de quantidade/fotos.
function localizarCodigo() {
  const codigo = codigoManual.value.trim();
  pecaAtiva = remessa?.pecas.find(peca => normalizar(peca.codigo) === normalizar(codigo)) || null;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!pecaAtiva) {
    limparPecaAtiva();
    return mensagem("Código não encontrado nesta remessa.", true);
  }

  const quantidade = Number(pecaAtiva.quantidade);
  const encontrada = Number(pecaAtiva.encontrada);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    limparPecaAtiva();
    return mensagem("A quantidade deste código não é válida na remessa.", true);
  }
  pecaAtiva.quantidade = quantidade;
  pecaAtiva.encontrada = Number.isInteger(encontrada) ? Math.max(0, Math.min(quantidade, encontrada)) : 0;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (pecaAtiva.encontrada >= quantidade) {
    limparPecaAtiva();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (pecaComFotoPendente(pecaAtiva)) {
      return mensagem("Todas as quantidades deste código já foram debitadas, mas a evidência fotográfica está pendente. Consulte a tela de conferência para incluir a foto.", true);
    }
    return mensagem("Todas as peças deste código já foram encontradas.", true);
  }
  fotosPendentes = [];
  document.getElementById("formularioPeca").hidden = false;
  document.getElementById("quantidadeEncontrada").disabled = false;
  document.getElementById("quantidadeEncontrada").max = pecaAtiva.quantidade - pecaAtiva.encontrada;
  document.getElementById("quantidadeEncontrada").value = "";
  document.getElementById("quantidadeEncontrada").focus();
  document.getElementById("limiteQuantidade").textContent = "Faltam " + (pecaAtiva.quantidade - pecaAtiva.encontrada) + " unidade(s).";
  atualizarFotos();
  atualizarEstadoEnvio();
  mensagem(pecaAtiva.encontrada ? "Código localizado. Tire uma nova foto desta conferência." : "Código localizado. Adicione uma foto para iniciar a conferência.");
}

// Adiciona uma foto nova a lista pendente desta conferencia.
function adicionarFoto(evento) {
  const arquivo = evento.target.files[0];
  evento.target.value = "";
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!arquivo) return;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!pecaAtiva) return mensagem("Busque o código antes de adicionar fotos.", true);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!arquivo.type.startsWith("image/")) return mensagem("Selecione uma imagem válida.", true);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (fotosPendentes.length >= 5) return mensagem("O limite de 5 fotos nesta conferência foi atingido.", true);
  lerFoto(arquivo).then(foto => {
    fotosPendentes.push(foto);
    atualizarFotos();
    atualizarEstadoEnvio();
  }).catch(() => mensagem("Não foi possível carregar a foto.", true));
}

// Atualiza contador e miniaturas das fotos ainda nao enviadas.
function atualizarFotos() {
  const fotosRegistradas = obterFotosPeca(pecaAtiva).length;
  document.getElementById("contadorFotos").textContent = fotosPendentes.length + "/5 nesta conferência; " + fotosRegistradas + " acumulada(s)";
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  document.getElementById("fotosConferencia").innerHTML = fotosPendentes.map(foto => `<img class="miniatura-evidencia" src="${escaparFoto(foto)}" alt="Foto da peça ${escapar(pecaAtiva.codigo)}">`).join("");
  fotoConferencia.disabled = fotosPendentes.length >= 5;
}

// Habilita o botao de envio somente quando quantidade e foto estao validas.
function atualizarEstadoEnvio() {
  const quantidade = Number(quantidadeEncontrada.value);
  const faltante = pecaAtiva ? pecaAtiva.quantidade - pecaAtiva.encontrada : 0;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (pecaAtiva && Number.isInteger(quantidade) && quantidade > faltante) {
    mensagem("A quantidade informada é maior que o saldo pendente de " + faltante + " unidade(s).", true);
  }
  const possuiNovaFoto = fotosPendentes.length > 0;
  document.getElementById("enviarConferencia").disabled = !pecaAtiva || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > faltante || !possuiNovaFoto;
}

// Envia a conferencia: comprime fotos, atualiza a peca localmente e persiste no servidor.
async function enviarConferencia() {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (envioEmAndamento || !remessa || !pecaAtiva) {
    return mensagem("Busque um código antes de enviar a conferência.", true);
  }
  const quantidade = Number(quantidadeEncontrada.value);
  const faltante = pecaAtiva.quantidade - pecaAtiva.encontrada;
  const codigoPeca = pecaAtiva.codigo;
  const remessaDoEnvio = remessa;
  const pecaDoEnvio = pecaAtiva;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > faltante) return mensagem("Informe uma quantidade entre 1 e " + faltante + ".", true);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!fotosPendentes.length) return mensagem("Adicione pelo menos 1 foto nesta conferência.", true);
  const botaoEnviar = document.getElementById("enviarConferencia");
  envioEmAndamento = true;
  botaoEnviar.disabled = true;
  mensagem("Comprimindo fotos...");
  let fotosComprimidas;
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    fotosComprimidas = await Promise.all([...fotosPendentes].map(comprimirFoto));
  } catch (_) { /* Captura falhas da operacao protegida acima. */
    mensagem("Não foi possível preparar as fotos. Tente selecionar a foto novamente.", true);
    envioEmAndamento = false;
    atualizarEstadoEnvio();
    return;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (remessa !== remessaDoEnvio || pecaAtiva !== pecaDoEnvio) {
    envioEmAndamento = false;
    mensagem("A remessa foi atualizada. Localize o código novamente antes de enviar.", true);
    atualizarEstadoEnvio();
    return;
  }

  const remessaEstavaConcluida = remessaConcluida(remessaDoEnvio);
  const encontradaAnterior = pecaDoEnvio.encontrada;
  const fotosAnteriores = [...obterFotosPeca(pecaDoEnvio)];
  const dataCriacaoAnterior = remessaDoEnvio.dataCriacao;
  const dataFinalizacaoAnterior = remessaDoEnvio.dataFinalizacao;
  const sessao = getAuthSession();
  const usuario = sessao && sessao.username ? String(sessao.username).trim() : "";
  pecaDoEnvio.encontrada += quantidade;
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const total = remessaDoEnvio.pecas.reduce((soma, peca) => soma + peca.quantidade, 0);
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  pecaDoEnvio.fotos = [...fotosAnteriores, ...fotosComprimidas.map(imagem => ({ imagem, usuario }))];
  const remessaEstaConcluida = remessaConcluida(remessaDoEnvio);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (remessaEstaConcluida && !remessaDoEnvio.dataFinalizacao) {
    remessaDoEnvio.dataFinalizacao = obterDataHoraAtualFormatada();
  } else if (!remessaEstaConcluida) { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
    delete remessaDoEnvio.dataFinalizacao;
  }
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!remessaDoEnvio.dataCriacao) {
    remessaDoEnvio.dataCriacao = obterDataHoraAtualFormatada();
  }
  const resultadoSalvar = await salvar();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!resultadoSalvar.sucesso) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (remessa === remessaDoEnvio && pecaAtiva === pecaDoEnvio) {
      pecaDoEnvio.encontrada = encontradaAnterior;
      pecaDoEnvio.fotos = fotosAnteriores;
      remessaDoEnvio.dataCriacao = dataCriacaoAnterior;
      remessaDoEnvio.dataFinalizacao = dataFinalizacaoAnterior;
    }
    envioEmAndamento = false;
    mensagem(resultadoSalvar.mensagem, true);
    atualizarEstadoEnvio();
    return;
  }

  const finalizadaAutomaticamente = !remessaEstavaConcluida && remessaEstaConcluida;
  envioEmAndamento = false;

  // Condicao: valida este caso antes de continuar o fluxo.
  if (finalizadaAutomaticamente) {
    remessa = null;
    pecaAtiva = null;
    fotosPendentes = [];
    sessionStorage.removeItem(chaveRemessaAtiva);
    document.getElementById("conteudoRemessa").hidden = true;
    document.getElementById("selecaoRemessa").hidden = false;
    renderizarRemessasRecentes();
    numeroBusca.value = "";
    mensagemBusca("Remessa finalizada com sucesso. Digite o código da próxima remessa.");
    numeroBusca.focus();
    return;
  }

  atualizarTela();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (total > 0 && remessaDoEnvio.pecas.every(peca => quantidadeConferidaPeca(peca)) && remessaDoEnvio.pecas.some(peca => pecaComFotoPendente(peca))) {
    mensagem("Conferência enviada: " + quantidade + " unidade(s) debitada(s) do código " + codigoPeca + ". Todas as quantidades foram debitadas, mas ainda há peça(s) com foto pendente.");
  } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
    mensagem("Conferência enviada: " + quantidade + " unidade(s) debitada(s) do código " + codigoPeca + ".");
  }
  limparPecaAtiva();
  codigoManual.value = "";
  codigoManual.focus();
  envioEmAndamento = false;
}

// Limpa o formulario da peca selecionada.
function limparPecaAtiva() {
  pecaAtiva = null;
  fotosPendentes = [];
  document.getElementById("formularioPeca").hidden = true;
  quantidadeEncontrada.value = "";
  quantidadeEncontrada.disabled = true;
}

// Salva a remessa atual via PUT e trata conflitos/erros de servidor.
async function salvar() {
  const indice = remessas.findIndex(item => normalizar(item.numero) === normalizar(remessa.numero));
  // Condicao: valida este caso antes de continuar o fluxo.
  if (indice < 0) return { sucesso: false, mensagem: "A remessa não está carregada nesta tela. Faça uma nova busca e tente novamente." };
  remessas[indice] = remessa;
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    const resposta = await fetch(API_BASE + "/api/remessas/" + encodeURIComponent(remessa.id || remessa.numero), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(remessa) });
    // Condicao: valida este caso antes de continuar o fluxo.
    if (resposta.status === 409) {
      const dados = await resposta.json();
      // Condicao: valida este caso antes de continuar o fluxo.
      if (dados.remessa) {
        remessa = dados.remessa;
        remessas[indice] = dados.remessa;
        limparPecaAtiva();
        atualizarTela();
        mensagem("⚠️ Outro usuário acabou de conferir esta remessa. Os dados foram atualizados.", true);
      }
      return { sucesso: false, mensagem: "A remessa foi alterada por outro usuário. Os dados mais recentes foram carregados; localize o código novamente." };
    }
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!resposta.ok) {
      let dados = {};
      // Bloco protegido: tenta executar uma operacao que pode falhar.
      try { dados = await resposta.json(); } catch (_) {}
      const mensagens = {
        404: "A remessa não foi encontrada no servidor. Faça uma nova busca.",
        413: "A foto ficou muito grande para envio. Tire uma nova foto e tente novamente.",
        500: "O servidor encontrou um erro ao armazenar a foto no Cloudflare R2. Tente novamente."
      };
      return {
        sucesso: false,
        mensagem: mensagens[resposta.status]
          || (resposta.status === 400 && dados.erro ? "O servidor rejeitou a conferência: " + dados.erro : "")
          || "O servidor não conseguiu salvar a conferência. Tente novamente."
      };
    }
    remessa = await resposta.json();
    remessas[indice] = remessa;
    return { sucesso: true };
  } catch (_) { /* Captura falhas da operacao protegida acima. */
    return { sucesso: false, mensagem: "Não foi possível acessar o servidor da aplicação. Verifique se o servidor está ativo e tente novamente." };
  }
}

// Aplica atualizacoes recebidas por SSE sem sobrescrever um envio em andamento.
function receberAtualizacaoTempoReal(atualizada) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!atualizada || !atualizada.id) return;
  const indice = remessas.findIndex(item => String(item.id || item.numero) === String(atualizada.id));
  // Condicao: valida este caso antes de continuar o fluxo.
  if (indice < 0) return;
  remessas[indice] = atualizada;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!remessa || String(remessa.id || remessa.numero) !== String(atualizada.id)) return;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (envioEmAndamento) return;
  const codigoAtivo = pecaAtiva?.codigo;
  remessa = atualizada;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (codigoAtivo) {
    const novaPeca = remessa.pecas.find(peca => normalizar(peca.codigo) === normalizar(codigoAtivo));
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!novaPeca || Number(novaPeca.encontrada) >= Number(novaPeca.quantidade)) {
      limparPecaAtiva();
      mensagem("🔄 Esta peça foi atualizada por outro usuário. Confira o saldo atual antes de continuar.", true);
    } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
      pecaAtiva = novaPeca;
      document.getElementById("quantidadeEncontrada").max = novaPeca.quantidade - novaPeca.encontrada;
      document.getElementById("limiteQuantidade").textContent = "Faltam " + (novaPeca.quantidade - novaPeca.encontrada) + " unidade(s).";
      atualizarFotos();
      atualizarEstadoEnvio();
      mensagem("🔄 Remessa atualizada em tempo real.");
    }
  }
  atualizarTela();
}

// Recalcula cards e tabela de pendencias da remessa aberta.
function atualizarTela() {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!remessa) return;
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const total = remessa.pecas.reduce((soma, peca) => soma + peca.quantidade, 0);
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const encontradas = remessa.pecas.reduce((soma, peca) => soma + peca.encontrada, 0);
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const pesoConferido = remessa.pecas.reduce((soma, peca) => soma + (peca.quantidade ? peca.pesoKg * peca.encontrada / peca.quantidade : 0), 0);
  document.getElementById("totalPecas").textContent = total;
  document.getElementById("pesoTotal").textContent = formatarKg(pesoConferido);
  document.getElementById("totalEncontradas").textContent = encontradas;
  document.getElementById("totalFaltantes").textContent = total - encontradas;
  document.getElementById("progresso").textContent = total ? Math.round(encontradas / total * 100) + "%" : "0%";
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  document.querySelector("tbody").innerHTML = remessa.pecas.filter(peca => !pecaConcluida(peca)).map(peca => {
    const faltante = peca.quantidade - peca.encontrada;
    const fotoPendente = pecaComFotoPendente(peca);
    const classe = fotoPendente ? "parcial" : !peca.encontrada ? "pendente" : "parcial";
    const status = fotoPendente ? "Foto pendente" : (faltante ? (peca.encontrada ? "Parcial" : "Pendente") : "Conferida");
    return `<tr><td>${escapar(peca.codigo)}</td><td>${escapar(peca.descricao || "—")}</td><td>${peca.quantidade}</td><td>${formatarKg(peca.pesoKg)}</td><td>${peca.encontrada}</td><td>${faltante}</td><td class="${classe}">${status}</td><td>${obterFotosPeca(peca).length} foto(s)</td></tr>`;
  }).join("") || "<tr><td colspan=\"8\">Todas as peças da remessa foram conferidas com foto.</td></tr>";
}

// Le arquivo de imagem como Data URL para pre-visualizacao/compressao.
function lerFoto(arquivo) { return new Promise((resolver, rejeitar) => { const leitor = new FileReader(); leitor.onload = () => resolver(leitor.result); leitor.onerror = rejeitar; leitor.readAsDataURL(arquivo); }); }

// Retorna uma URL segura para foto local ou foto ja publicada pela rota /uploads.
function escaparFoto(foto) {
  const imagem = typeof foto === "string" ? foto : foto?.imagem;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (typeof imagem !== "string") return "";
  const fonte = imagem.startsWith("/uploads/") ? API_BASE + imagem : imagem;
  return (/^data:image\/(?:jpeg|png|gif|webp);base64,/i.test(fonte)
    || /^\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)
    || /^https?:\/\/[^/]+\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)) ? escapar(fonte) : "";
}

// Redimensiona a foto para reduzir payload e padronizar envio como JPEG.
function comprimirFoto(dataUrl) {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image();
    imagem.onload = () => {
      const limite = 1000;
      const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      const contexto = canvas.getContext("2d");
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!contexto) return rejeitar(new Error("Canvas indisponível."));
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      const fotoComprimida = canvas.toDataURL("image/jpeg", 0.75);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!fotoComprimida.startsWith("data:image/")) return rejeitar(new Error("Formato de imagem inválido."));
      resolver(fotoComprimida);
    };
    imagem.onerror = rejeitar;
    imagem.src = dataUrl;
  });
}

// Formata data/hora no padrao exibido pelo sistema.
function obterDataHoraAtualFormatada() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
}

// Helpers pequenos de normalizacao, mensagem, escape HTML e formatacao de peso.
function normalizar(valor) { return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
// Funcao mensagem: executa esta parte da regra do sistema.
function mensagem(texto, erro = false) { const elemento = document.getElementById("mensagemLeitura"); elemento.textContent = texto; elemento.classList.toggle("erro", erro); }
// Funcao mensagemBusca: executa esta parte da regra do sistema.
function mensagemBusca(texto, erro = false) { const elemento = document.getElementById("mensagemBusca"); elemento.textContent = texto; elemento.classList.toggle("erro", erro); }
// Funcao escapar: executa esta parte da regra do sistema.
function escapar(valor) { const elemento = document.createElement("span"); elemento.textContent = valor; return elemento.innerHTML; }
// Funcao formatarKg: executa esta parte da regra do sistema.
function formatarKg(valor) { return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " kg"; }
