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
