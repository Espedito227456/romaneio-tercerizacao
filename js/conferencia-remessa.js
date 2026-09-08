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
                        src="${escaparFoto(foto)}"
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
    lerFoto(arquivo).then(comprimirFoto).then(function (foto) {
        if (!pecaAtual || pecaAtual !== pecaEditada) return;
        if (!Array.isArray(pecaEditada.fotos)) {
            pecaEditada.fotos = [];
        }

        pecaEditada.fotos.push(foto);
        return salvarRemessas().then(function (salvou) {
            if (!salvou) {
                if (pecaAtual === pecaEditada) pecaEditada.fotos.pop();
                return;
            }
            renderFotos();
            renderPecas();
        });
    }).catch(function () {
        if (pecaAtual === pecaEditada) {
            pecaEditada.fotos.pop();
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
    const fotoRemovida = pecaEditada.fotos.splice(indice, 1)[0];
    salvarRemessas().then(function (salvou) {
        if (!salvou) {
            if (pecaAtual === pecaEditada) pecaEditada.fotos.splice(indice, 0, fotoRemovida);
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

}

let remessas = [];
const canalTempoReal = new EventSource("/api/tempo-real");
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
        const resposta = await fetch("/api/remessas/" + encodeURIComponent(remessaAtual.id || remessaAtual.numero), {
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
            const limite = 1280;
            const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
            canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
            const contexto = canvas.getContext("2d");
            if (!contexto) return rejeitar(new Error("Canvas indisponível."));
            contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
            const foto = canvas.toDataURL("image/jpeg", 0.72);
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
    const foto = String(valor || "");
    return /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(foto) ? escapar(foto) : "";
}

function mensagemErro(texto, erro) {
    const elemento = document.getElementById("mensagemErro");
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.toggle("erro", Boolean(erro));
}