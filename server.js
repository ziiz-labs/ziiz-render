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

app.get('/health', (_req, res) => res.json({ ok: true, fotos: !!PEXELS_KEY }));

// Fotos reais: slides com "foto_busca" (termo em inglês) recebem uma foto do banco Pexels
// (uso comercial liberado). Sem PEXELS_KEY ou sem resultado, o slide sai sem foto.
const PEXELS_KEY = process.env.PEXELS_KEY || '';
async function resolverFotos(slides) {
  const creditos = [];
  if (!PEXELS_KEY) return creditos;
  const usadas = new Set();
  for (const s of slides) {
    if (s.foto || !s.foto_busca) continue;
    try {
      const q = encodeURIComponent(String(s.foto_busca).slice(0, 100));
      const r = await fetch(`https://api.pexels.com/v1/search?query=${q}&orientation=portrait&size=large&per_page=15`, { headers: { Authorization: PEXELS_KEY } });
      if (!r.ok) throw new Error('Pexels ' + r.status);
      const fotos = ((await r.json()).photos || []).filter(p => !usadas.has(p.id));
      if (!fotos.length) continue;
      const p = fotos[Math.floor(Math.random() * Math.min(5, fotos.length))];
      usadas.add(p.id);
      s.foto = p.src.large2x || p.src.large || p.src.original;
      creditos.push({ busca: s.foto_busca, foto: p.url, autor: p.photographer });
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
