require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { S3Client, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

// Este script NUNCA exclui remessas, pecas ou conferencias: esses dados sao mantidos
// indefinidamente no Supabase para uso em relatorios/dashboard. Apenas o ARQUIVO da
// foto no Cloudflare R2 e removido apos 90 dias, contados individualmente a partir da
// data de registro de CADA foto (independente do codigo da peca ou da remessa). O
// registro da foto (id, peca_id, usuario, data de registro) e preservado no Supabase;
// como a coluna arquivo_key e NOT NULL, usamos uma string vazia para marcar "sem
// arquivo" (o mesmo valor usado por server.js), mantendo o historico de quem fez a
// conferencia disponivel mesmo sem a imagem.
const ARQUIVO_KEY_EXPIRADO = "";

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
const TAMANHO_PAGINA = 1000;
const limite = new Date(Date.now() - PRAZO_DIAS * 24 * 60 * 60 * 1000);

async function buscarFotosExpiradas() {
  const fotos = [];
  let inicio = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("fotos_pecas")
      .select("id, arquivo_key, created_at")
      .neq("arquivo_key", ARQUIVO_KEY_EXPIRADO)
      .lte("created_at", limite.toISOString())
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw new Error(`Não foi possível consultar as fotos expiradas: ${error.message}`);
    fotos.push(...(data || []));
    if (!data || data.length < TAMANHO_PAGINA) break;
    inicio += TAMANHO_PAGINA;
  }
  return fotos;
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

async function limparReferenciasNoBanco(ids) {
  const TAMANHO_LOTE = 500;
  for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_LOTE) {
    const lote = ids.slice(inicio, inicio + TAMANHO_LOTE);
    const { error } = await supabase
      .from("fotos_pecas")
      .update({ arquivo_key: ARQUIVO_KEY_EXPIRADO })
      .in("id", lote);
    if (error) throw new Error(`Não foi possível atualizar os registros expirados: ${error.message}`);
  }
}

async function principal() {
  const expiradas = await buscarFotosExpiradas();
  if (!expiradas.length) {
    console.log(JSON.stringify({ limite: limite.toISOString(), fotosExpiradas: 0 }, null, 2));
    return;
  }

  const chaves = expiradas.map(foto => foto.arquivo_key);
  const totalApagado = await apagarObjetosR2(chaves);

  const ids = expiradas.map(foto => foto.id);
  await limparReferenciasNoBanco(ids);

  console.log(JSON.stringify({
    limite: limite.toISOString(),
    fotosExpiradas: expiradas.length,
    objetosApagadosNoR2: totalApagado
  }, null, 2));
}

principal().catch(erro => {
  console.error(erro.message);
  process.exitCode = 1;
});
