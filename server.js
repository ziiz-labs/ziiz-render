// Serviço de renderização de carrosséis (JSON -> PNG 1080x1350)
// POST /render  { brand, slides, jobId? }  -> { jobId, images:[url...] }
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { buildHTML } = require('./template');

const PORT = process.env.PORT || 8080;
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, 'out');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const RENDER_KEY = process.env.RENDER_KEY || '';
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 30);
const BRANDS_DIR = path.join(__dirname, 'brands');

fs.mkdirSync(OUT_DIR, { recursive: true });
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/files', express.static(OUT_DIR, { maxAge: '7d' }));

let browserPromise = null;
const getBrowser = () => (browserPromise ||= chromium.launch({ args: ['--no-sandbox'] }));

app.get('/health', (_req, res) => res.json({ ok: true, fotos: FOTOS_ON }));

// Fotos reais: slides com "foto_busca" (termo em inglês) recebem uma foto de banco de imagens
// com uso comercial liberado. Usa o primeiro provedor com chave: PEXELS_KEY, PIXABAY_KEY ou UNSPLASH_KEY.
// Sem chave ou sem resultado, o slide sai sem foto (nada quebra).
const PEXELS_KEY = process.env.PEXELS_KEY || '';
const PIXABAY_KEY = process.env.PIXABAY_KEY || '';
const UNSPLASH_KEY = process.env.UNSPLASH_KEY || process.env.UNPLASH_KEY || '';
const FOTOS_ON = !!(PEXELS_KEY || PIXABAY_KEY || UNSPLASH_KEY);
const getJSON = async (url, headers = {}) => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(url.split('?')[0] + ' ' + r.status); return r.json(); };
// nota de aderência: palavras da busca presentes na descrição da foto + presença de pessoa adulta
const PESSOA = /\b(man|woman|men|women|person|people|businessman|businesswoman|entrepreneur|owner|worker|employee|adult|guy|lady|receptionist|seller|customer)\b/i;
const EVITAR = /\b(child|children|kid|kids|baby|toddler|girl|boy|toy|cartoon|illustration|3d|render|sale|dog|cat|pet)\b/i;
const NEG = /\b(worried|worry|stress|stressed|frustrated|frustration|sad|tired|angry|confused|anxious|overwhelmed|upset|problem|pensive|thinking|serious)\b/i;
const POS = /\b(smiling|smile|happy|happiness|confident|joy|joyful|laughing|laugh|cheerful|success|excited)\b/i;
function ranquear(lista, q) {
  const termos = q.toLowerCase().split(/[^a-z]+/).filter(t => t.length > 2 && !['with','the','and','for','looking','small','many'].includes(t));
  return lista.map((p, i) => {
    const d = (p.desc || '').toLowerCase();
    let n = termos.reduce((a, t) => a + (d.includes(t) ? 2 : 0), 0);
    if (PESSOA.test(d)) n += 3;
    // emoção pedida pesa mais; emoção oposta derruba a nota
    if (NEG.test(q) && NEG.test(d)) n += 4; if (NEG.test(q) && POS.test(d)) n -= 4;
    if (POS.test(q) && POS.test(d)) n += 4; if (POS.test(q) && NEG.test(d)) n -= 4;
    if (EVITAR.test(d)) n -= 6;
    return { ...p, nota: n - i * 0.05 };
  }).filter(p => p.nota > 0).sort((a, b) => b.nota - a.nota);
}

// consulta todos os bancos com chave e intercala os resultados; se um falhar, os outros cobrem
async function buscarFotos(q) {
  const e = encodeURIComponent(q);
  const fontes = [];
  if (PEXELS_KEY) fontes.push(getJSON(`https://api.pexels.com/v1/search?query=${e}&orientation=portrait&size=large&per_page=15`, { Authorization: PEXELS_KEY })
    .then(j => (j.photos || []).map(p => ({ id: 'px' + p.id, src: p.src.large2x || p.src.large, pagina: p.url, autor: p.photographer, banco: 'Pexels', desc: p.alt || '' }))));
  if (PIXABAY_KEY) fontes.push(getJSON(`https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${e}&image_type=photo&orientation=vertical&safesearch=true&per_page=40`)
    .then(j => (j.hits || []).map(p => ({ id: 'pb' + p.id, src: p.largeImageURL, pagina: p.pageURL, autor: p.user, banco: 'Pixabay', desc: p.tags || '' }))));
  if (UNSPLASH_KEY) fontes.push(getJSON(`https://api.unsplash.com/search/photos?query=${e}&orientation=portrait&per_page=15&content_filter=high`, { Authorization: 'Client-ID ' + UNSPLASH_KEY })
    .then(j => (j.results || []).map(p => ({ id: 'us' + p.id, src: p.urls.regular, pagina: p.links.html, autor: p.user && p.user.name, dl: p.links.download_location, banco: 'Unsplash', desc: (p.alt_description || '') + ' ' + (p.description || '') }))));
  const listas = (await Promise.allSettled(fontes)).map(r => {
    if (r.status === 'rejected') { console.error('foto:', r.reason && r.reason.message); return []; }
    return ranquear(r.value, q).slice(0, 4); // só os mais aderentes de cada banco
  });
  const mix = [];
  for (let i = 0; i < 6; i++) for (const l of listas) if (l[i]) mix.push(l[i]);
  return mix;
}
async function resolverFotos(slides) {
  const creditos = [];
  if (!FOTOS_ON) return creditos;
  const usadas = new Set();
  for (const s of slides) {
    if (s.foto || !s.foto_busca) continue;
    try {
      const fotos = (await buscarFotos(String(s.foto_busca).slice(0, 100))).filter(p => p.src && !usadas.has(p.id));
      if (!fotos.length) continue;
      const p = fotos[Math.floor(Math.random() * Math.min(2, fotos.length))];
      usadas.add(p.id);
      s.foto = p.src;
      if (p.dl) fetch(p.dl, { headers: { Authorization: 'Client-ID ' + UNSPLASH_KEY } }).catch(() => {});
      creditos.push({ busca: s.foto_busca, banco: p.banco, foto: p.pagina, autor: p.autor });
    } catch (e) { console.error('foto:', e.message); }
  }
  return creditos;
}

app.post('/render', async (req, res) => {
  if (RENDER_KEY && req.get('x-render-key') !== RENDER_KEY) return res.status(401).json({ error: 'unauthorized' });
  try {
    const body = req.body || {};
    // brand pode vir inline ou por nome (brands/<slug>.json)
    let brand = body.brand;
    if (typeof brand === 'string') brand = JSON.parse(fs.readFileSync(path.join(__dirname, `brand-${brand.replace(/[^a-z0-9-]/gi, '')}.json`), 'utf8'));
    const slides = body.slides;
    if (!Array.isArray(slides) || !slides.length || slides.length > 10) return res.status(400).json({ error: 'slides deve ter de 1 a 10 itens' });

    const jobId = (body.jobId || crypto.randomUUID()).replace(/[^a-z0-9-]/gi, '');
    const creditos = await resolverFotos(slides);
    const dir = path.join(OUT_DIR, jobId);
    fs.mkdirSync(dir, { recursive: true });

    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
    await page.setContent(buildHTML({ brand, slides }), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const images = [];
    for (let i = 1; i <= slides.length; i++) {
      const file = `slide-${String(i).padStart(2, '0')}.png`;
      await page.locator(`#s${i}`).screenshot({ path: path.join(dir, file) });
      images.push(`${PUBLIC_BASE_URL}/files/${jobId}/${file}`);
    }
    await page.close();
    res.json({ jobId, images, fotos: creditos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// limpeza diária de renders antigos
setInterval(() => {
  const limit = Date.now() - KEEP_DAYS * 86400e3;
  for (const d of fs.readdirSync(OUT_DIR)) {
    const p = path.join(OUT_DIR, d);
    try { if (fs.statSync(p).mtimeMs < limit) fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}, 86400e3);

app.listen(PORT, () => console.log(`render-service ouvindo na porta ${PORT}`));
