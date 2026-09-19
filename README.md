# Romaneio Tercerizacao

Aplicacao web para importar romaneios em Excel, acompanhar remessas e registrar a conferencia de pecas com evidencias fotograficas.

## Recursos

- Importacao de arquivos `.xlsx` e `.xls`.
- Cadastro de varias remessas com atualizacao em tempo real (Server-Sent Events).
- Busca de remessas por identificadores numericos ou alfanumericos.
- Historico de acesso rapido das ultimas 5 remessas consultadas.
- Conferencia por codigo da peca com leitura manual ou leitor de codigo.
- Registro de quantidade encontrada e peso conferido em tempo real.
- Adicao de ate 5 fotos por conferencia com autoria do usuario logado (admin ou comum).
- Compressao automatica de fotos (JPEG, 1000px, qualidade 0.75) com armazenamento obrigatorio no Cloudflare R2 e referencia leve exposta pela rota `uploads/`.
- Registro de data/hora de inicio da conferencia e data/hora de finalizacao da remessa.
- Consulta de progresso, status, pecas pendentes/conferidas e galeria de evidencias.
- Autenticacao com controle de usuarios comuns e administradores.
- Persistencia das remessas no Supabase com evidencias fotograficas no Cloudflare R2.

## Requisitos

- Node.js 18 ou superior.
- npm instalado.

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

## Estrutura

```text
index.html                  Importacao de romaneios
remessa.html                Conferencia de pecas
conferencia-remessa.html    Consulta de remessas e fotos
server.js                   Servidor HTTP e API local
css/                        Folhas de estilo
js/                         Logica do navegador
 Supabase + Cloudflare R2   Persistencia de remessas e fotos
```

## API local

- `GET /api/remessas` lista as remessas.
- `POST /api/remessas` cadastra uma remessa.
- `PUT /api/remessas/:id` atualiza uma remessa existente.

## Persistencia atual

A versao atual usa Supabase para os dados das remessas e Cloudflare R2 para as fotos JPEG. A API armazena cada nova foto diretamente no R2, persiste no banco apenas a chave do objeto e expõe a evidência para o front-end pela rota `/uploads/:id.jpg`. Fotos sem autoria identificada aparecem como "Nao identificado".

## Expiracao de fotos (90 dias)

Remessas, pecas e conferencias nunca sao excluidas: esses dados ficam disponiveis indefinidamente no Supabase para relatorios e dashboards. Apenas o **arquivo** de cada foto no Cloudflare R2 e removido apos 90 dias, contados individualmente a partir da data de registro daquela foto especifica (independente do codigo da peca ou da remessa). O registro da foto no Supabase (usuario que a tirou, data de registro, peca associada) e preservado mesmo apos a exclusao do arquivo; a peca continua contando como conferida e a interface exibe "Foto expirada" no lugar da imagem.

O script `scripts/expirar-fotos-r2.js` (`npm run cleanup:expired`) realiza essa limpeza e roda automaticamente todos os dias via GitHub Actions (`.github/workflows/expirar-fotos-r2.yml`). Para o workflow funcionar, cadastre os seguintes secrets no repositorio (Settings > Secrets and variables > Actions):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`

## Desenvolvimento

Antes de publicar alteracoes:

```powershell
node --check server.js
node --check js/script.js
node --check js/remessa.js
node --check js/conferencia-remessa.js
```

## Licenca

Este projeto esta licenciado sob a [Licenca MIT](LICENSE).
