# Romaneio Tercerizacao

Aplicacao web para importar romaneios em Excel, acompanhar remessas e registrar a conferencia de pecas com evidencias fotograficas.

## Recursos

- Importacao de arquivos `.xlsx` e `.xls`.
- Cadastro de varias remessas.
- Busca de remessas por identificadores numericos ou alfanumericos.
- Conferencia por codigo da peca.
- Registro de quantidade encontrada.
- Adicao de ate cinco fotos por conferencia.
- Compressao das fotos no navegador antes do armazenamento local.
- Consulta de progresso, faltantes e evidencias.
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

A versao atual usa `data/remessas.json`. As fotos sao comprimidas no navegador e armazenadas temporariamente junto aos dados da remessa. Esse modelo e adequado para desenvolvimento local, mas nao e recomendado para uso simultaneo em varios dispositivos.

A proxima etapa planejada e migrar os dados para o Supabase e armazenar as fotos JPEG no Cloudflare R2, usando a API publicada no Vercel.

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


oi som oi som 
