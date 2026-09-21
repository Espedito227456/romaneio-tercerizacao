/*
  Tela de importacao de romaneio.
  Este arquivo le o Excel no navegador, transforma a planilha no formato da API
  e envia a remessa para o servidor antes de direcionar o usuario para conferencia.
*/

// Quando a pagina e aberta direto pelo arquivo local, as chamadas precisam apontar para o servidor local.
const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";

// Elementos principais do formulario de importacao.
const arquivo = document.getElementById("arquivo");
const mensagem = document.getElementById("arquivoSelecionado");
const formulario = document.getElementById("formImportacao");

// Mostra o nome do arquivo escolhido para o usuario conferir antes de importar.
arquivo.addEventListener("change", () => {
  mensagem.textContent = arquivo.files.length ? "Arquivo selecionado: " + arquivo.files[0].name : "";
});

// Processa o envio do formulario: valida arquivo, le o Excel, monta a remessa e grava via API.
formulario.addEventListener("submit", evento => {
  evento.preventDefault();

  // Condicao: valida este caso antes de continuar o fluxo.
  if (!arquivo.files.length) return alert("Selecione um arquivo Excel.");
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!window.XLSX) return alert("O leitor de planilhas não foi carregado. Atualize a página e tente novamente.");

  const leitor = new FileReader();

  leitor.onload = async resultado => {
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
      const livro = XLSX.read(resultado.target.result, { type: "array" });
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!livro.SheetNames.length) throw new Error("A planilha não contém abas.");

      const aba = livro.Sheets[livro.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json(aba, { header: 1, defval: "", raw: false });
      const remessa = lerRemessa(linhas);

      // Se o numero nao vier na planilha, usa o nome do arquivo como identificador inicial.
      if (!numeroValido(remessa.numero)) {
        remessa.numero = arquivo.files[0].name.replace(/\.[^.]+$/, " ").trim();
      }

      const resposta = await fetch(API_BASE + "/api/remessas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remessa)
      });

      // Condicao: valida este caso antes de continuar o fluxo.
      if (!resposta.ok) {
        let detalhe = "";
        // Bloco protegido: tenta executar uma operacao que pode falhar.
        try { detalhe = (await resposta.json()).erro || ""; } catch (_) {}
        throw new Error(detalhe || "O servidor recusou a remessa.");
      }

      window.location.assign("remessa.html");
    } catch (erro) { /* Captura falhas da operacao protegida acima. */
      alert("Não foi possível importar a planilha: " + erro.message);
    }
  };

  leitor.onerror = () => alert("Não foi possível ler o arquivo selecionado.");
  leitor.readAsArrayBuffer(arquivo.files[0]);
});

// Converte as linhas do Excel para o contrato usado pelo backend: dados gerais + lista de pecas.
function lerRemessa(linhas) {
  const cabecalho = localizarCabecalho(linhas);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!cabecalho) throw new Error("Não encontrei uma tabela com colunas de código e quantidade.");

  const colunas = cabecalho.colunas;
  const codigo = encontrarIndice(colunas, ["codigo", "cod", "sku", "referencia", "ref", "item"]);
  const descricao = encontrarIndice(colunas, ["descricao", "descricaodoproduto", "produto", "nome", "itemdescricao"]);
  const quantidade = encontrarIndice(colunas, ["qtd", "qtde", "quantidade", "quant", "volume"]);
  const peso = encontrarIndice(colunas, ["totalemkg", "totalkg", "kg", "peso", "pesototal", "pesokg"]);
  const agrupadas = new Map();

  // Agrupa linhas repetidas pelo mesmo codigo para somar quantidade e peso.
  linhas.slice(cabecalho.linha + 1).forEach(linha => {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (ehRodape(linha)) return;

    const cod = String(linha[codigo] || "").trim();
    const qtd = numero(linha[quantidade]);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!cod || !Number.isInteger(qtd) || qtd <= 0) return;

    const atual = agrupadas.get(cod) || {
      codigo: cod,
      descricao: descricao >= 0 ? String(linha[descricao] || "").trim() : "",
      quantidade: 0,
      encontrada: 0,
      pesoKg: 0
    };

    atual.quantidade += qtd;
    atual.pesoKg += peso >= 0 ? numero(linha[peso]) || 0 : 0;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!atual.descricao && descricao >= 0) atual.descricao = String(linha[descricao] || "").trim();
    agrupadas.set(cod, atual);
  });

  const pecas = [...agrupadas.values()];
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!pecas.length) throw new Error("Nenhum item válido foi encontrado abaixo do cabeçalho.");

  const dados = extrairDadosRemessa(linhas, cabecalho.linha);
  const numeroDetectado = detectarNumeroRemessa(linhas.slice(0, cabecalho.linha));
  // Condicao: valida este caso antes de continuar o fluxo.
  if (numeroDetectado) dados.numero = numeroDetectado;

  return {
    ...dados,
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    pesoTotalKg: pecas.reduce((soma, peca) => soma + peca.pesoKg, 0),
    pecas
  };
}

// Encontra a linha que mais parece cabecalho da tabela de pecas.
function localizarCabecalho(linhas) {
  let melhor = null;

  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  linhas.forEach((colunas, linha) => {
    const codigo = encontrarIndice(colunas, ["codigo", "cod", "sku", "referencia", "ref", "item"]);
    const quantidade = encontrarIndice(colunas, ["qtd", "qtde", "quantidade", "quant", "volume"]);
    // Condicao: valida este caso antes de continuar o fluxo.
    if (codigo < 0 || quantidade < 0) return;

    let pontuacao = 10;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (encontrarIndice(colunas, ["descricao", "descricaodoproduto", "produto", "nome"]) >= 0) pontuacao += 2;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (encontrarIndice(colunas, ["totalemkg", "totalkg", "kg", "peso", "pesototal", "pesokg"]) >= 0) pontuacao += 2;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!melhor || pontuacao > melhor.pontuacao) melhor = { linha, colunas, pontuacao };
  });

  return melhor;
}

// Extrai metadados da remessa que normalmente ficam acima da tabela de pecas.
function extrairDadosRemessa(linhas, linhaCabecalho) {
  const dados = { numero: "Remessa sem número", servico: "—", produto: "—", semana: "—", informacoes: {} };
  const campos = {
    numero: ["numero", "numerodaremessa", "remessa", "romaneio", "nremessa", "nromessa", "nromaneio", "documento"],
    semana: ["semana", "week", "semanadaremessa", "semanaemquefoifeito", "periodo"],
    servico: ["servico", "tipodeservico", "tipodeservicoprestado", "servicoprestado", "tipo"],
    produto: ["produto", "descricaodoproduto", "equipamento", "artigo"]
  };

  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  linhas.slice(0, linhaCabecalho).forEach(linha => {
    // Laco for: percorre uma lista ou intervalo para processar cada item.
    for (let indice = 0; indice < linha.length; indice += 1) {
      const texto = String(linha[indice] || "").trim();
      // Condicao: valida este caso antes de continuar o fluxo.
      if (!texto) continue;

      const separador = texto.match(/^([^:=-]+)\s*[:=-]\s*(.+)$/);
      const rotulo = normalizar(separador ? separador[1] : texto);
      const valor = separador ? separador[2].trim() : String(linha[indice + 1] || "").trim();
      // Condicao: valida este caso antes de continuar o fluxo.
      if (separador) dados.informacoes[rotulo] = valor;

      // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
      Object.entries(campos).forEach(([campo, nomes]) => {
        // Condicao: valida este caso antes de continuar o fluxo.
        if (!nomes.includes(rotulo)) return;

        const valorCampo = separador ? valor : String(linha[indice + 1] || "").trim();
        // Condicao: valida este caso antes de continuar o fluxo.
        if (!valorCampo) return;

        // Condicao: valida este caso antes de continuar o fluxo.
        if (campo === "semana") {
          const semana = normalizarSemana(valorCampo);
          // Condicao: valida este caso antes de continuar o fluxo.
          if (semana) dados.semana = semana;
        } else if (dados[campo] === (campo === "numero" ? "Remessa sem número" : "—")) { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
          dados[campo] = valorCampo;
        }
      });
    }
  });

  // Algumas planilhas antigas guardam a semana em colunas fixas sem rotulo claro.
  const semanaNasColunas = linhas.slice(0, linhaCabecalho)
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .map(linha => linha.slice(3, 8))
    .flat()
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .map(normalizarSemana)
    .find(Boolean);
  // Condicao: valida este caso antes de continuar o fluxo.
  if (dados.semana === "—" && semanaNasColunas) dados.semana = semanaNasColunas;

  // Compatibilidade com o layout legado: numero, servico, produto e semana na segunda linha.
  const dadosLegados = linhas[1] || [];
  // Condicao: valida este caso antes de continuar o fluxo.
  if (numeroValido(dadosLegados[0])) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (dados.numero === "Remessa sem número") dados.numero = String(dadosLegados[0]).trim();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (dados.servico === "—" && dadosLegados[1]) dados.servico = String(dadosLegados[1]).trim();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (dados.produto === "—" && dadosLegados[2]) dados.produto = String(dadosLegados[2]).trim();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (dados.semana === "—" && dadosLegados[3]) dados.semana = normalizarSemana(dadosLegados[3]) || String(dadosLegados[3]).trim();
  }

  return dados;
}

// Aceita semanas numericas de 1 a 54 e remove prefixos como "Semana" ou "Week".
function normalizarSemana(valor) {
  const texto = String(valor ?? "").trim().replace(/^\s*(?:semana|week)\s*/i, "");
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!/^\d{1,2}$/.test(texto)) return "";

  const semana = Number(texto);
  return semana >= 1 && semana <= 54 ? String(semana) : "";
}

// Procura a posicao de uma coluna comparando textos normalizados.
function encontrarIndice(colunas, nomes) {
  return colunas.findIndex(valor => nomes.includes(normalizar(valor)));
}

// Identifica linhas de total/subtotal para nao importar como peca.
function ehRodape(linha) {
  return linha
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .filter(Boolean)
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .map(valor => normalizar(valor))
    .some(valor => /^(total|totais|subtotal|pesototal|totalpeso|totalprodutos|totaldeprodutos|produtostotais|quantidadetotal|totaldequantidade|totalgeral)/.test(valor));
}

// Converte numeros com virgula decimal ou separadores de milhar para Number.
function numero(valor) {
  const texto = String(valor ?? "").trim();
  // Condicao: valida este caso antes de continuar o fluxo.
  if (!texto) return NaN;

  const limpo = texto.replace(/[^0-9,.-]/g, "");
  return limpo.includes(",") ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo);
}

// Remove acentos e caracteres nao alfanumericos para tornar buscas e comparacoes tolerantes.
function normalizar(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Alias mantido para compatibilidade com telas antigas que chamavam normalizarBusca.
function normalizarBusca(valor) {
  return normalizar(valor);
}

// Evita usar titulos de coluna ou textos genericos como numero da remessa.
function numeroValido(valor) {
  const numero = normalizar(valor);
  return numero && !["remessasemnumero", "deenvio", "tipodeservico", "servico", "descricaodosprodutos", "descricao", "produto", "semana"].includes(numero);
}

// Tenta encontrar o numero da remessa em textos rotulados ou em um codigo isolado no topo da planilha.
function detectarNumeroRemessa(linhas) {
  // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
  const textos = linhas.flat().map(valor => String(valor || "").trim()).filter(Boolean);
  const rotulado = textos
    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    .map(texto => texto.match(/^(?:remessa|romaneio|documento|numero|n[ºo])\b\s*(?:[:#=-]\s*)?(.+)$/i))
    .find(resultado => resultado && numeroValido(resultado[1]));

  // Condicao: valida este caso antes de continuar o fluxo.
  if (rotulado) return rotulado[1].trim();

  const isolado = textos.find(texto => /^[a-z0-9][a-z0-9._\/-]{2,}$/i.test(texto) && /\d/.test(texto));
  return isolado || "";
}
