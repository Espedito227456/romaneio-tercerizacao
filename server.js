const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const clientesTempoReal = new Set();

const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const dataDirectory = path.join(root, "data");
const dataFile = path.join(dataDirectory, "remessas.json");

function lerRemessas() {
  try {
    const dados = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(dados) ? dados : [];
  } catch (_) { return []; }
}

function salvarRemessas(remessas) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(remessas, null, 2), "utf8");
}

function prepararRemessa(remessa) {
  if (!Number.isInteger(Number(remessa.versao))) remessa.versao = 0;
  remessa.versao = Number(remessa.versao);
  return remessa;
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
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    req.on("data", parte => {
      corpo += parte;
      if (corpo.length > 10 * 1024 * 1024) reject(new Error("Payload muito grande."));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(corpo || "{}")); } catch (_) { reject(new Error("JSON invalido.")); }
    });
    req.on("error", reject);
  });
}

function servirArquivo(res, urlPath) {
  const relativo = urlPath === "/" ? "/index.html" : urlPath;
  const arquivo = path.resolve(root, "." + relativo);
  if (!arquivo.startsWith(root) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Arquivo nao encontrado.");
  }
  const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
  res.writeHead(200, {
    "Content-Type": (tipos[path.extname(arquivo)] || "application/octet-stream") + "; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });
  fs.createReadStream(arquivo).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/remessas" && req.method === "GET") return responderJson(res, 200, lerRemessas().map(prepararRemessa));

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
      const remessa = await lerCorpo(req);
      if (!remessa.numero || !Array.isArray(remessa.pecas)) return responderJson(res, 400, { erro: "Remessa invalida." });
      remessa.id = remessa.id || gerarId();
      prepararRemessa(remessa);
      const remessas = lerRemessas();
      remessas.push(remessa);
      salvarRemessas(remessas);
      emitirTempoReal("remessa:criada", remessa);
      return responderJson(res, 201, remessa);
    } catch (erro) { return responderJson(res, 400, { erro: erro.message }); }
  }

  const correspondencia = url.pathname.match(/^\/api\/remessas\/([^/]+)$/);
  if (correspondencia && req.method === "PUT") {
    try {
      const remessa = await lerCorpo(req);
      if (!remessa.numero || !Array.isArray(remessa.pecas)) return responderJson(res, 400, { erro: "Remessa invalida." });
      const identificador = decodeURIComponent(correspondencia[1]);
      const remessas = lerRemessas();
      const indice = remessas.findIndex(item => String(item.id || item.numero) === identificador);
      if (indice < 0) return responderJson(res, 404, { erro: "Remessa nao encontrada." });
      const atual = prepararRemessa(remessas[indice]);
      const versaoRecebida = Number(remessa.versao);
      if (!Number.isInteger(versaoRecebida) || versaoRecebida !== atual.versao) {
        return responderJson(res, 409, { erro: "A remessa foi atualizada por outro usuario.", remessa: atual });
      }
      remessa.id = atual.id;
      remessa.versao = atual.versao + 1;
      remessas[indice] = remessa;
      salvarRemessas(remessas);
      emitirTempoReal("remessa:atualizada", remessa);
      return responderJson(res, 200, remessa);
    } catch (erro) { return responderJson(res, 400, { erro: erro.message }); }
  }

  servirArquivo(res, url.pathname);
});

servidor.listen(port, () => console.log(`Romaneio disponivel em http://localhost:${port}`));