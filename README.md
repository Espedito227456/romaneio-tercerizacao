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
- Persistencia local em arquivo JSON durante a fase atual.

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
 data/remessas.json         Armazenamento local atual
```

## API local

- `GET /api/remessas` lista as remessas.
- `POST /api/remessas` cadastra uma remessa.
- `PUT /api/remessas/:id` atualiza uma remessa existente.

## Persistencia atual

A versao atual usa Supabase para os dados das remessas e Cloudflare R2 para as fotos JPEG. A API armazena cada nova foto diretamente no R2, persiste no banco apenas a chave do objeto e expõe a evidência para o front-end pela rota `/uploads/:id.jpg`. Fotos antigas sem autoria aparecem como "Nao identificado".

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
