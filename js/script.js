const API_BASE=window.location.protocol==="file:"?"http://localhost:3000":"";
const arquivo=document.getElementById("arquivo"),mensagem=document.getElementById("arquivoSelecionado"),formulario=document.getElementById("formImportacao");
arquivo.addEventListener("change",()=>mensagem.textContent=arquivo.files.length?"Arquivo selecionado: "+arquivo.files[0].name:"");
formulario.addEventListener("submit",evento=>{evento.preventDefault();if(!arquivo.files.length)return alert("Selecione um arquivo Excel.");if(!window.XLSX)return alert("O leitor de planilhas não foi carregado. Atualize a página e tente novamente.");
const leitor=new FileReader();leitor.onload=async resultado=>{try{const livro=XLSX.read(resultado.target.result,{type:"array"});if(!livro.SheetNames.length)throw new Error("A planilha não contém abas.");const aba=livro.Sheets[livro.SheetNames[0]],linhas=XLSX.utils.sheet_to_json(aba,{header:1,defval:"",raw:false}),remessa=lerRemessa(linhas);if(!numeroValido(remessa.numero))remessa.numero=arquivo.files[0].name.replace(/\.[^.]+$/," ").trim();const resposta=await fetch(API_BASE+"/api/remessas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(remessa)});if(!resposta.ok){let detalhe="";try{detalhe=(await resposta.json()).erro||""}catch(_){}throw new Error(detalhe||"O servidor recusou a remessa.");}window.location.assign("remessa.html")}catch(erro){alert("Não foi possível importar a planilha: "+erro.message)}};leitor.onerror=()=>alert("Não foi possível ler o arquivo selecionado.");leitor.readAsArrayBuffer(arquivo.files[0])});

function lerRemessa(linhas){const cabecalho=localizarCabecalho(linhas);if(!cabecalho)throw new Error("Não encontrei uma tabela com colunas de código e quantidade.");const colunas=cabecalho.colunas,codigo=encontrarIndice(colunas,["codigo","cod","sku","referencia","ref","item"]),descricao=encontrarIndice(colunas,["descricao","descricaodoproduto","produto","nome","itemdescricao"]),quantidade=encontrarIndice(colunas,["qtd","qtde","quantidade","quant","volume"]),peso=encontrarIndice(colunas,["totalemkg","totalkg","kg","peso","pesototal","pesokg"]);const agrupadas=new Map();
	linhas.slice(cabecalho.linha+1).forEach(linha=>{if(ehRodape(linha))return;const cod=String(linha[codigo]||"").trim(),qtd=numero(linha[quantidade]);if(!cod||!Number.isInteger(qtd)||qtd<=0)return;const atual=agrupadas.get(cod)||{codigo:cod,descricao:descricao>=0?String(linha[descricao]||"").trim():"",quantidade:0,encontrada:0,pesoKg:0};atual.quantidade+=qtd;atual.pesoKg+=peso>=0?numero(linha[peso])||0:0;if(!atual.descricao&&descricao>=0)atual.descricao=String(linha[descricao]||"").trim();agrupadas.set(cod,atual)});

	const pecas=[...agrupadas.values()];if(!pecas.length)throw new Error("Nenhum item válido foi encontrado abaixo do cabeçalho.");const dados=extrairDadosRemessa(linhas,cabecalho.linha),numeroDetectado=detectarNumeroRemessa(linhas.slice(0,cabecalho.linha));if(numeroDetectado)dados.numero=numeroDetectado;return{...dados,pesoTotalKg:pecas.reduce((soma,peca)=>soma+peca.pesoKg,0),pecas};
}

function localizarCabecalho(linhas){let melhor=null;linhas.forEach((colunas,linha)=>{const codigo=encontrarIndice(colunas,["codigo","cod","sku","referencia","ref","item"]),quantidade=encontrarIndice(colunas,["qtd","qtde","quantidade","quant","volume"]);if(codigo<0||quantidade<0)return;let pontuacao=10;if(encontrarIndice(colunas,["descricao","descricaodoproduto","produto","nome"])>=0)pontuacao+=2;if(encontrarIndice(colunas,["totalemkg","totalkg","kg","peso","pesototal","pesokg"])>=0)pontuacao+=2;if(!melhor||pontuacao>melhor.pontuacao)melhor={linha,colunas,pontuacao};});
	return melhor;
}

function extrairDadosRemessa(linhas,linhaCabecalho){const dados={numero:"Remessa sem número",servico:"—",produto:"—",semana:"—",informacoes:{}};const campos={numero:["numero","numerodaremessa","remessa","romaneio","nremessa","nromessa","nromaneio","documento"],semana:["semana","week","semanadaremessa","semanaemquefoifeito","periodo"],servico:["servico","tipodeservico","tipodeservicoprestado","servicoprestado","tipo"],produto:["produto","descricaodoproduto","equipamento","artigo"]};

	linhas.slice(0,linhaCabecalho).forEach(linha=>{for(let indice=0;indice<linha.length;indice+=1){const texto=String(linha[indice]||"").trim();if(!texto)continue;const separador=texto.match(/^([^:=-]+)\s*[:=-]\s*(.+)$/);const rotulo=normalizar(separador?separador[1]:texto),valor=separador?separador[2].trim():String(linha[indice+1]||"").trim();if(separador)dados.informacoes[rotulo]=valor;Object.entries(campos).forEach(([campo,nomes])=>{if(!nomes.includes(rotulo))return;const valorCampo=separador?valor:String(linha[indice+1]||"").trim();if(!valorCampo)return;if(campo==="semana"){const semana=normalizarSemana(valorCampo);if(semana)dados.semana=semana;}else if(dados[campo]===(campo==="numero"?"Remessa sem número":"—")){dados[campo]=valorCampo;}});}});
	const semanaNasColunas = linhas.slice(0,linhaCabecalho).map(linha => linha.slice(3,8)).flat().map(normalizarSemana).find(Boolean);
	if(dados.semana === "—" && semanaNasColunas) dados.semana = semanaNasColunas;
	const dadosLegados=linhas[1]||[];if(numeroValido(dadosLegados[0])){if(dados.numero==="Remessa sem número")dados.numero=String(dadosLegados[0]).trim();if(dados.servico==="—"&&dadosLegados[1])dados.servico=String(dadosLegados[1]).trim();if(dados.produto==="—"&&dadosLegados[2])dados.produto=String(dadosLegados[2]).trim();if(dados.semana==="—"&&dadosLegados[3])dados.semana=normalizarSemana(dadosLegados[3])||String(dadosLegados[3]).trim();}return dados;
}

function normalizarSemana(valor){const texto=String(valor??"").trim().replace(/^\s*(?:semana|week)\s*/i,"");if(!/^\d{1,2}$/.test(texto))return "";const semana=Number(texto);return semana>=1&&semana<=54?String(semana):"";}

function encontrarIndice(colunas,nomes){return colunas.findIndex(valor=>nomes.includes(normalizar(valor)));}

function ehRodape(linha){return linha.filter(Boolean).map(valor=>normalizar(valor)).some(valor=>/^(total|totais|subtotal|pesototal|totalpeso|totalprodutos|totaldeprodutos|produtostotais|quantidadetotal|totaldequantidade|totalgeral)/.test(valor));}

function numero(valor){const texto=String(valor??"").trim();if(!texto)return NaN;const limpo=texto.replace(/[^0-9,.-]/g,"");return limpo.includes(",")?Number(limpo.replace(/\./g,"").replace(",",".")):Number(limpo);}

function normalizar(valor){return String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}

function normalizarBusca(valor){return normalizar(valor);}

function numeroValido(valor){const numero=normalizar(valor);return numero && !["remessasemnumero","deenvio","tipodeservico","servico","descricaodosprodutos","descricao","produto","semana"].includes(numero);}

function detectarNumeroRemessa(linhas){
	const textos=linhas.flat().map(valor=>String(valor||"").trim()).filter(Boolean);
	const rotulado=textos.map(texto=>texto.match(/^(?:remessa|romaneio|documento|numero|n[ºo])\b\s*(?:[:#=-]\s*)?(.+)$/i)).find(resultado => resultado && numeroValido(resultado[1]));
	if(rotulado)return rotulado[1].trim();
	const isolado=textos.find(texto=>/^[a-z0-9][a-z0-9._\/-]{2,}$/i.test(texto) && /\d/.test(texto));
	return isolado||"";
}
