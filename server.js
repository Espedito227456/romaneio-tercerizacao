const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const clientesTempoReal = new Set();

const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const dataDirectory = path.join(root, "data");
const dataFile = path.join(dataDirectory, "remessas.json");
const limiteCorpo = 10 * 1024 * 1024;
const tiposPublicos = new Set([".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"]);

function lerRemessas() {
  try {
    const dados = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(dados) ? dados : [];
  } catch (_) { return []; }
}

function salvarRemessas(remessas) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporario = `${dataFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporario, JSON.stringify(remessas, null, 2), "utf8");
    fs.renameSync(temporario, dataFile);
  } catch (erro) {
    try { fs.rmSync(temporario, { force: true }); } catch (_) {}
    throw erro;
  }
}

function texto(valor, limite) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function normalizarIdentificador(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fotoValida(foto) {
  return typeof foto === "string"
    && foto.length <= 2500000
    && /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(foto);
}

function validarRemessa(valor, exigirVersao = false) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { erro: "Remessa invalida." };
  const numero = texto(valor.numero, 200);
  if (!numero || !normalizarIdentificador(numero) || !Array.isArray(valor.pecas) || valor.pecas.length === 0 || valor.pecas.length > 20000) {
    return { erro: "Remessa invalida." };
  }
  const versao = Number(valor.versao);
  if (exigirVersao && (!Number.isInteger(versao) || versao < 0)) return { erro: "Versao invalida." };
  const codigos = new Set();
  const pecas = [];
  for (const peca of valor.pecas) {
    if (!peca || typeof peca !== "object" || Array.isArray(peca)) return { erro: "Peca invalida." };
    const codigo = texto(peca.codigo, 200);
    const chaveCodigo = normalizarIdentificador(codigo);
    const quantidade = Number(peca.quantidade);
    const encontrada = peca.encontrada === undefined ? 0 : Number(peca.encontrada);
    const pesoKg = peca.pesoKg === undefined ? 0 : Number(peca.pesoKg);
    if (!codigo || !chaveCodigo || codigos.has(chaveCodigo) || !Number.isInteger(quantidade) || quantidade < 1
      || !Number.isInteger(encontrada) || encontrada < 0 || encontrada > quantidade
      || !Number.isFinite(pesoKg) || pesoKg < 0) return { erro: "Peca invalida." };
    const fotos = peca.fotos === undefined ? [] : peca.fotos;
    if (!Array.isArray(fotos) || fotos.length > 100 || fotos.some(foto => !fotoValida(foto))) {
      return { erro: "Evidencia invalida." };
    }
    codigos.add(chaveCodigo);
    pecas.push({
      codigo,
      descricao: texto(peca.descricao, 2000),
      quantidade,
      encontrada,
      pesoKg,
      fotos: [...fotos]
    });
  }
  const pesoTotalKg = valor.pesoTotalKg === undefined ? pecas.reduce((soma, peca) => soma + peca.pesoKg, 0) : Number(valor.pesoTotalKg);
  if (!Number.isFinite(pesoTotalKg) || pesoTotalKg < 0) return { erro: "Peso total invalido." };
  const informacoes = {};
  if (valor.informacoes && typeof valor.informacoes === "object" && !Array.isArray(valor.informacoes)) {
    Object.entries(valor.informacoes).slice(0, 100).forEach(([chave, informacao]) => {
      const nome = texto(chave, 200);
      const conteudo = texto(informacao, 1000);
      if (nome && conteudo) informacoes[nome] = conteudo;
    });
  }
  const id = texto(valor.id, 100);
  return {
    remessa: {
      numero,
      servico: texto(valor.servico, 500) || "—",
      produto: texto(valor.produto, 500) || "—",
      semana: texto(valor.semana, 20) || "—",
      informacoes,
      pesoTotalKg,
      pecas,
      ...(id ? { id } : {}),
      versao: Number.isInteger(versao) && versao >= 0 ? versao : 0
    }
  };
}

function prepararRemessa(remessa) {
  const validacao = validarRemessa(remessa);
  return validacao.remessa || null;
}

function emitirTempoReal(tipo, remessa) {
  const mensagem = `event: ${tipo}\ndata: ${JSON.stringify(remessa)}\n\n`;
  for (const res of clientesTempoReal) {
    try { res.write(mensagem); } catch (_) { clientesTempoReal.delete(res); }
  }
}

function gerarId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function responderJson(res, statusCode, dados) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    let bytes = 0;
    let encerrado = false;
    const rejeitar = mensagem => {
      if (encerrado) return;
      encerrado = true;
      const erro = new Error(mensagem);
      erro.statusCode = 413;
      reject(erro);
    };
    const tamanhoInformado = Number(req.headers["content-length"]);
    if (Number.isFinite(tamanhoInformado) && tamanhoInformado > limiteCorpo) {
      rejeitar("Payload muito grande.");
      req.resume();
      return;
    }
    req.on("data", parte => {
      if (encerrado) return;
      bytes += parte.length;
      if (bytes > limiteCorpo) {
        rejeitar("Payload muito grande.");
        corpo = "";
        req.resume();
        return;
      }
      corpo += parte;
    });
    req.on("end", () => {
      if (encerrado) return;
      encerrado = true;
      try { resolve(JSON.parse(corpo || "{}")); } catch (_) { reject(new Error("JSON invalido.")); }
    });
    req.on("error", erro => {
      if (!encerrado) {
        encerrado = true;
        reject(erro);
      }
    });
  });
}

function servirArquivo(res, urlPath) {
  let relativo;
  try { relativo = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath); } catch (_) { relativo = ""; }
  const extensao = path.extname(relativo).toLowerCase();
  const arquivo = path.resolve(root, "." + relativo.replace(/\\/g, "/"));
  const relativoSeguro = path.relative(root, arquivo);
  const partesSeguras = relativoSeguro.split(path.sep);
  const permitido = (partesSeguras.length === 1 && extensao === ".html")
    || ["assets", "css", "js"].includes(partesSeguras[0]);
  if (!permitido || !relativoSeguro || relativoSeguro.startsWith(".." + path.sep) || path.isAbsolute(relativoSeguro)
    || !tiposPublicos.has(extensao) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Arquivo nao encontrado.");
  }
  const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon" };
  res.writeHead(200, {
    "Content-Type": (tipos[path.extname(arquivo)] || "application/octet-stream") + "; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(arquivo).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/remessas" && req.method === "GET") {
    return responderJson(res, 200, lerRemessas().map(prepararRemessa).filter(Boolean));
  }

  if (url.pathname === "/api/tempo-real" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: conectado\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    clientesTempoReal.add(res);
    const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch (_) {} }, 15000);
    req.on("close", () => { clearInterval(heartbeat); clientesTempoReal.delete(res); });
    return;
  }

  if (url.pathname === "/api/remessas" && req.method === "POST") {
    try {
      const corpo = await lerCorpo(req);
      const remessas = lerRemessas();
      const validacao = validarRemessa(corpo);
      if (validacao.erro) return responderJson(res, 400, { erro: validacao.erro });
      const remessa = validacao.remessa;
      if (remessas.some(item => {
        const preparada = prepararRemessa(item);
        return preparada && normalizarIdentificador(preparada.numero) === normalizarIdentificador(remessa.numero);
      })) {
        return responderJson(res, 409, { erro: "Ja existe uma remessa com este numero." });
      }
      do { remessa.id = gerarId(); } while (remessas.some(item => item && String(item.id || "") === remessa.id));
      remessas.push(remessa);
      salvarRemessas(remessas);
      emitirTempoReal("remessa:criada", remessa);
      return responderJson(res, 201, remessa);
    } catch (erro) { return responderJson(res, erro.statusCode || 400, { erro: erro.message }); }
  }

  const correspondencia = url.pathname.match(/^\/api\/remessas\/([^/]+)$/);
  if (correspondencia && req.method === "PUT") {
    try {
      const corpo = await lerCorpo(req);
      const identificador = decodeURIComponent(correspondencia[1]);
      const remessas = lerRemessas();
      const indice = remessas.findIndex(item => String(item.id || item.numero) === identificador);
      if (indice < 0) return responderJson(res, 404, { erro: "Remessa nao encontrada." });
      const atual = prepararRemessa(remessas[indice]);
      if (!atual) return responderJson(res, 500, { erro: "Remessa armazenada invalida." });
      const validacao = validarRemessa(corpo, true);
      if (validacao.erro) return responderJson(res, 400, { erro: validacao.erro });
      const remessa = validacao.remessa;
      const versaoRecebida = remessa.versao;
      if (!Number.isInteger(versaoRecebida) || versaoRecebida !== atual.versao) {
        return responderJson(res, 409, { erro: "A remessa foi atualizada por outro usuario.", remessa: atual });
      }
      remessa.id = atual.id;
      remessa.versao = atual.versao + 1;
      remessas[indice] = remessa;
      salvarRemessas(remessas);
      emitirTempoReal("remessa:atualizada", remessa);
      return responderJson(res, 200, remessa);
    } catch (erro) { return responderJson(res, erro.statusCode || 400, { erro: erro.message }); }
  }

  servirArquivo(res, url.pathname);
});

servidor.listen(port, () => console.log(`Romaneio disponivel em http://localhost:${port}`));