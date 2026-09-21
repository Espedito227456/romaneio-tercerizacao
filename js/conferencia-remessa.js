/*
   Tela de consulta de remessas e evidencias.
   Mostra progresso da remessa, lista pecas, abre galeria de fotos e permite ajustes
   nas evidencias usando a mesma API de remessas.
*/

/* =====================================================
   BANCO DE DADOS SIMULADO
===================================================== */

const remessasSimuladas = {

    /* -------------------------------------------------
       REMESSA EM ANDAMENTO
    ------------------------------------------------- */

    "2026-035": {

        semana: "36",
        data: "05/09/2026",

        pecas: [

            {
                codigo: "001245",
                nome: "PeÃ§a ABC",
                conferida: true,
                fotos: []
            },

            {
                codigo: "001246",
                nome: "PeÃ§a XYZ",
                conferida: false,
                fotos: []
            },

            {
                codigo: "001247",
                nome: "PeÃ§a DEF",
                conferida: true,
                fotos: []
            },

            {
                codigo: "001248",
                nome: "PeÃ§a GHI",
                conferida: false,
                fotos: []
            },

            {
                codigo: "001249",
                nome: "PeÃ§a JKL",
                conferida: true,
                fotos: []
            },

            {
                codigo: "001250",
                nome: "PeÃ§a MNO",
                conferida: false,
                fotos: []
            }

        ]

    },


    /* -------------------------------------------------
       REMESSA FINALIZADA
    ------------------------------------------------- */

    "2026-036": {

        semana: "36",
        data: "06/09/2026",

        pecas: [

            {
                codigo: "002001",
                nome: "PeÃ§a Finalizada A",
                conferida: true,
                fotos: [
                    criarFoto("PEÃ‡A A")
                ]
            },

            {
                codigo: "002002",
                nome: "PeÃ§a Finalizada B",
                conferida: true,
                fotos: [
                    criarFoto("PEÃ‡A B"),
                    criarFoto("CONFERÃŠNCIA")
                ]
            },

            {
                codigo: "002003",
                nome: "PeÃ§a Finalizada C",
                conferida: true,
                fotos: [
                    criarFoto("PEÃ‡A C")
                ]
            },

            {
                codigo: "002004",
                nome: "PeÃ§a Finalizada D",
                conferida: true,
                fotos: []
            },

            {
                codigo: "002005",
                nome: "PeÃ§a Finalizada E",
                conferida: true,
                fotos: [
                    criarFoto("PEÃ‡A E")
                ]
            }

        ]

    }

};


/* =====================================================
   CRIA UMA FOTO SIMULADA
   NÃƒO DEPENDE DE INTERNET
===================================================== */

// Funcao criarFoto: executa esta parte da regra do sistema.
function criarFoto(texto) {

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="800"
            height="500">

            <rect
                width="100%"
                height="100%"
                fill="#dbeafe"/>

            <rect
                x="80"
                y="80"
                width="640"
                height="340"
                rx="20"
                fill="#93c5fd"/>

            <text
                x="400"
                y="245"
                text-anchor="middle"
                font-size="45"
                font-family="Arial"
                font-weight="bold"
                fill="#1e3a8a">

                ${texto}

            </text>

            <text
                x="400"
                y="310"
                text-anchor="middle"
                font-size="25"
                font-family="Arial"
                fill="#1e3a8a">

                FOTO SIMULADA

            </text>

        </svg>
    `;

    return "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg);
}


/* =====================================================
   VARIÃVEIS
===================================================== */

let remessaAtual = null;

let pecaAtual = null;


/* =====================================================
   BUSCAR REMESSA
===================================================== */

// Funcao buscarRemessa: executa esta parte da regra do sistema.
function buscarRemessa() {

    const codigo =
        document
            .getElementById("campoRemessa")
            .value
            .trim();

    const erro =
        document
            .getElementById("mensagemErro");


    const encontrada = remessas.find(function (remessa) {
        const numero = String(remessa.numero || "").toLowerCase();
        const busca = codigo.toLowerCase();
        return busca && (normalizar(numero) === normalizar(busca) || normalizar(numero).endsWith(normalizar(busca)));
    });

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!encontrada) {

        erro.textContent =
            "âŒ Remessa nÃ£o encontrada.";

        document
            .getElementById("areaRemessa")
            .classList.add("hidden");

        return;
    }


    erro.textContent = "";

    remessaAtual = encontrada;
    salvarRemessaRecente(remessaAtual.numero);


    document
        .getElementById("areaRemessa")
        .classList.remove("hidden");


    document
        .getElementById("numeroRemessa")
        .textContent = remessaAtual.numero;


    document
        .getElementById("semanaRemessa")
        .textContent =
            remessaAtual.semana || "NÃ£o informada";


    document
        .getElementById("dataCriacaoRemessa")
        .textContent =
            remessaAtual.dataCriacao || remessaAtual.data || "NÃ£o informada";


    document
        .getElementById("dataFinalizacaoRemessa")
        .textContent =
            remessaAtual.dataFinalizacao || "NÃ£o finalizada";


    document
        .getElementById("campoPeca")
        .value = "";


    atualizarInformacoes();

    renderPecas();
}


// Funcao obterFotosPeca: executa esta parte da regra do sistema.
function obterFotosPeca(peca) {

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!Array.isArray(peca && peca.fotos)) {
        return [];
    }

    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    return peca.fotos.filter(function (foto) {
        // Uma foto expirada (arquivo removido do R2 apos 90 dias) nao tem mais imagem,
        // mas o registro continua contando como evidencia valida da conferencia.
        if (foto && typeof foto === "object" && foto.expirada) return true;
        const imagem = typeof foto === "string" ? foto : foto && foto.imagem;
        return typeof imagem === "string" &&
            (imagem.startsWith("data:image/") || imagem.startsWith("/uploads/"));
    });

}


// Funcao quantidadeConferidaPeca: executa esta parte da regra do sistema.
function quantidadeConferidaPeca(peca) {

    return Number(peca && peca.encontrada) >= Number(peca && peca.quantidade);

}


// Funcao pecaConcluida: executa esta parte da regra do sistema.
function pecaConcluida(peca) {

    return quantidadeConferidaPeca(peca) && obterFotosPeca(peca).length > 0;

}


// Funcao pecaComFotoPendente: executa esta parte da regra do sistema.
function pecaComFotoPendente(peca) {

    return quantidadeConferidaPeca(peca) && obterFotosPeca(peca).length === 0;

}


// Funcao remessaConcluida: executa esta parte da regra do sistema.
function remessaConcluida() {

    return !!remessaAtual &&
        remessaAtual.pecas.length > 0 &&
        remessaAtual.pecas.every(pecaConcluida);

}


// Funcao obterDataHoraAtualFormatada: executa esta parte da regra do sistema.
function obterDataHoraAtualFormatada() {

    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, "0");
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, "0");
    const minutos = String(agora.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${ano} ${horas}:${minutos}`;

}


// Funcao restaurarDataFinalizacao: executa esta parte da regra do sistema.
function restaurarDataFinalizacao(valorAnterior) {

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!remessaAtual) {
        return;
    }

    // Condicao: valida este caso antes de continuar o fluxo.
    if (valorAnterior) {
        remessaAtual.dataFinalizacao = valorAnterior;
    } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
        delete remessaAtual.dataFinalizacao;
    }

    document
        .getElementById("dataFinalizacaoRemessa")
        .textContent =
            remessaAtual.dataFinalizacao || "NÃ£o finalizada";

}


// Funcao sincronizarDataFinalizacaoRemessa: executa esta parte da regra do sistema.
function sincronizarDataFinalizacaoRemessa() {

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!remessaAtual) {
        return;
    }

    // Condicao: valida este caso antes de continuar o fluxo.
    if (remessaConcluida()) {
        remessaAtual.dataFinalizacao =
            remessaAtual.dataFinalizacao || obterDataHoraAtualFormatada();
    } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
        delete remessaAtual.dataFinalizacao;
    }

    document
        .getElementById("dataFinalizacaoRemessa")
        .textContent =
            remessaAtual.dataFinalizacao || "NÃ£o finalizada";

}


/* =====================================================
   ATUALIZAR INFORMAÃ‡Ã•ES
===================================================== */

// Funcao atualizarInformacoes: executa esta parte da regra do sistema.
function atualizarInformacoes() {

    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    const total = remessaAtual.pecas.reduce(function (soma, peca) {
        return soma + (Number(peca.quantidade) || 0);
    }, 0);


    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    const quantidadeConferida = remessaAtual.pecas.reduce(function (soma, peca) {
            return soma + Math.min(Number(peca.quantidade) || 0, Number(peca.encontrada) || 0);
        }, 0);


    const pendentes =
        total - quantidadeConferida;


    let porcentagem = 0;


    // Condicao: valida este caso antes de continuar o fluxo.
    if (total > 0) {

        porcentagem =
            Math.round(
                (quantidadeConferida / total) * 100
            );

    }


    document
        .getElementById("total")
        .textContent = total;


    document
        .getElementById("conferidas")
        .textContent = quantidadeConferida;


    document
        .getElementById("pendentes")
        .textContent = pendentes;


    document
        .getElementById("porcentagem")
        .textContent =
            porcentagem + "%";


    document
        .getElementById("barraProgresso")
        .style.width =
            porcentagem + "%";


    const status =
        document
            .getElementById("statusRemessa");


    const possuiFotoPendente =
        remessaAtual.pecas.some(pecaComFotoPendente);


    // Condicao: valida este caso antes de continuar o fluxo.
    if (remessaConcluida()) {

        status.innerHTML = `
            <span class="status status-finalizada">
                ðŸŸ¢ FINALIZADA
            </span>
        `;

    } else if (quantidadeConferida === total && total > 0 && possuiFotoPendente) { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */

        status.innerHTML = `
            <span class="status status-andamento">
                ðŸŸ  FOTO PENDENTE
            </span>
        `;

    } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */

        status.innerHTML = `
            <span class="status status-andamento">
                ðŸŸ¡ EM ANDAMENTO
            </span>
        `;

    }

}


/* =====================================================
   RENDERIZAR PEÃ‡AS
===================================================== */

// Funcao renderPecas: executa esta parte da regra do sistema.
function renderPecas() {

    const lista =
        document
            .getElementById("listaPecas");


    const busca =
        document
            .getElementById("campoPeca")
            .value
            .toLowerCase()
            .trim();


    lista.innerHTML = "";


    const pecasFiltradas =
        // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
        remessaAtual.pecas.filter(
            // Funcao anonima: processa o item atual dentro desta iteracao ou callback.
            function (peca) {

                return (
                    String(peca.codigo || "")
                        .toLowerCase()
                        .includes(busca)

                    ||

                    String(peca.descricao || "")
                        .toLowerCase()
                        .includes(busca)
                );

            }
        );


    // Condicao: valida este caso antes de continuar o fluxo.
    if (pecasFiltradas.length === 0) {

        lista.innerHTML = `
            <div class="sem-foto">
                Nenhuma peÃ§a encontrada.
            </div>
        `;

        return;
    }


    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    pecasFiltradas.forEach(
        // Funcao anonima: processa o item atual dentro desta iteracao ou callback.
        function (peca) {

            const indice =
                remessaAtual.pecas.indexOf(peca);


            const status =
                pecaConcluida(peca)

                    ? `
                        <span class="badge badge-ok">
                            âœ… Conferida
                        </span>
                    `

                    : pecaComFotoPendente(peca)

                        ? `
                            <span class="badge badge-pendente">
                                âš ï¸ Foto pendente
                            </span>
                        `

                        : `
                            <span class="badge badge-pendente">
                                âŒ Pendente
                            </span>
                        `;


            lista.innerHTML += `

                <div class="peca">

                    <div class="peca-info">

                        <div class="codigo">
                            ${escapar(peca.codigo)}
                        </div>

                        <div class="nome">
                            ${escapar(peca.descricao || "Sem descriÃ§Ã£o")}
                        </div>

                        <div>
                            ${status}
                        </div>

                        <div class="fotos-count">

                            ðŸ“·
                            ${obterFotosPeca(peca).length}
                            foto(s)

                        </div>

                        <div class="quantidade">
                            ${Number(peca.encontrada) || 0}/${Number(peca.quantidade) || 0} unidade(s)
                        </div>

                    </div>


                    <button
                        onclick="abrirFotos(${indice})">

                        ðŸ“· FOTOS

                    </button>

                </div>

            `;

        }
    );

}


/* =====================================================
   FILTRAR PEÃ‡AS
===================================================== */

// Funcao filtrarPecas: executa esta parte da regra do sistema.
function filtrarPecas() {

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!remessaAtual) {
        return;
    }

    renderPecas();

}


/* =====================================================
   ABRIR FOTOS
===================================================== */

// Funcao abrirFotos: executa esta parte da regra do sistema.
function abrirFotos(indice) {

    pecaAtual =
        remessaAtual.pecas[indice];


    document
        .getElementById("tituloFotos")
        .textContent =
            "ðŸ“· Fotos - " +
            pecaAtual.codigo;


    document
        .getElementById("modalFotos")
        .classList.remove("hidden");


    renderFotos();

}


/* =====================================================
   RENDERIZAR FOTOS
===================================================== */

// Funcao renderFotos: executa esta parte da regra do sistema.
function renderFotos() {

    const lista =
        document
            .getElementById("listaFotos");


    lista.innerHTML = "";


    // Condicao: valida este caso antes de continuar o fluxo.
    if (!pecaAtual) {
        return;
    }

    const fotos = obterFotosPeca(pecaAtual);


    // Condicao: valida este caso antes de continuar o fluxo.
    if (fotos.length === 0) {

        lista.innerHTML = `
            <div class="sem-foto">
                ðŸ“· Nenhuma foto cadastrada.
            </div>
        `;

        return;
    }


    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    fotos.forEach(
        // Funcao anonima: processa o item atual dentro desta iteracao ou callback.
        function (foto, indice) {

            const expirada = typeof foto === "object" && foto !== null && foto.expirada === true;
            const corpoFoto = expirada
                ? `<div class="foto-expirada">ðŸ“· Foto expirada em ${escapar(foto.dataRegistro || "data desconhecida")}<br>(arquivo removido do armazenamento apos 90 dias)</div>`
                : `<img src="${escaparFoto(foto)}" alt="Foto da peÃ§a">`;

            lista.innerHTML += `

                <div class="foto-card">

                    ${corpoFoto}

                    <div class="foto-usuario">
                        Registrada por: ${escapar(obterUsuarioFoto(foto))}
                    </div>

                    <button
                        class="btn-red"
                        onclick="excluirFoto(${indice})">

                        ðŸ—‘ EXCLUIR FOTO

                    </button>

                </div>

            `;

        }
    );

}


/* =====================================================
   ABRIR CÃ‚MERA / GALERIA
===================================================== */

// Funcao abrirCamera: executa esta parte da regra do sistema.
function abrirCamera() {

    document
        .getElementById("campoFoto")
        .click();

}


/* =====================================================
   ADICIONAR FOTO
===================================================== */

// Funcao adicionarFoto: executa esta parte da regra do sistema.
function adicionarFoto(event) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (salvamentoEmAndamento) return;
    const arquivo = event.target.files[0];
    event.target.value = "";

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!arquivo) {
        return;
    }

    // Condicao: valida este caso antes de continuar o fluxo.
    if (!/^image\/(?:jpeg|png|gif|webp)$/i.test(arquivo.type)) {
        return;
    }
    // Condicao: valida este caso antes de continuar o fluxo.
    if (arquivo.size > 8 * 1024 * 1024) {
        return;
    }

    const pecaEditada = pecaAtual;
    const remessaEditada = remessaAtual;
    const dataFinalizacaoAnterior = remessaEditada && remessaEditada.dataFinalizacao;
    lerFoto(arquivo).then(comprimirFoto).then(function (foto) {
        // Condicao: valida este caso antes de continuar o fluxo.
        if (!pecaAtual || pecaAtual !== pecaEditada) return;
        // Condicao: valida este caso antes de continuar o fluxo.
        if (!Array.isArray(pecaEditada.fotos)) {
            pecaEditada.fotos = [];
        }

        const sessao = getAuthSession();
        const usuario = sessao && sessao.username ? String(sessao.username).trim() : "";
        pecaEditada.fotos.push({ imagem: foto, usuario: usuario });
        sincronizarDataFinalizacaoRemessa();
        return salvarRemessas().then(function (salvou) {
            // Condicao: valida este caso antes de continuar o fluxo.
            if (!salvou) {
                // Condicao: valida este caso antes de continuar o fluxo.
                if (pecaAtual === pecaEditada) pecaEditada.fotos.pop();
                // Condicao: valida este caso antes de continuar o fluxo.
                if (remessaAtual === remessaEditada) restaurarDataFinalizacao(dataFinalizacaoAnterior);
                return;
            }
            renderFotos();
            renderPecas();
        });
    }).catch(function () {
        // Condicao: valida este caso antes de continuar o fluxo.
        if (pecaAtual === pecaEditada) {
            // Condicao: valida este caso antes de continuar o fluxo.
            if (Array.isArray(pecaEditada.fotos)) {
                pecaEditada.fotos.pop();
            } else { /* Executa o caminho alternativo quando a condicao anterior nao foi atendida. */
                pecaEditada.fotos = [];
            }
            // Condicao: valida este caso antes de continuar o fluxo.
            if (remessaAtual === remessaEditada) restaurarDataFinalizacao(dataFinalizacaoAnterior);
            renderFotos();
            renderPecas();
        }
        mensagemErro("NÃ£o foi possÃ­vel salvar a foto. Tente novamente.", true);
    });

}


/* =====================================================
   EXCLUIR FOTO
===================================================== */

// Funcao excluirFoto: executa esta parte da regra do sistema.
function excluirFoto(indice) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (salvamentoEmAndamento) return;
    const confirmar =
        confirm(
            "Tem certeza que deseja excluir esta foto?"
        );


    // Condicao: valida este caso antes de continuar o fluxo.
    if (!confirmar) {
        return;
    }


    const pecaEditada = pecaAtual;
    const remessaEditada = remessaAtual;
    const dataFinalizacaoAnterior = remessaEditada && remessaEditada.dataFinalizacao;
    const fotoRemovida = pecaEditada.fotos.splice(indice, 1)[0];
    sincronizarDataFinalizacaoRemessa();
    salvarRemessas().then(function (salvou) {
        // Condicao: valida este caso antes de continuar o fluxo.
        if (!salvou) {
            // Condicao: valida este caso antes de continuar o fluxo.
            if (pecaAtual === pecaEditada) pecaEditada.fotos.splice(indice, 0, fotoRemovida);
            // Condicao: valida este caso antes de continuar o fluxo.
            if (remessaAtual === remessaEditada) restaurarDataFinalizacao(dataFinalizacaoAnterior);
            mensagemErro("NÃ£o foi possÃ­vel excluir a foto. Tente novamente.", true);
        }
        renderFotos();
        renderPecas();
    });

}


/* =====================================================
   FECHAR MODAL
===================================================== */

// Funcao fecharFotos: executa esta parte da regra do sistema.
function fecharFotos() {

    document
        .getElementById("modalFotos")
        .classList.add("hidden");


    pecaAtual = null;

}


/* =====================================================
   NOVA BUSCA
===================================================== */

// Funcao novaBusca: executa esta parte da regra do sistema.
function novaBusca() {

    remessaAtual = null;

    pecaAtual = null;


    document
        .getElementById("areaRemessa")
        .classList.add("hidden");


    document
        .getElementById("campoRemessa")
        .value = "";


    document
        .getElementById("campoPeca")
        .value = "";


    document
        .getElementById("mensagemErro")
        .textContent = "";

    renderizarRemessasRecentes();
}

// Funcao obterChaveRecentes: executa esta parte da regra do sistema.
function obterChaveRecentes() {
    const sessao = typeof getAuthSession === "function" ? getAuthSession() : null;
    const usuario = sessao && sessao.username ? sessao.username.trim() : "geral";
    return "remessasRecentes_" + usuario;
}

// Funcao obterRemessasRecentes: executa esta parte da regra do sistema.
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

// Funcao salvarRemessaRecente: executa esta parte da regra do sistema.
function salvarRemessaRecente(numero) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!numero) return;
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
        const chave = obterChaveRecentes();
        let recentes = obterRemessasRecentes();
        // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
        recentes = recentes.filter(function (item) { return normalizar(item) !== normalizar(numero); });
        recentes.unshift(String(numero).trim());
        recentes = recentes.slice(0, 5);
        localStorage.setItem(chave, JSON.stringify(recentes));
    } catch (_) { /* Captura falhas da operacao protegida acima. */}
    renderizarRemessasRecentes();
}

// Funcao renderizarRemessasRecentes: executa esta parte da regra do sistema.
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
    lista.innerHTML = recentes.map(function (num) {
        return `<button type="button" class="btn-remessa-recente" data-numero="${escapar(num)}" title="Abrir remessa ${escapar(num)}">ðŸ“¦ ${escapar(num)}</button>`;
    }).join("");

    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
    lista.querySelectorAll(".btn-remessa-recente").forEach(function (botao) {
        // Evento da tela: reage a uma acao do usuario ou do navegador.
        botao.addEventListener("click", function () {
            const num = botao.getAttribute("data-numero");
            const campo = document.getElementById("campoRemessa");
            // Condicao: valida este caso antes de continuar o fluxo.
            if (campo) {
                campo.value = num;
                buscarRemessa();
            }
        });
    });
}

let remessas = [];
const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";

/* =====================================================
   TEMPO REAL
   Mantem esta tela sincronizada quando outra pessoa confere a mesma remessa.
===================================================== */

const canalTempoReal = new EventSource(API_BASE + "/api/tempo-real");
// Evento da tela: reage a uma acao do usuario ou do navegador.
canalTempoReal.addEventListener("remessa:atualizada", function (evento) {
    let atualizada;
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
        atualizada = JSON.parse(evento.data);
    } catch (_) { /* Captura falhas da operacao protegida acima. */
        return;
    }
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!atualizada || !atualizada.id) return;
    const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(atualizada.id); });
    // Condicao: valida este caso antes de continuar o fluxo.
    if (indice < 0) return;
    remessas[indice] = atualizada;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!remessaAtual || String(remessaAtual.id || remessaAtual.numero) !== String(atualizada.id)) return;
    const codigoPecaAberta = pecaAtual && pecaAtual.codigo;
    remessaAtual = atualizada;
    // Condicao: valida este caso antes de continuar o fluxo.
    if (codigoPecaAberta) {
        const novaPeca = remessaAtual.pecas.find(function (peca) { return String(peca.codigo) === String(codigoPecaAberta); });
        pecaAtual = novaPeca || null;
    }
    atualizarInformacoes();
    document.getElementById("dataCriacaoRemessa").textContent = remessaAtual.dataCriacao || remessaAtual.data || "NÃ£o informada";
    document.getElementById("dataFinalizacaoRemessa").textContent = remessaAtual.dataFinalizacao || "NÃ£o finalizada";
    renderPecas();
    // Condicao: valida este caso antes de continuar o fluxo.
    if (pecaAtual) renderFotos();
});
carregarRemessas();

/* =====================================================
   CARREGAMENTO DA API
   Busca remessas reais no servidor e normaliza fotos antes de renderizar.
===================================================== */

// Funcao carregarRemessas: executa esta parte da regra do sistema.
function carregarRemessas() {
    fetch(API_BASE + "/api/remessas")
        .then(function (resposta) { return resposta.ok ? resposta.json() : Promise.reject(); })
        .then(function (dados) {
            remessas = Array.isArray(dados)
                // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
                ? dados.filter(function (remessa) {
                return remessa && remessa.numero && Array.isArray(remessa.pecas);
            // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
            }).map(function (remessa) {
                return {
                    ...remessa,
                    // Iteracao de lista: percorre/transforma dados para montar o resultado usado na tela ou API.
                    pecas: remessa.pecas.map(function (peca) {
                        return {
                            ...peca,
                            fotos: obterFotosPeca(peca)
                        };
                    })
                };
            })
                : [];
            renderizarRemessasRecentes();
            const numeroInicial = new URLSearchParams(window.location.search).get("remessa");
            // Condicao: valida este caso antes de continuar o fluxo.
            if (numeroInicial) {
                document.getElementById("campoRemessa").value = numeroInicial;
                buscarRemessa();
            }
        })
        .catch(function () {
            remessas = [];
            renderizarRemessasRecentes();
        });
}

let filaSalvamento = Promise.resolve();
let salvamentoEmAndamento = false;

/* =====================================================
   SALVAMENTO COM FILA
   Evita dois PUT simultaneos quando o usuario adiciona/exclui fotos rapido.
===================================================== */

// Funcao salvarRemessas: executa esta parte da regra do sistema.
function salvarRemessas() {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (salvamentoEmAndamento) return Promise.resolve(false);
    salvamentoEmAndamento = true;
    const operacao = filaSalvamento.then(executarSalvamento, executarSalvamento);
    filaSalvamento = operacao.catch(function () {});
    return operacao.finally(function () { salvamentoEmAndamento = false; });
}

// Funcao executarSalvamento: executa esta parte da regra do sistema.
async function executarSalvamento() {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!remessaAtual) return false;
    // Bloco protegido: tenta executar uma operacao que pode falhar.
    try {
        const resposta = await fetch(API_BASE + "/api/remessas/" + encodeURIComponent(remessaAtual.id || remessaAtual.numero), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(remessaAtual)
        });
        // Condicao: valida este caso antes de continuar o fluxo.
        if (resposta.status === 409) {
            const dados = await resposta.json();
            // Condicao: valida este caso antes de continuar o fluxo.
            if (dados.remessa) {
                const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(dados.remessa.id || dados.remessa.numero); });
                // Condicao: valida este caso antes de continuar o fluxo.
                if (indice >= 0) remessas[indice] = dados.remessa;
                remessaAtual = dados.remessa;
                pecaAtual = null;
                atualizarInformacoes(); renderPecas(); renderFotos();
            }
            return false;
        }
        // Condicao: valida este caso antes de continuar o fluxo.
        if (!resposta.ok) return false;
        const salva = await resposta.json();
        const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(salva.id || salva.numero); });
        // Condicao: valida este caso antes de continuar o fluxo.
        if (indice >= 0) remessas[indice] = salva;
        remessaAtual = salva;
        // Condicao: valida este caso antes de continuar o fluxo.
        if (pecaAtual) {
            pecaAtual = remessaAtual.pecas.find(function (peca) { return String(peca.codigo) === String(pecaAtual.codigo); }) || null;
        }
        return true;
    } catch (_) { /* Captura falhas da operacao protegida acima. */
        return false;
    }
}

/* =====================================================
   LEITURA E COMPRESSAO DE FOTOS
   Converte arquivo em Data URL e padroniza a imagem como JPEG reduzido.
===================================================== */

// Funcao lerFoto: executa esta parte da regra do sistema.
function lerFoto(arquivo) {
    return new Promise(function (resolver, rejeitar) {
        const leitor = new FileReader();
        leitor.onload = function () { resolver(leitor.result); };
        leitor.onerror = rejeitar;
        leitor.readAsDataURL(arquivo);
    });
}

// Funcao comprimirFoto: executa esta parte da regra do sistema.
function comprimirFoto(dataUrl) {
    return new Promise(function (resolver, rejeitar) {
        const imagem = new Image();
        imagem.onload = function () {
            const limite = 1000;
            const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
            canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
            const contexto = canvas.getContext("2d");
            // Condicao: valida este caso antes de continuar o fluxo.
            if (!contexto) return rejeitar(new Error("Canvas indisponÃ­vel."));
            contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
            const foto = canvas.toDataURL("image/jpeg", 0.75);
            // Condicao: valida este caso antes de continuar o fluxo.
            if (!foto.startsWith("data:image/jpeg;base64,")) return rejeitar(new Error("Imagem invÃ¡lida."));
            resolver(foto);
        };
        imagem.onerror = rejeitar;
        imagem.src = dataUrl;
    });
}

/* =====================================================
   FUNCOES AUXILIARES
   Pequenas rotinas de seguranca visual, normalizacao e mensagens.
===================================================== */

// Funcao normalizar: executa esta parte da regra do sistema.
function normalizar(valor) {
    return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Funcao escapar: executa esta parte da regra do sistema.
function escapar(valor) {
    const elemento = document.createElement("span");
    elemento.textContent = valor == null ? "" : String(valor);
    return elemento.innerHTML;
}

// Funcao escaparFoto: executa esta parte da regra do sistema.
function escaparFoto(valor) {
    const foto = typeof valor === "string" ? valor : valor && valor.imagem;
    const imagem = String(foto || "");
    const fonte = imagem.startsWith("/uploads/") ? API_BASE + imagem : imagem;
    return (/^data:image\/(?:jpeg|png|gif|webp);base64,/i.test(fonte)
        || /^\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)
        || /^https?:\/\/[^/]+\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)) ? escapar(fonte) : "";
}

// Funcao obterUsuarioFoto: executa esta parte da regra do sistema.
function obterUsuarioFoto(foto) {
    // Condicao: valida este caso antes de continuar o fluxo.
    if (typeof foto === "object" && foto !== null && foto.usuario) return String(foto.usuario);
    return "NÃ£o identificado";
}

// Funcao mensagemErro: executa esta parte da regra do sistema.
function mensagemErro(texto, erro) {
    const elemento = document.getElementById("mensagemErro");
    // Condicao: valida este caso antes de continuar o fluxo.
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.toggle("erro", Boolean(erro));
}
