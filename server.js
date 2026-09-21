/*
  Servidor principal da aplicacao.
  Responsabilidades:
  - servir arquivos HTML/CSS/JS;
  - autenticar usuarios;
  - validar e persistir remessas no Supabase;
  - armazenar/recuperar fotos no Cloudflare R2;
  - avisar navegadores conectados via Server-Sent Events.
*/

require("dotenv").config();
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { createClient } = require("@supabase/supabase-js");
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Configuracao do Supabase usada com service role porque o servidor executa operacoes administrativas.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Condicao: valida este caso antes de continuar o fluxo.
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.");
}
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Configuracao do Cloudflare R2 usando a API compativel com S3.
const r2Bucket = process.env.R2_BUCKET_NAME;
const r2Endpoint = process.env.R2_ENDPOINT;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
// Condicao: valida este caso antes de continuar o fluxo.
if (!r2Bucket || !r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
  throw new Error("As variáveis do R2 são obrigatórias.");
}
const r2 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey }
});

// Respostas abertas pelo endpoint /api/tempo-real; cada resposta recebe eventos SSE.
const clientesTempoReal = new Set();

// A coluna arquivo_key na tabela fotos_pecas e NOT NULL. Quando o script de expiracao
// remove o arquivo do R2 apos 90 dias, essa string vazia marca "sem arquivo" mantendo
// o registro (usuario, peca, data) no banco. Em JavaScript "" e falsy assim como null,
// entao todas as checagens existentes (foto.arquivo_key ? ... : ...) já tratam esse
// caso como "foto expirada" sem nenhuma logica adicional.
const ARQUIVO_KEY_EXPIRADO = "";

const sessoes = new Map();
const TEMPO_SESSAO = 8 * 60 * 60 * 1000;

// Cria uma sessao simples em memoria para uso em rotas administrativas.
function criarSessao(usuario, tipo) {
  const token = crypto.randomBytes(32).toString("hex");

  sessoes.set(token, {
    usuario,
    tipo,
    expiraEm: Date.now() + TEMPO_SESSAO
  });

  return token;
}

// Le o token Bearer da requisicao, valida expiracao e retorna os dados da sessao.
function obterSessao(req) {
  const autorizacao = req.headers.authorization || "";

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!autorizacao.startsWith("Bearer ")) {
    return null;
  }

  const token = autorizacao.slice(7).trim();
  const sessao = sessoes.get(token);

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!sessao) {
    return null;
  }

  // Condicao: valida este caso antes de continuar o fluxo.
  if (sessao.expiraEm < Date.now()) {
    sessoes.delete(token);
    return null;
  }

  return sessao;
}

// Caminhos e limites gerais do servidor.
const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const dataDirectory = path.join(root, "data");
const dataFile = path.join(dataDirectory, "remessas.json");
const remessasDirectory = path.join(dataDirectory, "remessas");

// Funcao caminhoRemessa: executa esta parte da regra do sistema.
function caminhoRemessa(numero) {
  const nome = String(numero || "").trim();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!nome || nome === "." || nome === ".." || nome.includes("/") || nome.includes("\\")) return null;
  return path.join(remessasDirectory, `${nome}.json`);
}
const limiteCorpo = 10 * 1024 * 1024;
const tiposPublicos = new Set([".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"]);

// Funcoes legadas de arquivo JSON local, mantidas para compatibilidade com dados antigos.
function lerRemessasIndividuais() {
  fs.mkdirSync(remessasDirectory, { recursive: true });
  return fs.readdirSync(remessasDirectory)
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .filter(nome => nome.endsWith(".json"))
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .map(nome => {
      // Bloco protegido: tenta executar uma operacao que pode falhar.
      try {
        return JSON.parse(fs.readFileSync(path.join(remessasDirectory, nome), "utf8"));
      } catch (_) { /* Captura falhas da operacao protegida acima. */
        return null;
      }
    })
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .filter(Boolean);
}

// Funcao lerRemessa: executa esta parte da regra do sistema.
function lerRemessa(numero) {
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    return JSON.parse(fs.readFileSync(caminhoRemessa(numero), "utf8"));
  } catch (_) { /* Captura falhas da operacao protegida acima. */
    return null;
  }
}

// Funcao lerRemessas: executa esta parte da regra do sistema.
function lerRemessas() {
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    const dados = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(dados) ? dados : [];
  } catch (_) { /* Captura falhas da operacao protegida acima. */ return []; }
}

// Funcao salvarRemessas: executa esta parte da regra do sistema.
function salvarRemessas(remessas) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporario = `${dataFile}.${process.pid}.tmp`;
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try {
    fs.writeFileSync(temporario, JSON.stringify(remessas, null, 2), "utf8");
    fs.renameSync(temporario, dataFile);
  } catch (erro) { /* Captura falhas da operacao protegida acima. */
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try { fs.rmSync(temporario, { force: true }); } catch (_) {}
    throw erro;
  }
}

// Normaliza o usuario para comparacoes insensiveis a maiusculas/minusculas.
function normalizarUsuario(valor) {
  return String(valor || "").trim().toLowerCase();
}

// Gera hash seguro de senha com salt unico usando scrypt.
function gerarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return { hash, salt };
}

// Compara senha informada com hash salvo usando timingSafeEqual.
function senhaConfere(senha, hash, salt) {
  const calculado = crypto.scryptSync(senha, salt, 64);
  const armazenado = Buffer.from(hash, "hex");
  return calculado.length === armazenado.length && crypto.timingSafeEqual(calculado, armazenado);
}

// Busca usuario ativo/inativo no Supabase pelo nome normalizado.
async function buscarUsuario(usuario) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("usuario, usuario_normalizado, senha_hash, senha_salt, tipo, ativo")
    .eq("usuario_normalizado", normalizarUsuario(usuario))
    .maybeSingle();

  // Condicao: valida este caso antes de continuar o fluxo.
  if (error) throw new Error(`Não foi possível consultar o usuário: ${error.message}`);
  return data;
}

// Cria usuario comum no Supabase e trata duplicidade de nome.
async function criarUsuario(usuario, senhaHash, senhaSalt) {
  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      usuario,
      usuario_normalizado: normalizarUsuario(usuario),
      senha_hash: senhaHash,
      senha_salt: senhaSalt,
      tipo: "usuario",
      ativo: true
    })
    .select("usuario, tipo, ativo")
    .single();

  // Condicao: valida este caso antes de continuar o fluxo.
  if (error) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (error.code === "23505") {
      return { duplicado: true };
    }
    throw new Error(`Não foi possível cadastrar o usuário: ${error.message}`);
  }
  return data;
}

// Atualiza senha de um usuario ativo.
async function atualizarSenhaUsuario(usuario, senhaHash, senhaSalt) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ senha_hash: senhaHash, senha_salt: senhaSalt })
    .eq("usuario_normalizado", normalizarUsuario(usuario))
    .eq("ativo", true)
    .select("id")
    .maybeSingle();

  // Condicao: valida este caso antes de continuar o fluxo.
  if (error) throw new Error(`Não foi possível atualizar a senha: ${error.message}`);
  return data;
}

// Valida os campos minimos usados por login, cadastro e troca de senha.
function validarCredenciais(usuario, senha) {
  const nome = texto(usuario, 100);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!nome || nome.length < 3) return { erro: "Informe um usuário com pelo menos 3 caracteres." };
  // Condicao: valida este caso antes de continuar o fluxo.
  if (typeof senha !== "string" || senha.length < 6) return { erro: "A senha deve ter pelo menos 6 caracteres." };
  return { usuario: nome, senha };
}

// Corta textos recebidos para evitar campos enormes e normaliza espacos nas bordas.
function texto(valor, limite) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

// Gera chave comparavel para codigos/remessas removendo acentos e simbolos.
function normalizarIdentificador(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Aceita somente imagens em data URL dentro do limite enviado pelo front-end.
function fotoValida(foto) {
  return typeof foto === "string"
    && foto.length <= 2500000
    && /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(foto);
}

// Valida referencias de fotos ja salvas, expostas pela rota /uploads/:id.jpg.
function referenciaFotoValida(foto) {
  return typeof foto === "string" && /^\/uploads\/[a-z0-9_-]+\.jpg$/i.test(foto);
}

// Reconhece o marcador de foto expirada reenviado pelo front-end.
function fotoExpiradaValida(foto) {
  return typeof foto === "object" && foto !== null && foto.expirada === true
    && typeof foto.id === "string" && /^[0-9a-f-]{36}$/i.test(foto.id);
}

// Sanitiza nomes usados na chave do R2.
function nomeBaseFoto(codigo) {
  const base = String(codigo || "").trim().replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-");
  return base || "foto";
}

// Normaliza uma foto recebida: nova imagem, referencia existente ou marcador expirado.
function prepararFoto(foto) {
  // Uma foto "expirada" nao possui mais imagem (o arquivo ja foi removido do R2 apos
  // 90 dias), mas o registro (usuario, data) deve ser preservado. O cliente reenvia
  // esse objeto sem alteracoes a cada atualizacao da remessa, entao ele e aceito aqui
  // sem exigir uma imagem valida.
  if (fotoExpiradaValida(foto)) {
    const usuario = texto(foto.usuario, 100);
    return { expirada: true, id: foto.id, ...(usuario ? { usuario } : {}) };
  }
  const imagem = typeof foto === "string" ? foto : foto && foto.imagem;
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!fotoValida(imagem) && !referenciaFotoValida(imagem)) return null;
  const usuario = typeof foto === "object" && foto !== null ? texto(foto.usuario, 100) : "";
  return { imagem, ...(usuario ? { usuario } : {}) };
}

// Valida a remessa inteira antes de gravar: dados gerais, pecas, quantidades, peso e fotos.
function validarRemessa(valor, exigirVersao = false) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { erro: "Remessa invalida." };
  const numero = texto(valor.numero, 200);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!numero || !normalizarIdentificador(numero) || !Array.isArray(valor.pecas) || valor.pecas.length === 0 || valor.pecas.length > 20000) {
    return { erro: "Remessa invalida." };
  }
  const versao = Number(valor.versao);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (exigirVersao && (!Number.isInteger(versao) || versao < 0)) return { erro: "Versao invalida." };
  const codigos = new Set();
  const pecas = [];
  // Laco for: percorre uma lista ou intervalo para processar cada item.
  for (const peca of valor.pecas) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!peca || typeof peca !== "object" || Array.isArray(peca)) return { erro: "Peca invalida." };
    const codigo = texto(peca.codigo, 200);
    const chaveCodigo = normalizarIdentificador(codigo);
    const quantidade = Number(peca.quantidade);
    const encontrada = peca.encontrada === undefined ? 0 : Number(peca.encontrada);
    const pesoKg = peca.pesoKg === undefined ? 0 : Number(peca.pesoKg);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!codigo || !chaveCodigo || codigos.has(chaveCodigo) || !Number.isInteger(quantidade) || quantidade < 1
      || !Number.isInteger(encontrada) || encontrada < 0 || encontrada > quantidade
      || !Number.isFinite(pesoKg) || pesoKg < 0) return { erro: "Peca invalida." };
    const fotos = peca.fotos === undefined ? [] : peca.fotos;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!Array.isArray(fotos) || fotos.length > 100) {
      return { erro: "Evidencia invalida: lista de fotos ausente ou acima do limite." };
    }
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    const fotosPreparadas = fotos.map(prepararFoto);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (fotosPreparadas.some(foto => !foto)) {
      return { erro: `Evidencia invalida na peca ${codigo}: a foto nao e um JPEG valido ou uma referencia /uploads/*.jpg cadastrada no R2.` };
    }
    codigos.add(chaveCodigo);
    pecas.push({
      codigo,
      descricao: texto(peca.descricao, 2000),
      quantidade,
      encontrada,
      pesoKg,
      fotos: fotosPreparadas
    });
  }
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const pesoTotalKg = valor.pesoTotalKg === undefined ? pecas.reduce((soma, peca) => soma + peca.pesoKg, 0) : Number(valor.pesoTotalKg);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!Number.isFinite(pesoTotalKg) || pesoTotalKg < 0) return { erro: "Peso total invalido." };
  const informacoes = {};
  // Condicao: valida este caso antes de continuar o fluxo.
  if (valor.informacoes && typeof valor.informacoes === "object" && !Array.isArray(valor.informacoes)) {
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    Object.entries(valor.informacoes).slice(0, 100).forEach(([chave, informacao]) => {
      const nome = texto(chave, 200);
      const conteudo = texto(informacao, 1000);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (nome && conteudo) informacoes[nome] = conteudo;
    });
  }
  const id = texto(valor.id, 100);
  const dataCriacao = texto(valor.dataCriacao, 100);
  const dataFinalizacao = texto(valor.dataFinalizacao, 100);
  const data = texto(valor.data, 100);
  return {
    remessa: {
      numero,
      servico: texto(valor.servico, 500) || "—",
      produto: texto(valor.produto, 500) || "—",
      semana: texto(valor.semana, 20) || "—",
      ...(dataCriacao ? { dataCriacao } : {}),
      ...(dataFinalizacao ? { dataFinalizacao } : {}),
      ...(data ? { data } : {}),
      informacoes,
      pesoTotalKg,
      pecas,
      ...(id ? { id } : {}),
      versao: Number.isInteger(versao) && versao >= 0 ? versao : 0
    }
  };
}

// Mantem a interface antiga que retornava null quando a remessa nao era valida.
function prepararRemessa(remessa) {
  const validacao = validarRemessa(remessa);
  return validacao.remessa || null;
}

// Converte datas exibidas ao usuario para formato aceito pelo banco.
function converterDataBanco(valor) {
  const textoData = texto(valor, 100);
  const correspondencia = textoData.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!correspondencia) return null;
  const [, dia, mes, ano, hora = "00", minuto = "00"] = correspondencia;
  return `${ano}-${mes}-${dia} ${hora}:${minuto}:00`;
}

// Converte datas do banco para o formato usado nas telas.
function formatarDataAplicacao(valor) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!valor) return "";
  const data = new Date(valor);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (Number.isNaN(data.getTime())) return String(valor);
  // Funcao dois: concentra uma acao reutilizada neste arquivo.
  const dois = numero => String(numero).padStart(2, "0");
  return `${dois(data.getUTCDate())}/${dois(data.getUTCMonth() + 1)}/${data.getUTCFullYear()} ${dois(data.getUTCHours())}:${dois(data.getUTCMinutes())}`;
}

// Monta a chave final do objeto no R2 separando por remessa e codigo da peca.
function chaveFoto(remessaNumero, codigo, nome) {
  return `remessas/${nomeBaseFoto(remessaNumero)}/${nomeBaseFoto(codigo)}/${crypto.randomUUID()}-${nome}`;
}

// Envia uma foto JPEG nova para o R2 e retorna a chave gravada.
async function enviarFotoR2(remessaNumero, peca, foto) {
  const correspondencia = String(foto.imagem).match(/^data:image\/jpeg;base64,([a-z0-9+/=\s]+)$/i);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!correspondencia) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (referenciaFotoValida(foto.imagem)) return null;
    throw new Error("A evidencia deve estar no formato JPEG.");
  }
  const nome = `${nomeBaseFoto(peca.codigo)}.jpg`;
  const arquivoKey = chaveFoto(remessaNumero, peca.codigo, nome);
  await r2.send(new PutObjectCommand({
    Bucket: r2Bucket,
    Key: arquivoKey,
    Body: Buffer.from(correspondencia[1], "base64"),
    ContentType: "image/jpeg"
  }));
  return arquivoKey;
}

// Prefixo usado para procurar fotos de uma peca no R2.
function prefixoFotosR2(remessaNumero, codigo) {
  return `remessas/${nomeBaseFoto(remessaNumero)}/${nomeBaseFoto(codigo)}/`;
}

// Lista todas as chaves de foto existentes no R2 para uma peca.
async function listarChavesFotoR2(remessaNumero, codigo) {
  const prefixo = prefixoFotosR2(remessaNumero, codigo);
  const chaves = [];
  let continuationToken;
  // Laco de repeticao: continua executando enquanto houver dados pendentes.
  do {
    const resposta = await r2.send(new ListObjectsV2Command({
      Bucket: r2Bucket,
      Prefix: prefixo,
      ContinuationToken: continuationToken
    }));
    // Laco for: percorre uma lista ou intervalo para processar cada item.
    for (const objeto of resposta.Contents || []) {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (typeof objeto.Key === "string" && objeto.Key.startsWith(prefixo)) {
        chaves.push(objeto.Key);
      }
    }
    continuationToken = resposta.IsTruncated ? resposta.NextContinuationToken : undefined;
  } while (continuationToken);
  return chaves.sort();
}

// Resolve uma referencia /uploads/*.jpg para a chave real no R2 e metadados originais.
async function resolverFotoExistente(referencia, fotosExistentesPorId) {
  const idFoto = String(referencia || "").match(/^\/uploads\/([0-9a-f-]+)\.jpg$/i)?.[1];
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!idFoto) {
    throw new Error("A referência da foto é inválida.");
  }
  // Ao atualizar uma remessa as pecas antigas sao excluidas (o que apaga em cascata
  // as fotos_pecas correspondentes) antes da reinsercao. Por isso, referencias a fotos
  // ja existentes precisam ser resolvidas a partir do mapa carregado antes da exclusao
  // (que tambem preserva a data original de registro, usada no prazo de 90 dias);
  // a consulta ao banco abaixo serve apenas de fallback para outros cenarios.
  if (fotosExistentesPorId && fotosExistentesPorId.has(idFoto)) {
    return fotosExistentesPorId.get(idFoto);
  }
  const { data: fotoExistente, error: fotoConsultaError } = await supabase
    .from("fotos_pecas")
    .select("arquivo_key, usuario, created_at")
    .eq("id", idFoto)
    .maybeSingle();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (fotoConsultaError) throw new Error(`Não foi possível consultar a foto existente: ${fotoConsultaError.message}`);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!fotoExistente?.arquivo_key) {
    throw new Error("A foto informada não está cadastrada no Cloudflare R2.");
  }
  return { arquivoKey: fotoExistente.arquivo_key, usuario: fotoExistente.usuario, criadoEm: fotoExistente.created_at };
}

// Converte o id da foto no banco para a URL publica controlada pelo servidor.
function imagemFoto(id) {
  return `/uploads/${id}.jpg`;
}

// Garante que uma foto vinda do banco tenha ao menos id.
function fotoBancoValida(foto) {
  return !!(foto && foto.id);
}

// Recria registros de fotos no Supabase quando existem arquivos no R2 sem linha correspondente.
async function reconciliarFotosPeca(remessaNumero, peca) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!peca || !peca.id || Number(peca.quantidade_encontrada || 0) < 1) return peca;
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const fotosAtuais = Array.isArray(peca.fotos_pecas) ? peca.fotos_pecas.filter(fotoBancoValida) : [];
  const chavesR2 = await listarChavesFotoR2(remessaNumero, peca.codigo);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!chavesR2.length) {
    peca.fotos_pecas = fotosAtuais;
    return peca;
  }
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const chavesAtuais = new Set(fotosAtuais.map(foto => foto.arquivo_key));
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const chavesFaltantes = chavesR2.filter(chave => !chavesAtuais.has(chave));
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!chavesFaltantes.length) {
    peca.fotos_pecas = fotosAtuais;
    return peca;
  }
  const { data: inseridas, error } = await supabase
    .from("fotos_pecas")
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .insert(chavesFaltantes.map(arquivo_key => ({
      peca_id: peca.id,
      arquivo_key,
      nome_original: path.basename(arquivo_key),
      usuario: null
    })))
    .select("id, usuario, arquivo_key, created_at");
  // Condicao: valida este caso antes de continuar o fluxo.
  if (error) throw new Error(`Não foi possível reconciliar as fotos da peça ${peca.codigo}: ${error.message}`);
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  peca.fotos_pecas = [...fotosAtuais, ...(inseridas || [])].filter(fotoBancoValida);
  return peca;
}

// Aplica reconciliacao em todas as pecas de uma remessa carregada do banco.
async function reconciliarFotosRemessa(row) {
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!row || !Array.isArray(row.pecas) || !row.numero) return row;
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  await Promise.all(row.pecas.map(peca => reconciliarFotosPeca(row.numero, peca)));
  return row;
}

// Traduz nomes de colunas do banco para o formato consumido pelas telas.
function mapearRemessaBanco(row) {
  return {
    id: row.id,
    numero: row.numero,
    semana: row.semana || "—",
    ...(row.data_criacao ? { dataCriacao: formatarDataAplicacao(row.data_criacao) } : {}),
    ...(row.data_finalizacao ? { dataFinalizacao: formatarDataAplicacao(row.data_finalizacao) } : {}),
    pesoTotalKg: Number(row.peso_total_kg || 0),
    informacoes: {},
    versao: row.versao || 0,
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    pecas: (row.pecas || []).map(peca => ({
      id: peca.id,
      codigo: peca.codigo || "",
      descricao: peca.descricao || "",
      quantidade: Number(peca.quantidade_solicitada || 0),
      encontrada: Number(peca.quantidade_encontrada || 0),
      pesoKg: Number(peca.peso_kg || 0),
      // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
      fotos: (peca.fotos_pecas || []).filter(fotoBancoValida).map(foto => ({
        ...(foto.arquivo_key ? { imagem: imagemFoto(foto.id) } : { imagem: null, expirada: true }),
        id: foto.id,
        usuario: foto.usuario || "",
        dataRegistro: formatarDataAplicacao(foto.created_at)
      }))
    }))
  };
}

// Carrega todas as remessas com pecas e fotos para listagem no front-end.
async function carregarRemessasSupabase() {
  const { data, error } = await supabase
    .from("remessas")
    .select("id, numero, semana, data_criacao, peso_total_kg, versao, data_finalizacao, pecas(id, codigo, descricao, quantidade_solicitada, quantidade_encontrada, peso_kg, fotos_pecas(id, usuario, arquivo_key, created_at))")
    .order("created_at", { ascending: false });
  // Condicao: valida este caso antes de continuar o fluxo.
  if (error) throw new Error(`Não foi possível consultar as remessas: ${error.message}`);
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  await Promise.all((data || []).map(reconciliarFotosRemessa));
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  return data.map(mapearRemessaBanco);
}

// Carrega uma remessa por id UUID ou numero.
async function carregarRemessaSupabase(identificador) {
  const campo = /^[0-9a-f-]{36}$/i.test(identificador) ? "id" : "numero";
  const { data, error } = await supabase
    .from("remessas")
    .select("id, numero, semana, data_criacao, peso_total_kg, versao, data_finalizacao, pecas(id, codigo, descricao, quantidade_solicitada, quantidade_encontrada, peso_kg, fotos_pecas(id, usuario, arquivo_key, created_at))")
    .eq(campo, identificador)
    .maybeSingle();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (error) throw new Error(`Não foi possível consultar a remessa: ${error.message}`);
  await reconciliarFotosRemessa(data);
  return data;
}

// Insere pecas, conferencias e fotos depois de criar/atualizar a remessa.
async function inserirPecas(remessa, remessaId, fotosExistentesPorId = new Map()) {
  // Laco for: percorre uma lista ou intervalo para processar cada item.
  for (const peca of remessa.pecas) {
    const { data: pecaInserida, error } = await supabase.from("pecas").insert({
      remessa_id: remessaId,
      codigo: peca.codigo,
      descricao: peca.descricao,
      quantidade_solicitada: peca.quantidade,
      quantidade_encontrada: peca.encontrada,
      peso_kg: peca.pesoKg
    }).select("id").single();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (error) throw new Error(`Não foi possível salvar a peça ${peca.codigo}: ${error.message}`);

    // Condicao: valida este caso antes de continuar o fluxo.
    if (peca.encontrada > 0) {
      const { error: conferenciaError } = await supabase.from("conferencias").insert({
        peca_id: pecaInserida.id,
        quantidade: peca.encontrada,
        status: peca.encontrada === peca.quantidade ? "conferida" : "parcial"
      });
      // Condicao: valida este caso antes de continuar o fluxo.
      if (conferenciaError) throw new Error(`Não foi possível salvar a conferência: ${conferenciaError.message}`);
    }

    // Laco for: percorre uma lista ou intervalo para processar cada item.
    for (const foto of peca.fotos) {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (foto.expirada) {
        // Foto ja teve o arquivo removido do R2 apos o prazo de 90 dias. Preserva o
        // registro (usuario e data original) sem tentar restaurar nenhuma imagem.
        const existente = fotosExistentesPorId.get(foto.id);
        const { error: fotoExpiradaError } = await supabase.from("fotos_pecas").insert({
          peca_id: pecaInserida.id,
          arquivo_key: ARQUIVO_KEY_EXPIRADO,
          nome_original: `${nomeBaseFoto(peca.codigo)}.jpg`,
          usuario: foto.usuario || existente?.usuario || null,
          ...(existente?.criadoEm ? { created_at: existente.criadoEm } : {})
        });
        // Condicao: valida este caso antes de continuar o fluxo.
        if (fotoExpiradaError) throw new Error(`Não foi possível preservar o registro da foto expirada da peça ${peca.codigo}: ${fotoExpiradaError.message}`);
        continue;
      }
      const arquivoKey = await enviarFotoR2(remessa.numero, peca, foto);
      let arquivoKeyFinal = arquivoKey;
      let criadoEmFinal;
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!arquivoKeyFinal && referenciaFotoValida(foto.imagem)) {
        const existente = await resolverFotoExistente(foto.imagem, fotosExistentesPorId);
        arquivoKeyFinal = existente.arquivoKey;
        criadoEmFinal = existente.criadoEm;
      }
      const { error: fotoError } = await supabase.from("fotos_pecas").insert({
        peca_id: pecaInserida.id,
        arquivo_key: arquivoKeyFinal,
        nome_original: `${nomeBaseFoto(peca.codigo)}.jpg`,
        usuario: foto.usuario || null,
        ...(criadoEmFinal ? { created_at: criadoEmFinal } : {})
      });
      // Condicao: valida este caso antes de continuar o fluxo.
      if (fotoError) throw new Error(`Não foi possível salvar a foto da peça ${peca.codigo}: ${fotoError.message}`);
    }
  }
}

// Salva remessa no Supabase; em atualizacao substitui pecas para manter o payload como fonte da verdade.
async function salvarRemessaSupabase(remessa, id = null) {
  const dados = {
    numero: remessa.numero,
    semana: remessa.semana || null,
    data_criacao: converterDataBanco(remessa.dataCriacao),
    peso_total_kg: remessa.pesoTotalKg,
    versao: remessa.versao,
    data_finalizacao: converterDataBanco(remessa.dataFinalizacao)
  };
  let remessaSalva;
  let fotosExistentesPorId = new Map();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (id) {
    // As pecas atuais serao excluidas (e suas fotos_pecas removidas em cascata) para
    // dar lugar a reinsercao abaixo. Por isso o arquivo_key, o usuario e a data de
    // registro de cada foto precisam ser carregados agora, enquanto os registros ainda
    // existem, para que as referencias /uploads/*.jpg reenviadas pelo cliente sejam
    // resolvidas corretamente e o prazo de 90 dias de cada foto continue contando a
    // partir da data original (sem isso a foto vira "orfa" no R2, perde o usuario que
    // a registrou, e o prazo de expiracao reiniciaria a cada atualizacao da remessa).
    const { data: pecasAtuais, error: pecasAtuaisError } = await supabase
      .from("pecas")
      .select("id")
      .eq("remessa_id", id);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (pecasAtuaisError) throw new Error(`Não foi possível carregar as peças existentes: ${pecasAtuaisError.message}`);
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    const pecaIdsAtuais = (pecasAtuais || []).map(peca => peca.id);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (pecaIdsAtuais.length) {
      const { data: fotosAtuais, error: fotosAtuaisError } = await supabase
        .from("fotos_pecas")
        .select("id, arquivo_key, usuario, created_at")
        .in("peca_id", pecaIdsAtuais);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (fotosAtuaisError) throw new Error(`Não foi possível carregar as fotos existentes: ${fotosAtuaisError.message}`);
      // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
      fotosExistentesPorId = new Map((fotosAtuais || []).map(foto => [foto.id, {
        arquivoKey: foto.arquivo_key,
        usuario: foto.usuario,
        criadoEm: foto.created_at
      }]));
    }
    const { data, error } = await supabase.from("remessas").update(dados).eq("id", id).eq("versao", remessa.versao - 1).select("id").maybeSingle();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (error) throw new Error(`Não foi possível atualizar a remessa: ${error.message}`);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!data) return null;
    remessaSalva = data;
    const { error: deleteError } = await supabase.from("pecas").delete().eq("remessa_id", id);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (deleteError) throw new Error(`Não foi possível substituir as peças: ${deleteError.message}`);
  } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
    const { data, error } = await supabase.from("remessas").insert(dados).select("id").single();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (error) {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (error.code === "23505") return { duplicada: true };
      throw new Error(`Não foi possível criar a remessa: ${error.message}`);
    }
    remessaSalva = data;
  }
  await inserirPecas(remessa, remessaSalva.id, fotosExistentesPorId);
  return remessaSalva.id;
}

// Envia eventos em tempo real para todos os navegadores conectados.
function emitirTempoReal(tipo, remessa) {
  const mensagem = `event: ${tipo}\ndata: ${JSON.stringify(remessa)}\n\n`;
  // Laco for: percorre uma lista ou intervalo para processar cada item.
  for (const res of clientesTempoReal) {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try { res.write(mensagem); } catch (_) { clientesTempoReal.delete(res); }
  }
}

// Gerador legado de ids locais; mantido para compatibilidade com dados antigos.
function gerarId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// Padroniza respostas JSON da API com headers de seguranca/cache.
function responderJson(res, statusCode, dados) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(dados));
}

// Le e valida o corpo JSON, respeitando limite para evitar uploads exagerados.
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    let bytes = 0;
    let encerrado = false;
    // Funcao rejeitar: concentra uma acao reutilizada neste arquivo.
    const rejeitar = mensagem => {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (encerrado) return;
      encerrado = true;
      const erro = new Error(mensagem);
      erro.statusCode = 413;
      reject(erro);
    };
    const tamanhoInformado = Number(req.headers["content-length"]);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (Number.isFinite(tamanhoInformado) && tamanhoInformado > limiteCorpo) {
      rejeitar("Payload muito grande.");
      req.resume();
      return;
    }
    req.on("data", parte => {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (encerrado) return;
      bytes += parte.length;
      // Condicao: valida este caso antes de continuar o fluxo.
      if (bytes > limiteCorpo) {
        rejeitar("Payload muito grande.");
        corpo = "";
        req.resume();
        return;
      }
      corpo += parte;
    });
    req.on("end", () => {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (encerrado) return;
      encerrado = true;
      // Bloco protegido: tenta executar uma operacao que pode falhar.
      try { resolve(JSON.parse(corpo || "{}")); } catch (_) { reject(new Error("JSON invalido.")); }
    });
    req.on("error", erro => {
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!encerrado) {
        encerrado = true;
        reject(erro);
      }
    });
  });
}

// Serve arquivos publicos sem permitir acesso fora da pasta do projeto.
function servirArquivo(res, urlPath) {
  let relativo;
  // Bloco protegido: tenta executar uma operacao que pode falhar.
  try { relativo = decodeURIComponent(urlPath === "/" ? "/login.html" : urlPath); } catch (_) { relativo = ""; }
  const extensao = path.extname(relativo).toLowerCase();
  const arquivo = path.resolve(root, "." + relativo.replace(/\\/g, "/"));
  const relativoSeguro = path.relative(root, arquivo);
  const partesSeguras = relativoSeguro.split(path.sep);
  const permitido = (partesSeguras.length === 1 && extensao === ".html")
    || ["assets", "css", "js", "uploads"].includes(partesSeguras[0]);
  // Condicao: valida este caso antes de continuar o fluxo.
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

// Roteador HTTP principal: trata API, SSE, fotos e, por ultimo, arquivos estaticos.
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // Pre-flight CORS para permitir chamadas quando a pagina estiver aberta via file://.
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  // Login: valida credenciais, cria sessao em memoria e devolve perfil do usuario.
  if (url.pathname === "/api/login" && req.method === "POST") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const corpo = await lerCorpo(req);
      const validacao = validarCredenciais(corpo.usuario, corpo.senha);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (validacao.erro) return responderJson(res, 400, { erro: validacao.erro });
      const encontrado = await buscarUsuario(validacao.usuario);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (encontrado && encontrado.ativo && senhaConfere(validacao.senha, encontrado.senha_hash, encontrado.senha_salt)) {
        const tipo = encontrado.tipo === "admin" ? "admin" : "user";
        const token = criarSessao(encontrado.usuario, tipo);
        return responderJson(res, 200, { usuario: encontrado.usuario, tipo, token });
      }
      return responderJson(res, 401, { erro: "Usuário ou senha inválidos." });
    } catch (erro) { /* Captura falhas da operacao protegida acima. */ return responderJson(res, erro.statusCode || 400, { erro: erro.message }); }
  }

  // Cadastro: cria usuario comum com senha hasheada.
  if (url.pathname === "/api/cadastro" && req.method === "POST") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const corpo = await lerCorpo(req);
      const validacao = validarCredenciais(corpo.usuario, corpo.senha);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (validacao.erro) return responderJson(res, 400, { erro: validacao.erro });
      const { hash, salt } = gerarHashSenha(validacao.senha);
      const novoUsuario = await criarUsuario(validacao.usuario, hash, salt);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (novoUsuario.duplicado) {
        return responderJson(res, 409, { erro: "Este usuário já existe." });
      }
      return responderJson(res, 201, { usuario: novoUsuario.usuario, tipo: "user" });
    } catch (erro) { /* Captura falhas da operacao protegida acima. */ return responderJson(res, erro.statusCode || 400, { erro: erro.message }); }
  }

  // Troca de senha: atualiza hash/salt do usuario informado.
  if (url.pathname === "/api/trocar-senha" && req.method === "POST") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const corpo = await lerCorpo(req);
      const nome = texto(corpo.usuario, 100);
      const senha = corpo.senha;
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!nome) return responderJson(res, 400, { erro: "Usuário não informado." });
      // Condicao: valida este caso antes de continuar o fluxo.
      if (typeof senha !== "string" || senha.length < 6) return responderJson(res, 400, { erro: "A senha deve ter pelo menos 6 caracteres." });
      const { hash, salt } = gerarHashSenha(senha);
      const atualizado = await atualizarSenhaUsuario(nome, hash, salt);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!atualizado) return responderJson(res, 404, { erro: "Usuário não encontrado." });
      return responderJson(res, 200, { ok: true });
    } catch (erro) { /* Captura falhas da operacao protegida acima. */ return responderJson(res, erro.statusCode || 400, { erro: erro.message }); }
  }

  // Listagem: entrega todas as remessas no formato esperado pelas telas.
  if (url.pathname === "/api/remessas" && req.method === "GET") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      return responderJson(res, 200, await carregarRemessasSupabase());
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      return responderJson(res, 500, { erro: erro.message });
    }
  }

  // Tempo real: mantem uma conexao SSE aberta para notificar criacao/atualizacao/exclusao.
  if (url.pathname === "/api/tempo-real" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*"
    });
    res.write(`event: conectado\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    clientesTempoReal.add(res);
    const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch (_) {} }, 15000);
    req.on("close", () => { clearInterval(heartbeat); clientesTempoReal.delete(res); });
    return;
  }

  // Criacao de remessa importada pelo Excel.
  if (url.pathname === "/api/remessas" && req.method === "POST") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const corpo = await lerCorpo(req);
      const validacao = validarRemessa(corpo);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (validacao.erro) return responderJson(res, 400, { erro: validacao.erro });
      const remessa = validacao.remessa;
      const id = await salvarRemessaSupabase(remessa);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (id && id.duplicada) return responderJson(res, 409, { erro: "Ja existe uma remessa com este numero." });
      const salva = await carregarRemessaSupabase(id);
      const resposta = mapearRemessaBanco(salva);
      emitirTempoReal("remessa:criada", resposta);
      return responderJson(res, 201, resposta);
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      return responderJson(res, erro.statusCode || 400, { erro: erro.message });
    }
  }

  const correspondencia = url.pathname.match(/^\/api\/remessas\/([^/]+)$/);

  // Atualizacao de remessa durante conferencia, com controle de versao contra concorrencia.
  if (correspondencia && req.method === "PUT") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const corpo = await lerCorpo(req);
      const identificador = decodeURIComponent(correspondencia[1]);

      const atualBanco = await carregarRemessaSupabase(identificador);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!atualBanco) return responderJson(res, 404, { erro: "Remessa nao encontrada." });
      const atual = mapearRemessaBanco(atualBanco);

      const validacao = validarRemessa(corpo, true);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (validacao.erro) return responderJson(res, 400, { erro: validacao.erro });

      const remessa = validacao.remessa;
      const versaoRecebida = remessa.versao;

      // Condicao: valida este caso antes de continuar o fluxo.
      if (!Number.isInteger(versaoRecebida) || versaoRecebida !== atual.versao) {
        return responderJson(res, 409, {
          erro: "A remessa foi atualizada por outro usuario.",
          remessa: atual
        });
      }

      remessa.versao = atual.versao + 1;
      const id = await salvarRemessaSupabase(remessa, atual.id);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!id) {
        const concorrente = await carregarRemessaSupabase(atual.id);
        return responderJson(res, 409, {
          erro: "A remessa foi atualizada por outro usuario.",
          remessa: concorrente ? mapearRemessaBanco(concorrente) : atual
        });
      }
      const salva = await carregarRemessaSupabase(id);
      const resposta = mapearRemessaBanco(salva);
      emitirTempoReal("remessa:atualizada", resposta);
      return responderJson(res, 200, resposta);
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      return responderJson(res, erro.statusCode || 400, { erro: erro.message });
    }
  }


  const correspondenciaDelete = url.pathname.match(/^\/api\/remessas\/([^/]+)$/);

  // Exclusao de remessa restrita a administrador autenticado por token Bearer.
  if (correspondenciaDelete && req.method === "DELETE") {
    const sessao = obterSessao(req);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!sessao || sessao.tipo !== "admin") {
      return responderJson(res, 403, { erro: "Apenas administradores podem excluir remessas." });
    }
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const identificador = decodeURIComponent(correspondenciaDelete[1]);
      const remessaBanco = await carregarRemessaSupabase(identificador);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!remessaBanco) {
        return responderJson(res, 404, { erro: "Remessa nao encontrada." });
      }
      const remessa = mapearRemessaBanco(remessaBanco);
      const { error } = await supabase.from("remessas").delete().eq("id", remessaBanco.id);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (error) throw new Error(`Não foi possível excluir a remessa: ${error.message}`);
      emitirTempoReal("remessa:excluida", remessa);
      return responderJson(res, 200, {
        mensagem: "Remessa excluida com sucesso.",
        numero: remessa.numero
      });
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      return responderJson(res, erro.statusCode || 400, { erro: erro.message });
    }
  }

  const fotoCorrespondencia = url.pathname.match(/^\/uploads\/([0-9a-f-]+)\.jpg$/i);

  // Foto publica: troca o id da foto por uma URL assinada temporaria do R2.
  if (fotoCorrespondencia && req.method === "GET") {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const { data, error } = await supabase.from("fotos_pecas").select("arquivo_key").eq("id", fotoCorrespondencia[1]).maybeSingle();
      // Condicao: valida este caso antes de continuar o fluxo.
      if (error) throw new Error(`Não foi possível consultar a foto: ${error.message}`);
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!data || !data.arquivo_key) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(data ? "Foto expirada: o arquivo foi removido do armazenamento apos 90 dias." : "Foto nao encontrada.");
      }
      const signedUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: r2Bucket, Key: data.arquivo_key }), { expiresIn: 300 });
      res.writeHead(302, { Location: signedUrl, "Cache-Control": "private, max-age=240" });
      return res.end();
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      return responderJson(res, 500, { erro: erro.message });
    }
  }

  servirArquivo(res, url.pathname);
});

servidor.listen(port, () => console.log(`Romaneio disponivel em http://localhost:${port}`));
