let remessas = [];
let remessa = null;
let pecaAtiva = null;
let fotosPendentes = [];
const chaveRemessaAtiva = "remessaAtiva";

const canalTempoReal = new EventSource("/api/tempo-real");
canalTempoReal.addEventListener("remessa:atualizada", evento => receberAtualizacaoTempoReal(JSON.parse(evento.data)));
canalTempoReal.addEventListener("remessa:criada", evento => { try { carregarRemessas(); } catch (_) {} });

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
  return fetch("/api/remessas").then(resposta => resposta.ok ? resposta.json() : Promise.reject()).then(dados => dados.filter(item => item && Array.isArray(item.pecas)).map(item => ({
      ...item,
      pecas: item.pecas.filter(peca => peca && String(peca.codigo || "").trim() && Number.isInteger(Number(peca.quantidade)) && Number(peca.quantidade) > 0).map(peca => ({
        ...peca,
        codigo: String(peca.codigo).trim(),
        quantidade: Number(peca.quantidade),
        encontrada: Math.max(0, Math.min(Number(peca.quantidade), Number(peca.encontrada) || 0)),
        fotos: Array.isArray(peca.fotos) ? peca.fotos.filter(foto => typeof foto === "string" && foto.startsWith("data:image/")) : []
      }))
    })).filter(item => item.pecas.length));
}

carregarRemessas().then(dados => {
  remessas = dados;
  restaurarRemessaAtiva();
}).catch(() => mensagemBusca("Não foi possível conectar ao servidor.", true));

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
  document.getElementById("selecaoRemessa").hidden = true;
  document.getElementById("conteudoRemessa").hidden = false;
  document.getElementById("numeroRemessa").textContent = remessa.numero;
  document.getElementById("semanaRemessa").textContent = remessa.semana || "—";
  document.getElementById("tipoServico").textContent = remessa.servico || "—";
  document.getElementById("produtoRemessa").textContent = remessa.produto || "—";
  codigoManual.disabled = false;
  buscarCodigo.disabled = false;
  atualizarTela();
  codigoManual.focus();
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
  document.getElementById("fotosConferencia").innerHTML = fotosPendentes.map(foto => `<img class="miniatura-evidencia" src="${escapar(foto)}" alt="Foto da peça ${escapar(pecaAtiva.codigo)}">`).join("");
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
  const quantidade = Number(quantidadeEncontrada.value);
  const faltante = pecaAtiva.quantidade - pecaAtiva.encontrada;
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > faltante) return mensagem("Informe uma quantidade entre 1 e " + faltante + ".", true);
  if (!fotosPendentes.length) return mensagem("Adicione pelo menos 1 foto nesta conferência.", true);
  const botaoEnviar = document.getElementById("enviarConferencia");
  botaoEnviar.disabled = true;
  mensagem("Comprimindo fotos...");
  try {
    const fotosComprimidas = await Promise.all(fotosPendentes.map(comprimirFoto));
    pecaAtiva.encontrada += quantidade;
    pecaAtiva.fotos = [...(pecaAtiva.fotos || []), ...fotosComprimidas];
    if (!await salvar()) {
      mensagem("Não foi possível salvar a conferência.", true);
      atualizarEstadoEnvio();
      return;
    }
    atualizarTela();
    mensagem("Conferência enviada: " + quantidade + " unidade(s) debitada(s) do código " + pecaAtiva.codigo + ".");
    limparPecaAtiva();
    codigoManual.value = "";
    codigoManual.focus();
  } catch (_) {
    mensagem("Não foi possível comprimir as fotos.", true);
    atualizarEstadoEnvio();
  }
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
  if (indice < 0) return false;
  remessas[indice] = remessa;
  try {
    const resposta = await fetch("/api/remessas/" + encodeURIComponent(remessa.id || remessa.numero), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(remessa) });
    if (resposta.status === 409) {
      const dados = await resposta.json();
      if (dados.remessa) {
        remessa = dados.remessa;
        remessas[indice] = dados.remessa;
        limparPecaAtiva();
        atualizarTela();
        mensagem("⚠️ Outro usuário acabou de conferir esta remessa. Os dados foram atualizados.", true);
      }
      return false;
    }
    if (!resposta.ok) return false;
    remessa = await resposta.json();
    remessas[indice] = remessa;
    return true;
  } catch (_) { return false; }
}

function receberAtualizacaoTempoReal(atualizada) {
  if (!atualizada || !atualizada.id) return;
  const indice = remessas.findIndex(item => String(item.id || item.numero) === String(atualizada.id));
  if (indice < 0) return;
  remessas[indice] = atualizada;
  if (!remessa || String(remessa.id || remessa.numero) !== String(atualizada.id)) return;
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

function finalizarRemessa() {
  const total = remessa.pecas.reduce((soma, peca) => soma + peca.quantidade, 0);
  const encontradas = remessa.pecas.reduce((soma, peca) => soma + peca.encontrada, 0);
  if (encontradas !== total) return;
  remessa = null;
  pecaAtiva = null;
  fotosPendentes = [];
  sessionStorage.removeItem(chaveRemessaAtiva);
  document.getElementById("conteudoRemessa").hidden = true;
  document.getElementById("selecaoRemessa").hidden = false;
  numeroBusca.value = "";
  mensagemBusca("Remessa finalizada. Digite o código da próxima remessa.");
  numeroBusca.focus();
}

function lerFoto(arquivo) { return new Promise((resolver, rejeitar) => { const leitor = new FileReader(); leitor.onload = () => resolver(leitor.result); leitor.onerror = rejeitar; leitor.readAsDataURL(arquivo); }); }
function comprimirFoto(dataUrl) {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image();
    imagem.onload = () => {
      const limite = 1280;
      const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      canvas.getContext("2d").drawImage(imagem, 0, 0, canvas.width, canvas.height);
      resolver(canvas.toDataURL("image/jpeg", 0.72));
    };
    imagem.onerror = rejeitar;
    imagem.src = dataUrl;
  });
}
function normalizar(valor) { return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function mensagem(texto, erro = false) { const elemento = document.getElementById("mensagemLeitura"); elemento.textContent = texto; elemento.classList.toggle("erro", erro); }
function mensagemBusca(texto, erro = false) { const elemento = document.getElementById("mensagemBusca"); elemento.textContent = texto; elemento.classList.toggle("erro", erro); }
function escapar(valor) { const elemento = document.createElement("span"); elemento.textContent = valor; return elemento.innerHTML; }
function formatarKg(valor) { return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " kg"; }
