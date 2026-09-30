// Gera o HTML de um carrossel a partir de JSON (marca + slides).
// Layouts: capa | padrao | destaque | passos | cta
const fs = require('fs');
const path = require('path');

const FONT_DIR = __dirname;
const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(FONT_DIR, f)).toString('base64');
const FONTS_CSS = `
@font-face{font-family:Anton;src:url(${font('anton-latin-400-normal.woff2')})}
@font-face{font-family:Anton;src:url(${font('anton-latin-ext-400-normal.woff2')});unicode-range:U+0100-024F}
@font-face{font-family:Inter;font-weight:400;src:url(${font('inter-latin-400-normal.woff2')})}
@font-face{font-family:Inter;font-weight:600;src:url(${font('inter-latin-600-normal.woff2')})}
@font-face{font-family:Inter;font-weight:800;src:url(${font('inter-latin-800-normal.woff2')})}
@font-face{font-family:Nunito;font-weight:800;src:url(${font('nunito-latin-800-normal.woff2')})}`;

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **negrito** vira destaque de cor; quebras de linha viram <br>
const rich = (s = '') => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const lines = (s = '') => esc(s).split('\n').join('<br>');
const rgba = (hex, a) => { const h = hex.replace('#', ''); const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h; return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`; };

function logoHTML(brand, onAccent) {
  if (brand.logoUrl) return `<img class="logoimg" src="${esc(brand.logoUrl)}">`;
  const c = onAccent ? brand.colors.bg : brand.colors.text;
  const eye = onAccent ? brand.colors.accent : brand.colors.bg;
  const mascot = brand.mascot === false ? '' :
    `<svg width="52" height="66" viewBox="0 0 64 80"><path d="M0 0h34a20 20 0 0 1 20 20v14a20 20 0 0 1-20 20H20v16a10 10 0 0 1-10 10A10 10 0 0 1 0 70V0z" fill="${c}"/><circle cx="16" cy="22" r="9" fill="${eye}"/><circle cx="38" cy="22" r="9" fill="${eye}"/><circle cx="17" cy="23" r="4" fill="${c}"/><circle cx="39" cy="23" r="4" fill="${c}"/></svg>`;
  return `<div class="logo" style="color:${c}">${mascot}<div class="word">${esc(brand.name)}${brand.byline ? `<span class="by">${esc(brand.byline)}</span>` : ''}</div></div>`;
}

function head(i, n) {
  const bars = Array.from({ length: n }, (_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
  return `<div class="num">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</div><div class="bar">${bars}</div>`;
}

function title(s, size = 'h-l') {
  const main = s.titulo ? lines(s.titulo) : '';
  const hl = s.destaque ? `<br><span class="hl">${lines(s.destaque)}</span>` : '';
  return `<h1 class="${size}">${main}${hl}</h1>`;
}

function foot(brand, s, i, n, onAccent) {
  const right = i === 0 ? `<div class="swipe">Arraste <svg width="44" height="24" viewBox="0 0 44 24"><path d="M0 12h38M28 2l10 10-10 10" stroke="currentColor" stroke-width="4" fill="none"/></svg></div>`
    : i === n - 1 ? `<div class="swipe" style="font-size:24px">${esc(brand.handle || '')}</div>` : `<div class="swipe">›››</div>`;
  return `<div class="foot">${logoHTML(brand, onAccent)}${right}</div>`;
}

function photoHTML(s) {
  const pos = /^[a-z0-9 %.-]{1,30}$/i.test(s.fotoPos || '') ? s.fotoPos : (s.layout === 'capa' ? 'center 25%' : 'center 12%');
  return `<div class="photo"><div class="photo-img" style="background-image:url('${esc(s.foto).replace(/'/g, '%27')}');background-position:${pos}"></div><div class="photo-fade"></div></div>`;
}

function slideHTML(brand, s, i, n) {
  const foto = s.foto && /^(https?:|data:image\/)/.test(s.foto) && ['capa', 'padrao', 'destaque'].includes(s.layout);
  const accentBg = !foto && (s.layout === 'destaque' || s.layout === 'passos');
  const cls = (accentBg ? 'slide acc' : 'slide') + (foto ? ' hasfoto' + (s.layout === 'capa' ? ' fcapa' : ' fint') : '');
  const tag = s.tag ? `<div class="tag">${esc(s.tag)}</div>` : '';
  let body = '';
  if (foto && s.layout === 'capa') {
    body = `${photoHTML(s)}<div class="stack bottom">${tag}${title(s, 'h-xl')}${s.texto ? `<p style="margin-top:24px">${rich(s.texto)}</p>` : ''}</div>`;
  } else if (foto) {
    body = `${photoHTML(s)}<div class="stack ftop">${tag}${title(s, 'h-m')}</div>${s.texto ? `<div class="stack low"><p>${rich(s.texto)}</p></div>` : ''}`;
  } else if (s.layout === 'capa') {
    const art = s.arte ? `<svg class="art" style="right:20px;top:130px" width="560" height="440" viewBox="0 0 620 520">
      <text x="600" y="430" text-anchor="end" font-family="Anton" font-size="440" fill="none" stroke="${brand.colors.accent}" stroke-width="6">${esc(s.arte)}</text>
      ${s.riscar !== false ? `<line x1="10" y1="470" x2="600" y2="60" stroke="${brand.colors.accent}" stroke-width="26" stroke-linecap="round"/>` : ''}</svg>` : '';
    body = `${art}<div class="stack bottom">${tag}${title(s, 'h-xl')}${s.texto ? `<p style="margin-top:28px">${rich(s.texto)}</p>` : ''}</div>`;
  } else if (s.layout === 'passos') {
    const passos = (s.passos || []).slice(0, 3).map((p, k) => `<div class="step ${k === 0 ? 'first' : ''}"><div class="sn">${String(k + 1).padStart(2, '0')}</div><div class="st">${esc(p.titulo || p.t || '')}</div><div class="sd">${esc(p.texto || p.d || '')}</div></div>`).join('<div class="arrow">→</div>');
    body = `<div class="stack top">${tag}${title(s)}</div><div class="steps">${passos}</div>${s.texto ? `<div class="stack low"><p>${rich(s.texto)}</p></div>` : ''}`;
  } else if (s.layout === 'cta') {
    const ctas = (s.ctas && s.ctas.length ? s.ctas : [{ titulo: 'Salve', texto: 'para rever depois' }, { titulo: 'Chame no direct', texto: 'e conversamos sobre o seu caso' }])
      .slice(0, 2).map((c, k) => `<div class="ctab ${k === 1 ? 'fill' : ''}"><div class="ct">${esc(c.titulo)}</div><div class="cd">${esc(c.texto)}</div></div>`).join('');
    body = `<div class="stack top">${tag}${title(s, 'h-xl')}</div><div class="stack mid"><p>${rich(s.texto || '')}</p></div><div class="stack ctas">${ctas}</div>`;
  } else {
    const longo = String(s.titulo || '').length + String(s.destaque || '').length > 40;
    const big = s.numero && !longo ? `<div class="bignum">${esc(s.numero)}</div>` : '';
    body = `${big}<div class="stack top">${tag}${title(s)}</div>${s.texto ? `<div class="stack low"><p>${rich(s.texto)}</p></div>` : ''}`;
  }
  return `<section class="${cls}" id="s${i + 1}">${head(i, n)}${body}${foot(brand, s, i, n, accentBg)}</section>`;
}

function buildHTML(payload) {
  const brand = Object.assign({ name: 'marca', colors: { bg: '#0A0A0A', accent: '#C6FF00', text: '#FFFFFF', muted: '#9A9A9A' } }, payload.brand || {});
  brand.colors = Object.assign({ bg: '#0A0A0A', accent: '#C6FF00', text: '#FFFFFF', muted: '#9A9A9A' }, brand.colors || {});
  const { bg, accent, text, muted } = brand.colors;
  const slides = payload.slides || [];
  const n = slides.length;
  const css = `${FONTS_CSS}
*{box-sizing:border-box;margin:0;padding:0}body{background:#333}
.slide{width:1080px;height:1350px;position:relative;overflow:hidden;background:${bg};color:${text};font-family:Inter,sans-serif}
.slide.acc{background:${accent};color:${bg}}
.num{position:absolute;top:72px;left:88px;font:800 26px Inter;letter-spacing:.08em;color:${accent}}.acc .num{color:${bg}}
.bar{position:absolute;top:84px;right:88px;display:flex;gap:8px}.bar i{display:block;width:36px;height:6px;border-radius:3px;background:rgba(255,255,255,.14)}.bar i.on{background:${accent}}
.acc .bar i{background:rgba(0,0,0,.18)}.acc .bar i.on{background:${bg}}
h1{font-family:Anton;font-weight:400;text-transform:uppercase;line-height:1.06}
.h-xl{font-size:104px}.h-l{font-size:92px}
.hl{display:inline-block;background:${accent};color:${bg};padding:6px 16px 2px;margin:10px 0 4px -16px;line-height:1.04}.acc .hl{background:${bg};color:${accent}}
p{font-size:38px;line-height:1.38;max-width:880px}p b{font-weight:800;color:${accent}}.acc p b{color:${bg};text-decoration:underline;text-decoration-thickness:4px;text-underline-offset:6px}
.tag{display:inline-block;font:800 24px Inter;letter-spacing:.14em;text-transform:uppercase;border:3px solid ${accent};color:${accent};padding:10px 20px;border-radius:40px;margin-bottom:40px}.acc .tag{border-color:${bg};color:${bg}}
.stack{position:absolute;left:88px;right:88px}.top{top:190px}.bottom{bottom:230px}.low{bottom:230px}.mid{top:700px}.ctas{top:930px;display:flex;gap:24px}
.bignum{position:absolute;right:60px;top:560px;font-family:Anton;font-size:360px;line-height:1;color:transparent;-webkit-text-stroke:5px ${accent};opacity:.9}
.steps{position:absolute;left:88px;right:88px;top:640px;display:flex;align-items:stretch;gap:14px}
.step{flex:1;border:5px solid ${bg};border-radius:24px;padding:26px}.step.first{background:${bg};color:${text}}
.sn{font:800 24px Inter}.step.first .sn{color:${accent}}.st{font:800 34px Inter;margin-top:14px}.sd{font:400 20px Inter;margin-top:8px;opacity:.75}
.arrow{align-self:center;font:800 36px Inter}
.ctab{flex:1;border:3px solid ${accent};border-radius:24px;padding:28px 30px}.ctab.fill{background:${accent};color:${bg}}
.ct{font:800 22px Inter;letter-spacing:.14em;text-transform:uppercase;color:${accent}}.ctab.fill .ct{color:${bg}}.cd{font:600 30px Inter;margin-top:10px}
.foot{position:absolute;left:88px;right:88px;bottom:72px;display:flex;align-items:center;justify-content:space-between}
.swipe{font:800 26px Inter;letter-spacing:.08em;text-transform:uppercase;color:${accent};display:flex;align-items:center;gap:14px}.acc .swipe{color:${bg}}
.logo{display:flex;align-items:center;gap:14px}.word{font-family:Nunito;font-weight:800;font-size:46px;line-height:.9}.by{display:block;font-size:17px;text-align:right;margin-top:2px}
.logoimg{height:66px}
.art{position:absolute}
.h-m{font-size:80px}
.photo{position:absolute;left:0;right:0;top:0}.photo-img,.photo-fade{position:absolute;inset:0}.photo-img{background-size:cover;filter:grayscale(.35) brightness(.82) contrast(1.12)}.photo-fade{background:linear-gradient(to bottom,var(--fade))}
.slide{--fade:${rgba(bg, .7)} 0%,${rgba(bg, 0)} 16%,${rgba(bg, 0)} 42%,${rgba(bg, .75)} 70%,${bg} 90%,${bg} 100%}
.fcapa .photo{height:900px}.fint .photo{height:620px}
.ftop{top:560px}.fint .low{bottom:200px}
.hasfoto .num,.hasfoto .bar{z-index:2}.hasfoto .stack,.hasfoto .foot{z-index:2}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body>${slides.map((s, i) => slideHTML(brand, s, i, n)).join('')}</body></html>`;
}

module.exports = { buildHTML };
