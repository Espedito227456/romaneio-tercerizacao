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
        return numero === busca || numero.endsWith(busca);
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
        .getElementById("dataRemessa")
        .textContent =
            remessaAtual.data || "Não informada";


    document
        .getElementById("campoPeca")
        .value = "";


    atualizarInformacoes();

    renderPecas();
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


    if (quantidadeConferida === total) {

        status.innerHTML = `
            <span class="status status-finalizada">
                🟢 FINALIZADA
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
                Number(peca.encontrada) >= Number(peca.quantidade)

                    ? `
                        <span class="badge badge-ok">
                            ✅ Conferida
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
                            ${peca.codigo}
                        </div>

                        <div class="nome">
                            ${peca.descricao || "Sem descrição"}
                        </div>

                        <div>
                            ${status}
                        </div>

                        <div class="fotos-count">

                            📷
                            ${(peca.fotos || []).length}
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

    const fotos = pecaAtual.fotos || [];


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

            lista.innerHTML += `

                <div class="foto-card">

                    <img
                        src="${foto}"
                        alt="Foto da peça"
                    >

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

    const arquivo =
        event.target.files[0];


    if (!arquivo) {
        return;
    }


    const leitor =
        new FileReader();


    leitor.onload = function (e) {

        if (!Array.isArray(pecaAtual.fotos)) {
            pecaAtual.fotos = [];
        }

        pecaAtual.fotos.push(
            e.target.result
        );

        salvarRemessas();


        renderFotos();

        renderPecas();

    };


    leitor.readAsDataURL(arquivo);


    event.target.value = "";

}


/* =====================================================
   EXCLUIR FOTO
===================================================== */

function excluirFoto(indice) {

    const confirmar =
        confirm(
            "Tem certeza que deseja excluir esta foto?"
        );


    if (!confirmar) {
        return;
    }


    pecaAtual.fotos.splice(
        indice,
        1
    );

    salvarRemessas();


    renderFotos();

    renderPecas();

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

}

let remessas = [];
const canalTempoReal = new EventSource("/api/tempo-real");
canalTempoReal.addEventListener("remessa:atualizada", function (evento) {
    const atualizada = JSON.parse(evento.data);
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
    renderPecas();
    if (pecaAtual) renderFotos();
});
carregarRemessas();

function carregarRemessas() {
    fetch("/api/remessas")
        .then(function (resposta) { return resposta.ok ? resposta.json() : Promise.reject(); })
        .then(function (dados) {
            remessas = Array.isArray(dados)
                ? dados.filter(function (remessa) {
                return remessa && remessa.numero && Array.isArray(remessa.pecas);
            })
                : [];
            const numeroInicial = new URLSearchParams(window.location.search).get("remessa");
            if (numeroInicial) {
                document.getElementById("campoRemessa").value = numeroInicial;
                buscarRemessa();
            }
        })
        .catch(function () {
            remessas = [];
        });
}

async function salvarRemessas() {
    try {
        const respostas = await Promise.all(remessas.map(function (remessa) {
            return fetch("/api/remessas/" + encodeURIComponent(remessa.id || remessa.numero), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(remessa)
            }).then(async function (resposta) {
                if (resposta.status === 409) {
                    const dados = await resposta.json();
                    if (dados.remessa) {
                        const indice = remessas.findIndex(function (item) { return String(item.id || item.numero) === String(dados.remessa.id || dados.remessa.numero); });
                        if (indice >= 0) remessas[indice] = dados.remessa;
                        if (remessaAtual && String(remessaAtual.id || remessaAtual.numero) === String(dados.remessa.id || dados.remessa.numero)) {
                            remessaAtual = dados.remessa;
                            pecaAtual = null;
                            atualizarInformacoes(); renderPecas(); renderFotos();
                        }
                    }
                }
                return resposta;
            });
        }));
        return respostas.every(function (resposta) { return resposta.ok; });
    } catch (_) {
        return false;
    }
}