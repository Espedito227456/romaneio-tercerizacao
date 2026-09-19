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
                nome: "Peça ABC",
                conferida: true,
                fotos: []
            },

            {
                codigo: "001246",
                nome: "Peça XYZ",
                conferida: false,
                fotos: []
            },

            {
                codigo: "001247",
                nome: "Peça DEF",
                conferida: true,
                fotos: []
            },

            {
                codigo: "001248",
                nome: "Peça GHI",
                conferida: false,
                fotos: []
            },

            {
                codigo: "001249",
                nome: "Peça JKL",
                conferida: true,
                fotos: []
            },

            {
                codigo: "001250",
                nome: "Peça MNO",
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
                nome: "Peça Finalizada A",
                conferida: true,
                fotos: [
                    criarFoto("PEÇA A")
                ]
            },

            {
                codigo: "002002",
                nome: "Peça Finalizada B",
                conferida: true,
                fotos: [
                    criarFoto("PEÇA B"),
                    criarFoto("CONFERÊNCIA")
                ]
            },

            {
                codigo: "002003",
                nome: "Peça Finalizada C",
                conferida: true,
                fotos: [
                    criarFoto("PEÇA C")
                ]
            },

            {
                codigo: "002004",
                nome: "Peça Finalizada D",
                conferida: true,
                fotos: []
            },

            {
                codigo: "002005",
                nome: "Peça Finalizada E",
                conferida: true,
                fotos: [
                    criarFoto("PEÇA E")
                ]
            }

        ]

    }

};


/* =====================================================
   CRIA UMA FOTO SIMULADA
   NÃO DEPENDE DE INTERNET
===================================================== */

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
   VARIÁVEIS
===================================================== */

let remessaAtual = null;

let pecaAtual = null;


/* =====================================================
   BUSCAR REMESSA
===================================================== */

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

    if (!encontrada) {

        erro.textContent =
            "❌ Remessa não encontrada.";

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
            remessaAtual.semana || "Não informada";


    document
        .getElementById("dataCriacaoRemessa")
        .textContent =
            remessaAtual.dataCriacao || remessaAtual.data || "Não informada";


    document
        .getElementById("dataFinalizacaoRemessa")
        .textContent =
            remessaAtual.dataFinalizacao || "Não finalizada";


    document
        .getElementById("campoPeca")
        .value = "";


    atualizarInformacoes();

    renderPecas();
}


function obterFotosPeca(peca) {

    if (!Array.isArray(peca && peca.fotos)) {
        return [];
    }

    return peca.fotos.filter(function (foto) {
        // Uma foto expirada (arquivo removido do R2 apos 90 dias) nao tem mais imagem,
        // mas o registro continua contando como evidencia valida da conferencia.
        if (foto && typeof foto === "object" && foto.expirada) return true;
        const imagem = typeof foto === "string" ? foto : foto && foto.imagem;
        return typeof imagem === "string" &&
            (imagem.startsWith("data:image/") || imagem.startsWith("/uploads/"));
    });

}


function quantidadeConferidaPeca(peca) {

    return Number(peca && peca.encontrada) >= Number(peca && peca.quantidade);

}


function pecaConcluida(peca) {

    return quantidadeConferidaPeca(peca) && obterFotosPeca(peca).length > 0;

}


function pecaComFotoPendente(peca) {

    return quantidadeConferidaPeca(peca) && obterFotosPeca(peca).length === 0;

}


function remessaConcluida() {

    return !!remessaAtual &&
        remessaAtual.pecas.length > 0 &&
        remessaAtual.pecas.every(pecaConcluida);

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


function restaurarDataFinalizacao(valorAnterior) {

    if (!remessaAtual) {
        return;
    }

    if (valorAnterior) {
        remessaAtual.dataFinalizacao = valorAnterior;
    } else {
        delete remessaAtual.dataFinalizacao;
    }

    document
        .getElementById("dataFinalizacaoRemessa")
        .textContent =
            remessaAtual.dataFinalizacao || "Não finalizada";

}


function sincronizarDataFinalizacaoRemessa() {

    if (!remessaAtual) {
        return;
    }

    if (remessaConcluida()) {
        remessaAtual.dataFinalizacao =
            remessaAtual.dataFinalizacao || obterDataHoraAtualFormatada();
    } else {
        delete remessaAtual.dataFinalizacao;
    }

    document
        .getElementById("dataFinalizacaoRemessa")
        .textContent =
            remessaAtual.dataFinalizacao || "Não finalizada";

}


/* =====================================================
   ATUALIZAR INFORMAÇÕES
===================================================== */

function atualizarInformacoes() {

    const total = remessaAtual.pecas.reduce(function (soma, peca) {
        return soma + (Number(peca.quantidade) || 0);
    }, 0);


    const quantidadeConferida = remessaAtual.pecas.reduce(function (soma, peca) {
            return soma + Math.min(Number(peca.quantidade) || 0, Number(peca.encontrada) || 0);
        }, 0);


    const pendentes =
        total - quantidadeConferida;


    let porcentagem = 0;


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


    if (remessaConcluida()) {

        status.innerHTML = `
            <span class="status status-finalizada">
                🟢 FINALIZADA
            </span>
        `;

    } else if (quantidadeConferida === total && total > 0 && possuiFotoPendente) {

        status.innerHTML = `
            <span class="status status-andamento">
                🟠 FOTO PENDENTE
            </span>
        `;

    } else {

        status.innerHTML = `
            <span class="status status-andamento">
                🟡 EM ANDAMENTO
            </span>
        `;

    }

}


/* =====================================================
   RENDERIZAR PEÇAS
===================================================== */

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
        remessaAtual.pecas.filter(
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


    if (pecasFiltradas.length === 0) {

        lista.innerHTML = `
            <div class="sem-foto">
                Nenhuma peça encontrada.
            </div>
        `;

        return;
    }


    pecasFiltradas.forEach(
        function (peca) {

            const indice =
                remessaAtual.pecas.indexOf(peca);


            const status =
                pecaConcluida(peca)

                    ? `
                        <span class="badge badge-ok">
                            ✅ Conferida
                        </span>
                    `

                    : pecaComFotoPendente(peca)

                        ? `
                            <span class="badge badge-pendente">
                                ⚠️ Foto pendente
                            </span>
                        `

                        : `
                            <span class="badge badge-pendente">
                                ❌ Pendente
                            </span>
                        `;


            lista.innerHTML += `

                <div class="peca">

                    <div class="peca-info">

                        <div class="codigo">
                            ${escapar(peca.codigo)}
                        </div>

                        <div class="nome">
                            ${escapar(peca.descricao || "Sem descrição")}
                        </div>

                        <div>
                            ${status}
                        </div>

                        <div class="fotos-count">

                            📷
                            ${obterFotosPeca(peca).length}
                            foto(s)

                        </div>

                        <div class="quantidade">
                            ${Number(peca.encontrada) || 0}/${Number(peca.quantidade) || 0} unidade(s)
                        </div>

                    </div>


                    <button
                        onclick="abrirFotos(${indice})">

                        📷 FOTOS

                    </button>

                </div>

            `;

        }
    );

}


/* =====================================================
   FILTRAR PEÇAS
===================================================== */

function filtrarPecas() {

    if (!remessaAtual) {
        return;
    }

    renderPecas();

}


/* =====================================================
   ABRIR FOTOS
===================================================== */

function abrirFotos(indice) {

    pecaAtual =
        remessaAtual.pecas[indice];


    document
        .getElementById("tituloFotos")
        .textContent =
            "📷 Fotos - " +
            pecaAtual.codigo;


    document
        .getElementById("modalFotos")
        .classList.remove("hidden");


    renderFotos();

}


/* =====================================================
   RENDERIZAR FOTOS
===================================================== */

function renderFotos() {

    const lista =
        document
            .getElementById("listaFotos");


    lista.innerHTML = "";


    if (!pecaAtual) {
        return;
    }

    const fotos = obterFotosPeca(pecaAtual);


    if (fotos.length === 0) {

        lista.innerHTML = `
            <div class="sem-foto">
                📷 Nenhuma foto cadastrada.
            </div>
        `;

        return;
    }


    fotos.forEach(
        function (foto, indice) {

            const expirada = typeof foto === "object" && foto !== null && foto.expirada === true;
            const corpoFoto = expirada
                ? `<div class="foto-expirada">📷 Foto expirada em ${escapar(foto.dataRegistro || "data desconhecida")}<br>(arquivo removido do armazenamento apos 90 dias)</div>`
                : `<img src="${escaparFoto(foto)}" alt="Foto da peça">`;

            lista.innerHTML += `

                <div class="foto-card">

                    ${corpoFoto}

                    <div class="foto-usuario">
                        Registrada por: ${escapar(obterUsuarioFoto(foto))}
                    </div>

                    <button
                        class="btn-red"
                        onclick="excluirFoto(${indice})">

                        🗑 EXCLUIR FOTO

                    </button>

                </div>

            `;

        }
    );

}


/* =====================================================
   ABRIR CÂMERA / GALERIA
===================================================== */

function abrirCamera() {

    document
        .getElementById("campoFoto")
        .click();

}


/* =====================================================
   ADICIONAR FOTO
===================================================== */

function adicionarFoto(event) {
    if (salvamentoEmAndamento) return;
    const arquivo = event.target.files[0];
    event.target.value = "";

    if (!arquivo) {
        return;
    }

    if (!/^image\/(?:jpeg|png|gif|webp)$/i.test(arquivo.type)) {
        return;
    }
    if (arquivo.size > 8 * 1024 * 1024) {
        return;
    }

    const pecaEditada = pecaAtual;
    const remessaEditada = remessaAtual;
    const dataFinalizacaoAnterior = remessaEditada && remessaEditada.dataFinalizacao;
    lerFoto(arquivo).then(comprimirFoto).then(function (foto) {
        if (!pecaAtual || pecaAtual !== pecaEditada) return;
        if (!Array.isArray(pecaEditada.fotos)) {
            pecaEditada.fotos = [];
        }

        const sessao = getAuthSession();
        const usuario = sessao && sessao.username ? String(sessao.username).trim() : "";
        pecaEditada.fotos.push({ imagem: foto, usuario: usuario });
        sincronizarDataFinalizacaoRemessa();
        return salvarRemessas().then(function (salvou) {
            if (!salvou) {
                if (pecaAtual === pecaEditada) pecaEditada.fotos.pop();
                if (remessaAtual === remessaEditada) restaurarDataFinalizacao(dataFinalizacaoAnterior);
                return;
            }
            renderFotos();
            renderPecas();
        });
    }).catch(function () {
        if (pecaAtual === pecaEditada) {
            if (Array.isArray(pecaEditada.fotos)) {
                pecaEditada.fotos.pop();
            } else {
                pecaEditada.fotos = [];
            }
            if (remessaAtual === remessaEditada) restaurarDataFinalizacao(dataFinalizacaoAnterior);
            renderFotos();
            renderPecas();
        }
        mensagemErro("Não foi possível salvar a foto. Tente novamente.", true);
    });

}


/* =====================================================
   EXCLUIR FOTO
===================================================== */

function excluirFoto(indice) {
    if (salvamentoEmAndamento) return;
    const confirmar =
        confirm(
            "Tem certeza que deseja excluir esta foto?"
        );


    if (!confirmar) {
        return;
    }


    const pecaEditada = pecaAtual;
    const remessaEditada = remessaAtual;
    const dataFinalizacaoAnterior = remessaEditada && remessaEditada.dataFinalizacao;
    const fotoRemovida = pecaEditada.fotos.splice(indice, 1)[0];
    sincronizarDataFinalizacaoRemessa();
    salvarRemessas().then(function (salvou) {
        if (!salvou) {
            if (pecaAtual === pecaEditada) pecaEditada.fotos.splice(indice, 0, fotoRemovida);
            if (remessaAtual === remessaEditada) restaurarDataFinalizacao(dataFinalizacaoAnterior);
            mensagemErro("Não foi possível excluir a foto. Tente novamente.", true);
        }
        renderFotos();
        renderPecas();
    });

}


/* =====================================================
   FECHAR MODAL
===================================================== */

function fecharFotos() {

    document
        .getElementById("modalFotos")
        .classList.add("hidden");


    pecaAtual = null;

}


/* =====================================================
   NOVA BUSCA
===================================================== */

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
        recentes = recentes.filter(function (item) { return normalizar(item) !== normalizar(numero); });
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
    lista.innerHTML = recentes.map(function (num) {
        return `<button type="button" class="btn-remessa-recente" data-numero="${escapar(num)}" title="Abrir remessa ${escapar(num)}">📦 ${escapar(num)}</button>`;
    }).join("");

    lista.querySelectorAll(".btn-remessa-recente").forEach(function (botao) {
        botao.addEventListener("click", function () {
            const num = botao.getAttribute("data-numero");
            const campo = document.getElementById("campoRemessa");
            if (campo) {
                campo.value = num;
                buscarRemessa();
            }
        });
    });
}

let remessas = [];
const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const canalTempoReal = new EventSource(API_BASE + "/api/tempo-real");
canalTempoReal.addEventListener("remessa:atualizada", function (evento) {
    let atualizada;
    try {
        atualizada = JSON.parse(evento.data);
    } catch (_) {
        return;
    }
    if (!atualizada || !atualizada.id) return;
    const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(atualizada.id); });
    if (indice < 0) return;
    remessas[indice] = atualizada;
    if (!remessaAtual || String(remessaAtual.id || remessaAtual.numero) !== String(atualizada.id)) return;
    const codigoPecaAberta = pecaAtual && pecaAtual.codigo;
    remessaAtual = atualizada;
    if (codigoPecaAberta) {
        const novaPeca = remessaAtual.pecas.find(function (peca) { return String(peca.codigo) === String(codigoPecaAberta); });
        pecaAtual = novaPeca || null;
    }
    atualizarInformacoes();
    document.getElementById("dataCriacaoRemessa").textContent = remessaAtual.dataCriacao || remessaAtual.data || "Não informada";
    document.getElementById("dataFinalizacaoRemessa").textContent = remessaAtual.dataFinalizacao || "Não finalizada";
    renderPecas();
    if (pecaAtual) renderFotos();
});
carregarRemessas();

function carregarRemessas() {
    fetch(API_BASE + "/api/remessas")
        .then(function (resposta) { return resposta.ok ? resposta.json() : Promise.reject(); })
        .then(function (dados) {
            remessas = Array.isArray(dados)
                ? dados.filter(function (remessa) {
                return remessa && remessa.numero && Array.isArray(remessa.pecas);
            }).map(function (remessa) {
                return {
                    ...remessa,
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

function salvarRemessas() {
    if (salvamentoEmAndamento) return Promise.resolve(false);
    salvamentoEmAndamento = true;
    const operacao = filaSalvamento.then(executarSalvamento, executarSalvamento);
    filaSalvamento = operacao.catch(function () {});
    return operacao.finally(function () { salvamentoEmAndamento = false; });
}

async function executarSalvamento() {
    if (!remessaAtual) return false;
    try {
        const resposta = await fetch(API_BASE + "/api/remessas/" + encodeURIComponent(remessaAtual.id || remessaAtual.numero), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(remessaAtual)
        });
        if (resposta.status === 409) {
            const dados = await resposta.json();
            if (dados.remessa) {
                const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(dados.remessa.id || dados.remessa.numero); });
                if (indice >= 0) remessas[indice] = dados.remessa;
                remessaAtual = dados.remessa;
                pecaAtual = null;
                atualizarInformacoes(); renderPecas(); renderFotos();
            }
            return false;
        }
        if (!resposta.ok) return false;
        const salva = await resposta.json();
        const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(salva.id || salva.numero); });
        if (indice >= 0) remessas[indice] = salva;
        remessaAtual = salva;
        if (pecaAtual) {
            pecaAtual = remessaAtual.pecas.find(function (peca) { return String(peca.codigo) === String(pecaAtual.codigo); }) || null;
        }
        return true;
    } catch (_) {
        return false;
    }
}

function lerFoto(arquivo) {
    return new Promise(function (resolver, rejeitar) {
        const leitor = new FileReader();
        leitor.onload = function () { resolver(leitor.result); };
        leitor.onerror = rejeitar;
        leitor.readAsDataURL(arquivo);
    });
}

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
            if (!contexto) return rejeitar(new Error("Canvas indisponível."));
            contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
            const foto = canvas.toDataURL("image/jpeg", 0.75);
            if (!foto.startsWith("data:image/jpeg;base64,")) return rejeitar(new Error("Imagem inválida."));
            resolver(foto);
        };
        imagem.onerror = rejeitar;
        imagem.src = dataUrl;
    });
}

function normalizar(valor) {
    return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapar(valor) {
    const elemento = document.createElement("span");
    elemento.textContent = valor == null ? "" : String(valor);
    return elemento.innerHTML;
}

function escaparFoto(valor) {
    const foto = typeof valor === "string" ? valor : valor && valor.imagem;
    const imagem = String(foto || "");
    const fonte = imagem.startsWith("/uploads/") ? API_BASE + imagem : imagem;
    return (/^data:image\/(?:jpeg|png|gif|webp);base64,/i.test(fonte)
        || /^\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)
        || /^https?:\/\/[^/]+\/uploads\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(fonte)) ? escapar(fonte) : "";
}

function obterUsuarioFoto(foto) {
    if (typeof foto === "object" && foto !== null && foto.usuario) return String(foto.usuario);
    return "Não identificado";
}

function mensagemErro(texto, erro) {
    const elemento = document.getElementById("mensagemErro");
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.toggle("erro", Boolean(erro));
}