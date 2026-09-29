# ziiz-render

Gerador de carrosséis: recebe JSON (marca + slides) e devolve PNGs 1080×1350.
Publicado pelo Coolify (build pack: Dockerfile) em https://render.fullagenda.com.br

## Variáveis de ambiente (Coolify)
- `PUBLIC_BASE_URL` = https://render.fullagenda.com.br
- `RENDER_KEY` = chave secreta; o n8n envia no header `x-render-key`
- `KEEP_DAYS` = 30 (dias que as imagens ficam guardadas)

## Uso
POST /render  (header x-render-key)  body: ver exemplo.json  →  { jobId, images: [urls] }
GET  /health

## Marcas
Arquivo `brand-<nome>.json` na raiz (nome, byline, handle, cores). Para cliente novo, copie `brand-petroo.json`.

## Layouts
capa · padrao · destaque · passos · cta  (campos em exemplo.json). No texto, **assim** destaca e \n quebra linha.

## Fotos reais (opcional)

Em `capa`, `padrao` ou `destaque`, envie `"foto_busca": "termo em inglês"` (ex.: `"worried shop owner looking at phone"`) e o serviço busca uma foto real em banco de imagens (Pixabay, Pexels ou Unsplash; uso comercial liberado). A foto entra no topo do slide com degradê para a cor de fundo; o título fica abaixo. Também dá para mandar a foto pronta em `"foto": "https://..."` e ajustar o enquadramento com `"fotoPos": "center 20%"`.

Para ligar: crie uma chave grátis e coloque no app no Coolify, em uma destas variáveis: `PIXABAY_KEY` (pixabay.com/api/docs), `PEXELS_KEY` (pexels.com/api) ou `UNSPLASH_KEY` (unsplash.com/developers, a Access Key). Sem a chave, os slides saem sem foto (nada quebra). O `/health` mostra `"fotos": true` quando está ativo.
