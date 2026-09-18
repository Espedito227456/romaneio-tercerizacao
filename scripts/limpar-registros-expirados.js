require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { S3Client, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r2Bucket = process.env.R2_BUCKET_NAME;
const r2Endpoint = process.env.R2_ENDPOINT;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || !r2Bucket || !r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
  throw new Error("As variáveis do Supabase e do R2 são obrigatórias.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const r2 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey }
});

const PRAZO_DIAS = 90;
const limite = new Date(Date.now() - PRAZO_DIAS * 24 * 60 * 60 * 1000);

async function consultarTodos(tabela, colunas) {
  const { data, error } = await supabase.from(tabela).select(colunas);
  if (error) throw new Error(`Não foi possível consultar ${tabela}: ${error.message}`);
  return data || [];
}

async function apagarObjetosR2(chaves) {
  const unicas = [...new Set(chaves.filter(Boolean))];
  for (let inicio = 0; inicio < unicas.length; inicio += 1000) {
    const objetos = unicas.slice(inicio, inicio + 1000).map(Key => ({ Key }));
    const { Errors } = await r2.send(new DeleteObjectsCommand({
      Bucket: r2Bucket,
      Delete: { Objects: objetos, Quiet: false }
    }));
    if (Errors && Errors.length) {
      throw new Error(`Não foi possível apagar objetos do R2: ${Errors.map(item => item.Key || item.Code).join(", ")}`);
    }
  }
  return unicas.length;
}

async function excluirPeca(peca, fotosPorPeca, remessaIds) {
  const fotos = fotosPorPeca.get(peca.id) || [];
  await apagarObjetosR2(fotos.map(foto => foto.arquivo_key));

  const { error: pecaError } = await supabase.from("pecas").delete().eq("id", peca.id);
  if (pecaError) throw new Error(`Não foi possível excluir a peça ${peca.codigo || peca.id}: ${pecaError.message}`);

  remessaIds.add(peca.remessa_id);
  return { fotos: fotos.length, pecas: 1 };
}

async function principal() {
  const [pecas, conferencias, fotos] = await Promise.all([
    consultarTodos("pecas", "id, remessa_id, codigo"),
    consultarTodos("conferencias", "peca_id, created_at"),
    consultarTodos("fotos_pecas", "peca_id, arquivo_key")
  ]);

  const primeiraConferencia = new Map();
  for (const conferencia of conferencias) {
    if (!conferencia.peca_id || !conferencia.created_at) continue;
    const data = new Date(conferencia.created_at);
    if (Number.isNaN(data.getTime())) continue;
    const anterior = primeiraConferencia.get(conferencia.peca_id);
    if (!anterior || data < anterior) primeiraConferencia.set(conferencia.peca_id, data);
  }

  const fotosPorPeca = new Map();
  for (const foto of fotos) {
    if (!fotosPorPeca.has(foto.peca_id)) fotosPorPeca.set(foto.peca_id, []);
    fotosPorPeca.get(foto.peca_id).push(foto);
  }

  const expiradas = pecas.filter(peca => {
    const primeira = primeiraConferencia.get(peca.id);
    return primeira && primeira <= limite;
  });
  const remessaIds = new Set();
  let totalFotos = 0;
  for (const peca of expiradas) {
    const resultado = await excluirPeca(peca, fotosPorPeca, remessaIds);
    totalFotos += resultado.fotos;
  }

  let remessasExcluidas = 0;
  for (const remessaId of remessaIds) {
    const restantes = await supabase.from("pecas").select("id").eq("remessa_id", remessaId).limit(1);
    if (restantes.error) throw new Error(`Não foi possível verificar a remessa ${remessaId}: ${restantes.error.message}`);
    if (restantes.data && restantes.data.length > 0) continue;
    const { error } = await supabase.from("remessas").delete().eq("id", remessaId);
    if (error) throw new Error(`Não foi possível excluir a remessa ${remessaId}: ${error.message}`);
    remessasExcluidas += 1;
  }

  console.log(JSON.stringify({
    limite: limite.toISOString(),
    pecasExcluidas: expiradas.length,
    fotosExcluidas: totalFotos,
    remessasExcluidas
  }, null, 2));
}

principal().catch(erro => {
  console.error(erro.message);
  process.exitCode = 1;
});
