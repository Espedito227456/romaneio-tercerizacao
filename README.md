# Romaneio Tercerizacao

Aplicacao web para importar romaneios em Excel, acompanhar remessas e registrar a conferencia de pecas com evidencias fotograficas.

## Visao geral

O sistema e composto por:

- **Front-end estatico** em HTML, CSS e JavaScript puro.
- **Servidor Node.js** em `server.js`, responsavel por servir os arquivos, validar dados e expor a API.
- **Supabase** como banco principal de usuarios, remessas, pecas, conferencias e registros de fotos.
- **Cloudflare R2** como armazenamento dos arquivos de imagem.
- **Server-Sent Events (SSE)** para atualizar telas abertas quando uma remessa e criada, alterada ou excluida.

## Recursos

- Importacao de arquivos `.xlsx` e `.xls`.
- Cadastro de varias remessas com atualizacao em tempo real.
- Busca de remessas por identificadores numericos ou alfanumericos.
- Historico de acesso rapido das ultimas 5 remessas consultadas por usuario.
- Conferencia por codigo da peca com leitura manual ou leitor de codigo.
- Registro de quantidade encontrada e peso conferido em tempo real.
- Adicao de ate 5 fotos por conferencia com autoria do usuario logado.
- Compressao automatica de fotos para JPEG com largura/altura maxima de 1000px e qualidade 0.75.
- Armazenamento obrigatorio das fotos no Cloudflare R2.
- Referencia leve das fotos no front-end pela rota `/uploads/:id.jpg`.
- Registro de data/hora de inicio da conferencia e data/hora de finalizacao da remessa.
- Consulta de progresso, status, pecas pendentes/conferidas e galeria de evidencias.
- Autenticacao com controle de usuarios comuns e administradores.
- Expiracao automatica de arquivos de foto apos 90 dias, preservando o registro da evidencia no banco.

## Arquitetura

```text
Navegador
  |
  |-- login.html / cadastro.html / troca-senha.html
  |      `-- js/auth.js + scripts especificos de autenticacao
  |
  |-- index.html
  |      `-- js/script.js le Excel e envia POST /api/remessas
  |
  |-- remessa.html
  |      `-- js/remessa.js confere pecas, comprime fotos e envia PUT /api/remessas/:id
  |
  |-- conferencia-remessa.html
         `-- js/conferencia-remessa.js consulta progresso, fotos e permite ajustes

server.js
  |
  |-- Servidor de arquivos estaticos
  |-- API HTTP JSON
  |-- Canal SSE /api/tempo-real
  |-- Supabase: usuarios, remessas, pecas, conferencias, fotos_pecas
  `-- Cloudflare R2: arquivos JPEG das fotos
```

## Estrutura de pastas

```text
assets/                         Imagens e identidade visual.
css/                            Estilos das telas.
data/                           Estrutura legada/local mantida por compatibilidade.
js/auth.js                      Sessao local, protecao de telas e menu do usuario.
js/script.js                    Importacao do Excel e montagem da remessa.
js/remessa.js                   Conferencia operacional das pecas.
js/conferencia-remessa.js       Consulta de remessas, progresso e fotos.
js/cadastro.js                  Criacao de usuario comum.
js/login.js                     Login de usuario/admin.
js/troca-senha.js               Alteracao de senha do usuario logado.
scripts/expirar-fotos-r2.js     Limpeza dos arquivos de foto com mais de 90 dias.
server.js                       Servidor HTTP, API, Supabase, R2 e tempo real.
```

## Fluxo das telas

### 1. Login (`login.html`)

1. O usuario informa usuario e senha.
2. `js/login.js` envia `POST /api/login`.
3. Se a autenticacao for valida, `js/auth.js` salva a sessao em `localStorage`.
4. Administrador vai para `index.html`; usuario comum vai para `remessa.html`.

### 2. Cadastro (`cadastro.html`)

1. O usuario informa nome, senha e confirmacao.
2. `js/cadastro.js` valida tamanho minimo e igualdade das senhas.
3. A tela envia `POST /api/cadastro`.
4. O novo usuario e logado automaticamente e segue para o fluxo operacional.

### 3. Importacao (`index.html`)

1. Um administrador seleciona um arquivo Excel.
2. `js/script.js` localiza o cabecalho, extrai numero/semana/produto/servico e agrupa pecas repetidas.
3. A remessa e enviada por `POST /api/remessas`.
4. O servidor valida, grava no Supabase e dispara `remessa:criada` no canal de tempo real.
5. A tela redireciona para `remessa.html`.

### 4. Conferencia operacional (`remessa.html`)

1. O usuario busca uma remessa pelo numero.
2. `js/remessa.js` carrega remessas por `GET /api/remessas`.
3. O usuario localiza uma peca pelo codigo.
4. Informa a quantidade encontrada e adiciona de 1 a 5 fotos.
5. O navegador comprime as imagens para JPEG.
6. A remessa completa e reenviada por `PUT /api/remessas/:id`.
7. O servidor atualiza a remessa, salva fotos no R2, grava referencias no Supabase e dispara `remessa:atualizada`.
8. Quando todas as pecas ficam conferidas com foto, a remessa recebe data de finalizacao.

### 5. Consulta e fotos (`conferencia-remessa.html`)

1. O usuario busca uma remessa.
2. A tela exibe total, conferidas, pendentes, progresso e status.
3. A lista de pecas pode ser filtrada por codigo ou descricao.
4. O modal de fotos mostra evidencias registradas e autoria.
5. Fotos expiradas continuam listadas, mas aparecem como "Foto expirada".
6. Alteracoes de foto tambem usam `PUT /api/remessas/:id`.

### 6. Troca de senha (`troca-senha.html`)

1. `js/auth.js` exige uma sessao ativa.
2. O usuario informa e confirma a nova senha.
3. A tela envia `POST /api/trocar-senha`.
4. Apos sucesso, o usuario volta para a tela adequada ao perfil.

## API local

### Autenticacao

- `POST /api/login`
  - Entrada: `{ "usuario": "...", "senha": "..." }`
  - Saida: `{ "usuario": "...", "tipo": "admin|user", "token": "..." }`
  - Uso: autentica usuario e cria uma sessao em memoria no servidor.

- `POST /api/cadastro`
  - Entrada: `{ "usuario": "...", "senha": "..." }`
  - Saida: `{ "usuario": "...", "tipo": "user" }`
  - Uso: cria usuario comum ativo no Supabase.

- `POST /api/trocar-senha`
  - Entrada: `{ "usuario": "...", "senha": "..." }`
  - Uso: troca a senha de um usuario ativo.

### Remessas

- `GET /api/remessas`
  - Lista todas as remessas com pecas e fotos.

- `POST /api/remessas`
  - Cria uma nova remessa.
  - Retorna `409` quando o numero ja existe.

- `PUT /api/remessas/:id`
  - Atualiza remessa, pecas, quantidades e fotos.
  - Usa `versao` para evitar sobrescrever alteracoes feitas por outro usuario.
  - Retorna `409` com a remessa mais recente em caso de conflito.

- `DELETE /api/remessas/:id`
  - Exclui uma remessa.
  - Exige token Bearer de administrador.

### Tempo real e fotos

- `GET /api/tempo-real`
  - Abre um canal SSE.
  - Eventos principais: `remessa:criada`, `remessa:atualizada`, `remessa:excluida`.

- `GET /uploads/:id.jpg`
  - Consulta o `arquivo_key` no Supabase.
  - Se a foto existir no R2, redireciona para uma URL assinada temporaria.
  - Se o arquivo ja expirou, retorna `404` com mensagem de foto expirada.

## Modelo de dados esperado

Uma remessa trafega entre front-end e API com formato semelhante a:

```json
{
  "id": "uuid-opcional",
  "numero": "REMESSA 017873",
  "servico": "Servico",
  "produto": "Produto",
  "semana": "36",
  "dataCriacao": "21/09/2026 20:10",
  "dataFinalizacao": "21/09/2026 21:00",
  "pesoTotalKg": 120.5,
  "versao": 3,
  "pecas": [
    {
      "codigo": "001245",
      "descricao": "Peca ABC",
      "quantidade": 10,
      "encontrada": 4,
      "pesoKg": 12.5,
      "fotos": [
        {
          "imagem": "/uploads/uuid-da-foto.jpg",
          "id": "uuid-da-foto",
          "usuario": "operador",
          "dataRegistro": "21/09/2026 20:30"
        }
      ]
    }
  ]
}
```

## Persistencia

### Supabase

O Supabase guarda:

- usuarios e hashes/salts de senha;
- remessas e versao de concorrencia;
- pecas da remessa;
- conferencias registradas;
- metadados das fotos, como usuario, data e chave do arquivo no R2.

### Cloudflare R2

O R2 guarda apenas os arquivos JPEG. O banco guarda a chave (`arquivo_key`) para localizar o arquivo. A aplicacao nunca expoe diretamente uma chave privada do R2 ao navegador; a rota `/uploads/:id.jpg` cria uma URL assinada temporaria.

## Expiracao de fotos (90 dias)

Remessas, pecas e conferencias nunca sao excluidas pelo processo de expiracao. Apenas o arquivo de imagem no Cloudflare R2 e removido apos 90 dias, contados individualmente a partir da data de registro da foto.

O registro da foto permanece no Supabase para preservar:

- usuario que tirou a foto;
- data de registro;
- peca associada;
- historico de que houve evidencia na conferencia.

Como a coluna `arquivo_key` e obrigatoria, o sistema usa string vazia para indicar foto expirada.

O script responsavel e:

```powershell
npm run cleanup:expired
```

Ele e executado automaticamente pelo GitHub Actions em `.github/workflows/expirar-fotos-r2.yml`.

## Variaveis de ambiente

Crie um arquivo `.env` local ou configure secrets no ambiente de execucao:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
PORT=3000
```

## Requisitos

- Node.js 18 ou superior.
- npm instalado.
- Projeto Supabase com as tabelas esperadas.
- Bucket Cloudflare R2 configurado.

## Execucao local

No diretorio do projeto:

```powershell
npm start
```

A aplicacao ficara disponivel em:

```text
http://localhost:3000
```

Para acessar por outro dispositivo na mesma rede, use o endereco IP do computador, por exemplo:

```text
http://192.168.1.105:3000
```

## Desenvolvimento

Antes de publicar alteracoes de JavaScript:

```powershell
node --check server.js
node --check js/auth.js
node --check js/script.js
node --check js/remessa.js
node --check js/conferencia-remessa.js
node --check js/login.js
node --check js/cadastro.js
node --check js/troca-senha.js
node --check scripts/expirar-fotos-r2.js
```

## Observacoes de manutencao

- Comentarios no codigo explicam blocos e regras de negocio; evite comentar apenas o obvio.
- Ao alterar o formato da remessa, atualize front-end, `validarRemessa` em `server.js` e este README.
- Ao mudar regras de foto, confira tambem `scripts/expirar-fotos-r2.js`.
- Nao commitar `.env` ou credenciais.

## Licenca

Este projeto esta licenciado sob a [Licenca MIT](LICENSE).
