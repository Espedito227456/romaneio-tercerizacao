let remessas = [];
let remessa = null;
let pecaAtiva = null;
let fotosPendentes = [];
let envioEmAndamento = false;
const chaveRemessaAtiva = "remessaAtiva";

const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const canalTempoReal = new EventSource(API_BASE + "/api/tempo-real");
canalTempoReal.addEventListener("remessa:atualizada", evento => {
  try { receberAtualizacaoTempoReal(JSON.parse(evento.data)); } catch (_) {}
});
canalTempoReal.addEventListener("remessa:criada", () => {
  carregarRemessas().catch(() => mensagemBusca("Não foi possível atualizar as remessas.", true));
});

const numeroBusca = document.getElementById("numeroBusca");
const codigoManual = document.getElementById("codigoManual");
const buscarCodigo = document.getElementById("buscarCodigo");
const fotoConferencia = document.getElementById("fotoConferencia");
const quantidadeEncontrada = document.getElementById("quantidadeEncontrada");
const iniciarNovaRemessa = new URLSearchParams(window.location.search).get("nova") === "1";
if (iniciarNovaRemessa) {
  sessionStorage.removeItem(chaveRemessaAtiva);
  window.history.replaceState({}, "", "remessa.html");
}

document.getElementById("buscarRemessa").addEventListener("click", buscarRemessa);
numeroBusca.addEventListener("keydown", evento => {
  if (evento.key === "Enter") buscarRemessa();
});
buscarCodigo.addEventListener("click", localizarCodigo);
codigoManual.addEventListener("keydown", evento => {
  if (evento.key === "Enter") localizarCodigo();
});
fotoConferencia.addEventListener("change", adicionarFoto);
quantidadeEncontrada.addEventListener("input", atualizarEstadoEnvio);
document.getElementById("enviarConferencia").addEventListener("click", enviarConferencia);
document.querySelector(".botao-finalizar").addEventListener("click", finalizarRemessa);
document.getElementById("fecharModalRemessa").addEventListener("click", fecharModalRemessa);
document.getElementById("selecionarNovaRemessa").addEventListener("click", () => sessionStorage.removeItem(chaveRemessaAtiva));

function carregarRemessas() {
  return fetch(API_BASE + "/api/remessas").then(resposta => resposta.ok ? resposta.json() : Promise.reject()).then(dados => dados.filter(item => item && Array.isArray(item.pecas)).map(item => ({
      ...item,
      pecas: item.pecas.filter(peca => peca && String(peca.codigo || "").trim() && Number.isInteger(Number(peca.quantidade)) && Number(peca.quantidade) > 0).map(peca => ({
        ...peca,
        codigo: String(peca.codigo).trim(),
        quantidade: Number(peca.quantidade),
        encontrada: Math.max(0, Math.min(Number(peca.quantidade), Number(peca.encontrada) || 0)),
        fotos: Array.isArray(peca.fotos) ? peca.fotos.filter(foto => {
          const imagem = typeof foto === "string" ? foto : foto?.imagem;
          return typeof imagem === "string" && (imagem.startsWith("data:image/") || imagem.startsWith("/uploads/"));
        }) : []
      }))
    })).filter(item => item.pecas.length));
}

carregarRemessas().then(dados => {
  remessas = dados;
  renderizarRemessasRecentes();
  restaurarRemessaAtiva();
}).catch(() => {
  renderizarRemessasRecentes();
  mensagemBusca("Não foi possível conectar ao servidor.", true);
});

function obterChaveRecentes() {
  const sessao = typeof getAuthSession === "function" ? getAuthSession() : null;
  const usuario = sessao && sessao.username ? sessao.username.trim() : "geral";
  return "remessasRecentes_" + usuario;
}

function obterRemessasRecentes() {
  try {
    const chave = obterChaveRecentes();
    const dados = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch (_) {
    return [];
  }
}

function salvarRemessaRecente(numero) {
  if (!numero) return;
  try {
    const chave = obterChaveRecentes();
    let recentes = obterRemessasRecentes();
    recentes = recentes.filter(item => normalizar(item) !== normalizar(numero));
    recentes.unshift(String(numero).trim());
    recentes = recentes.slice(0, 5);
    localStorage.setItem(chave, JSON.stringify(recentes));
  } catch (_) {}
  renderizarRemessasRecentes();
}

function renderizarRemessasRecentes() {
  const container = document.getElementById("containerRemessasRecentes");
  const lista = document.getElementById("listaRemessasRecentes");
  if (!container || !lista) return;

  const recentes = obterRemessasRecentes();
  if (!recentes.length) {
    container.hidden = true;
    lista.innerHTML = "";
    return;
  }

  container.hidden = false;
  lista.innerHTML = recentes.map(num => `
    <button type="button" class="btn-remessa-recente" data-numero="${escapar(num)}" title="Abrir remessa ${escapar(num)}">
      📦 ${escapar(num)}
    </button>
  `).join("");

  lista.querySelectorAll(".btn-remessa-recente").forEach(botao => {
    botao.addEventListener("click", () => {
      const num = botao.getAttribute("data-numero");
      if (numeroBusca) {
        numeroBusca.value = num;
        buscarRemessa();
      }
    });
  });
}

function buscarRemessa() {
  const busca = normalizar(numeroBusca.value);
  const encontrada = remessas.find(item => {
    const codigo = normalizar(item.numero);
    return busca && (codigo === busca || codigo.endsWith(busca));
  });
  if (!encontrada) return mensagemBusca("Remessa não encontrada.", true);
  if (remessaConcluida(encontrada)) return abrirModalRemessaConcluida(encontrada);
  abrirRemessa(encontrada);
}

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
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  window.scrollTo(0, 0);
}

function restaurarRemessaAtiva() {
  const identificador = sessionStorage.getItem(chaveRemessaAtiva);
  if (!identificador) return;
  const encontrada = remessas.find(item => String(item.id || item.numero) === identificador);
  if (encontrada) abrirRemessa(encontrada);
  else sessionStorage.removeItem(chaveRemessaAtiva);
}

function remessaConcluida(item) {
  return item.pecas.length > 0 && item.pecas.every(peca => Number(peca.encontrada) >= Number(peca.quantidade));
}

function abrirModalRemessaConcluida(item) {
  salvarRemessaRecente(item.numero);
  const nomeRemessa = /^remessa\b/i.test(String(item.numero)) ? item.numero : "remessa " + item.numero;
  document.getElementById("mensagemRemessaConcluida").textContent = "A " + nomeRemessa + " já foi totalmente conferida. Consulte as fotos e os detalhes na tela de conferência.";
  document.getElementById("consultarRemessaConcluida").href = "conferencia-remessa.html?remessa=" + encodeURIComponent(item.numero);
  document.getElementById("modalRemessaConcluida").hidden = false;
  document.getElementById("fecharModalRemessa").focus();
}

function fecharModalRemessa() {
  document.getElementById("modalRemessaConcluida").hidden = true;
}

function localizarCodigo() {
  const codigo = codigoManual.value.trim();
  pecaAtiva = remessa?.pecas.find(peca => normalizar(peca.codigo) === normalizar(codigo)) || null;
  if (!pecaAtiva) {
    limparPecaAtiva();
    return mensagem("Código não encontrado nesta remessa.", true);
  }

  const quantidade = Number(pecaAtiva.quantidade);
  const encontrada = Number(pecaAtiva.encontrada);
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    limparPecaAtiva();
    return mensagem("A quantidade deste código não é válida na remessa.", true);
  }
  pecaAtiva.quantidade = quantidade;
  pecaAtiva.encontrada = Number.isInteger(encontrada) ? Math.max(0, Math.min(quantidade, encontrada)) : 0;
  if (pecaAtiva.encontrada >= quantidade) {
    limparPecaAtiva();
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

function adicionarFoto(evento) {
  const arquivo = evento.target.files[0];
  evento.target.value = "";
  if (!arquivo) return;
  if (!pecaAtiva) return mensagem("Busque o código antes de adicionar fotos.", true);
  if (!arquivo.type.startsWith("image/")) return mensagem("Selecione uma imagem válida.", true);
  if (fotosPendentes.length >= 5) return mensagem("O limite de 5 fotos nesta conferência foi atingido.", true);
  lerFoto(arquivo).then(foto => {
    fotosPendentes.push(foto);
    atualizarFotos();
    atualizarEstadoEnvio();
  }).catch(() => mensagem("Não foi possível carregar a foto.", true));
}

function atualizarFotos() {
  const fotosRegistradas = (pecaAtiva?.fotos || []).length;
  document.getElementById("contadorFotos").textContent = fotosPendentes.length + "/5 nesta conferência; " + fotosRegistradas + " acumulada(s)";
  document.getElementById("fotosConferencia").innerHTML = fotosPendentes.map(foto => `<img class="miniatura-evidencia" src="${escaparFoto(foto)}" alt="Foto da peça ${escapar(pecaAtiva.codigo)}">`).join("");
  fotoConferencia.disabled = fotosPendentes.length >= 5;
}

function atualizarEstadoEnvio() {
  const quantidade = Number(quantidadeEncontrada.value);
  const faltante = pecaAtiva ? pecaAtiva.quantidade - pecaAtiva.encontrada : 0;
  if (pecaAtiva && Number.isInteger(quantidade) && quantidade > faltante) {
    mensagem("A quantidade informada é maior que o saldo pendente de " + faltante + " unidade(s).", true);
  }
  const possuiNovaFoto = fotosPendentes.length > 0;
  document.getElementById("enviarConferencia").disabled = !pecaAtiva || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > faltante || !possuiNovaFoto;
}

async function enviarConferencia() {
  if (envioEmAndamento || !remessa || !pecaAtiva) {
    return mensagem("Busque um código antes de enviar a conferência.", true);
  }
  const quantidade = Number(quantidadeEncontrada.value);
  const faltante = pecaAtiva.quantidade - pecaAtiva.encontrada;
  const codigoPeca = pecaAtiva.codigo;
  const remessaDoEnvio = remessa;
  const pecaDoEnvio = pecaAtiva;
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > faltante) return mensagem("Informe uma quantidade entre 1 e " + faltante + ".", true);
  if (!fotosPendentes.length) return mensagem("Adicione pelo menos 1 foto nesta conferência.", true);
  const botaoEnviar = document.getElementById("enviarConferencia");
  envioEmAndamento = true;
  botaoEnviar.disabled = true;
  mensagem("Comprimindo fotos...");
  let fotosComprimidas;
  try {
    fotosComprimidas = await Promise.all([...fotosPendentes].map(comprimirFoto));
  } catch (_) {
    mensagem("Não foi possível preparar as fotos. Tente selecionar a foto novamente.", true);
    envioEmAndamento = false;
    atualizarEstadoEnvio();
    return;
  }

  if (remessa !== remessaDoEnvio || pecaAtiva !== pecaDoEnvio) {
    envioEmAndamento = false;
    mensagem("A remessa foi atualizada. Localize o código novamente antes de enviar.", true);
    atualizarEstadoEnvio();
    return;
  }

  const encontradaAnterior = pecaDoEnvio.encontrada;
  const fotosAnteriores = [...(pecaDoEnvio.fotos || [])];
  const dataCriacaoAnterior = remessaDoEnvio.dataCriacao;
  pecaDoEnvio.encontrada += quantidade;
  if (!remessaDoEnvio.dataCriacao) {
    remessaDoEnvio.dataCriacao = obterDataHoraAtualFormatada();
  }
  const sessao = getAuthSession();
  const usuario = sessao && sessao.username ? String(sessao.username).trim() : "";
  pecaDoEnvio.fotos = [...fotosAnteriores, ...fotosComprimidas.map(imagem => ({ imagem, usuario }))];
  const resultadoSalvar = await salvar();
  if (!resultadoSalvar.sucesso) {
    if (remessa === remessaDoEnvio && pecaAtiva === pecaDoEnvio) {
      pecaDoEnvio.encontrada = encontradaAnterior;
      pecaDoEnvio.fotos = fotosAnteriores;
      remessaDoEnvio.dataCriacao = dataCriacaoAnterior;
    }
    envioEmAndamento = false;
    mensagem(resultadoSalvar.mensagem, true);
    atualizarEstadoEnvio();
    return;
  }

  atualizarTela();
  mensagem("Conferência enviada: " + quantidade + " unidade(s) debitada(s) do código " + codigoPeca + ".");
  limparPecaAtiva();
  codigoManual.value = "";
  codigoManual.focus();
  envioEmAndamento = false;
}

function limparPecaAtiva() {
  pecaAtiva = null;
  fotosPendentes = [];
  document.getElementById("formularioPeca").hidden = true;
  quantidadeEncontrada.value = "";
  quantidadeEncontrada.disabled = true;
}

async function salvar() {
  const indice = remessas.findIndex(item => normalizar(item.numero) === normalizar(remessa.numero));
  if (indice < 0) return { sucesso: false, mensagem: "A remessa não está carregada nesta tela. Faça uma nova busca e tente novamente." };
  remessas[indice] = remessa;
  try {
    const resposta = await fetch(API_BASE + "/api/remessas/" + encodeURIComponent(remessa.id || remessa.numero), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(remessa) });
    if (resposta.status === 409) {
      const dados = await resposta.json();
      if (dados.remessa) {
        remessa = dados.remessa;
        remessas[indice] = dados.remessa;
        limparPecaAtiva();
        atualizarTela();
        mensagem("⚠️ Outro usuário acabou de conferir esta remessa. Os dados foram atualizados.", true);
      }
      return { sucesso: false, mensagem: "A remessa foi alterada por outro usuário. Os dados mais recentes foram carregados; localize o código novamente." };
    }
    if (!resposta.ok) {
      let dados = {};
      try { dados = await resposta.json(); } catch (_) {}
      const mensagens = {
        404: "A remessa não foi encontrada no servidor. Faça uma nova busca.",
        413: "A foto ficou muito grande para envio. Tire uma nova foto e tente novamente.",
        500: "O servidor encontrou um erro ao armazenar a foto. Verifique a pasta uploads e tente novamente."
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
  } catch (_) {
    return { sucesso: false, mensagem: "Não foi possível acessar o servidor da aplicação. Verifique se o servidor está ativo e tente novamente." };
  }
}

function receberAtualizacaoTempoReal(atualizada) {
  if (!atualizada || !atualizada.id) return;
  const indice = remessas.findIndex(item => String(item.id || item.numero) === String(atualizada.id));
  if (indice < 0) return;
  remessas[indice] = atualizada;
  if (!remessa || String(remessa.id || remessa.numero) !== String(atualizada.id)) return;
  if (envioEmAndamento) return;
  const codigoAtivo = pecaAtiva?.codigo;
  remessa = atualizada;
  if (codigoAtivo) {
    const novaPeca = remessa.pecas.find(peca => normalizar(peca.codigo) === normalizar(codigoAtivo));
    if (!novaPeca || Number(novaPeca.encontrada) >= Number(novaPeca.quantidade)) {
      limparPecaAtiva();
      mensagem("🔄 Esta peça foi atualizada por outro usuário. Confira o saldo atual antes de continuar.", true);
    } else {
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

function atualizarTela() {
  if (!remessa) return;
  const total = remessa.pecas.reduce((soma, peca) => soma + peca.quantidade, 0);
  const encontradas = remessa.pecas.reduce((soma, peca) => soma + peca.encontrada, 0);
  const pesoConferido = remessa.pecas.reduce((soma, peca) => soma + (peca.quantidade ? peca.pesoKg * peca.encontrada / peca.quantidade : 0), 0);
  document.getElementById("totalPecas").textContent = total;
  document.getElementById("pesoTotal").textContent = formatarKg(pesoConferido);
  document.getElementById("totalEncontradas").textContent = encontradas;
  document.getElementById("totalFaltantes").textContent = total - encontradas;
  document.getElementById("progresso").textContent = total ? Math.round(encontradas / total * 100) + "%" : "0%";
  const botaoFinalizar = document.querySelector(".botao-finalizar");
  const remessaCompleta = total > 0 && encontradas === total;
  botaoFinalizar.disabled = !remessaCompleta;
  botaoFinalizar.classList.toggle("ativo", remessaCompleta);
  document.querySelector("tbody").innerHTML = remessa.pecas.filter(peca => peca.encontrada < peca.quantidade).map(peca => {
    const faltante = peca.quantidade - peca.encontrada;
    const classe = !peca.encontrada ? "pendente" : faltante ? "parcial" : "conferida";
    return `<tr><td>${escapar(peca.codigo)}</td><td>${escapar(peca.descricao || "—")}</td><td>${peca.quantidade}</td><td>${formatarKg(peca.pesoKg)}</td><td>${peca.encontrada}</td><td>${faltante}</td><td class="${classe}">${faltante ? (peca.encontrada ? "Parcial" : "Pendente") : "Conferida"}</td><td>${(peca.fotos || []).length} foto(s)</td></tr>`;
  }).join("") || "<tr><td colspan=\"8\">Todas as peças da remessa foram encontradas.</td></tr>";
}

async function finalizarRemessa() {
  if (!remessa || envioEmAndamento) return;
  const total = remessa.pecas.reduce((soma, peca) => soma + peca.quantidade, 0);
  const encontradas = remessa.pecas.reduce((soma, peca) => soma + peca.encontrada, 0);
  if (encontradas !== total) return;
  
  envioEmAndamento = true;
  const dataFinalizacaoAnterior = remessa.dataFinalizacao;
  remessa.dataFinalizacao = obterDataHoraAtualFormatada();
  const resultadoSalvar = await salvar();
  if (!resultadoSalvar.sucesso) {
    remessa.dataFinalizacao = dataFinalizacaoAnterior;
    envioEmAndamento = false;
    mensagem("Não foi possível registrar a finalização da remessa. Tente novamente.", true);
    return;
  }
  envioEmAndamento = false;

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
}

function lerFoto(arquivo) { return new Promise((resolver, rejeitar) => { const leitor = new FileReader(); leitor.onload = () => resolver(leitor.result); leitor.onerror = rejeitar; leitor.readAsDataURL(arquivo); }); }
function escaparFoto(foto) {
  const imagem = typeof foto === "string" ? foto : foto?.imagem;
  if (typeof imagem !== "string") return "";
  const fonte = imagem.startsWith("/uploads/") ? API_BASE + imagem : imagem;
  return (/^data:image\/(?:jpeg|png|gif|webp);base64,/i.test(fonte)
    || /^\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)
    || /^https?:\/\/[^/]+\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)) ? escapar(fonte) : "";
}
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
      if (!contexto) return rejeitar(new Error("Canvas indisponível."));
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      const fotoComprimida = canvas.toDataURL("image/jpeg", 0.75);
      if (!fotoComprimida.startsWith("data:image/")) return rejeitar(new Error("Formato de imagem inválido."));
      resolver(fotoComprimida);
    };
    imagem.onerror = rejeitar;
    imagem.src = dataUrl;
  });
}
function obterDataHoraAtualFormatada() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
}

function normalizar(valor) { return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function mensagem(texto, erro = false) { const elemento = document.getElementById("mensagemLeitura"); elemento.textContent = texto; elemento.classList.toggle("erro", erro); }
function mensagemBusca(texto, erro = false) { const elemento = document.getElementById("mensagemBusca"); elemento.textContent = texto; elemento.classList.toggle("erro", erro); }
function escapar(valor) { const elemento = document.createElement("span"); elemento.textContent = valor; return elemento.innerHTML; }
function formatarKg(valor) { return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " kg"; }
