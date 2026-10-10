'use strict';
// Freitas License Server - New Vehicles | zero dependencias (Node >= 16)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- .env ----------
try {
  for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* sem .env */ }

const PORT = +process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const PRODUCT_SECRET = process.env.PRODUCT_SECRET || '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || '';
const os = require('os');
const ORIG_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PRODUCTS = (process.env.PRODUCTS || 'new_vehicles,CustomClothes').split(',').map((x) => x.trim()).filter(Boolean);
const DEFAULT_PRODUCT = 'new_vehicles'; // keys antigas sem campo 'product'

if (!ADMIN_PASSWORD || !PRODUCT_SECRET || /troque/i.test(ADMIN_PASSWORD + PRODUCT_SECRET)) {
  console.error('Configure ADMIN_PASSWORD e PRODUCT_SECRET no arquivo .env (veja .env.example).');
  process.exit(1);
}
const SESSION_SECRET = crypto.createHash('sha256').update('sess|' + ADMIN_PASSWORD + '|' + PRODUCT_SECRET).digest();

// ---------- util ----------
const now = () => Math.floor(Date.now() / 1000);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
// Mesmo algoritmo do license.lua
function sign(status, exp, nonce, key, ts) {
  const msg = [status, exp, nonce, key, ts].join('|');
  const inner = sha256(PRODUCT_SECRET + '|' + msg);
  return sha256(PRODUCT_SECRET + '|' + inner);
}
function getIp(req) {
  let ip = req.socket.remoteAddress || '';
  if (TRUST_PROXY) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xf.length) ip = xf[xf.length - 1]; // ultimo = adicionado pelo seu proxy
  }
  return ip.replace(/^::ffff:/, '');
}

// ---------- banco (JSON) ----------
function writableDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); return true; } catch (e) { return false; }
}
// Em hosts com disco somente-leitura (ex.: Vercel) usa a pasta temporaria
let DATA_DIR = ORIG_DIR;
if (!writableDir(DATA_DIR)) {
  DATA_DIR = path.join(os.tmpdir(), 'freitas-license');
  writableDir(DATA_DIR);
  console.warn('[aviso] disco somente-leitura; usando ' + DATA_DIR + ' (dados NAO sao permanentes nesse host)');
}
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { settings: { maxInvalidAttempts: 1 }, licenses: {}, blocks: {}, invalid: {}, manifests: {}, logs: [] };
for (const f of [DB_FILE, path.join(ORIG_DIR, 'db.json')]) {
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(f, 'utf8'))); break; } catch (e) { /* tenta o proximo */ }
}
// Nunca lanca erro: falha de gravacao nao pode virar HTTP 500
function save() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    if (!save.warned) { console.error('[save] falha ao gravar o banco:', e.message); save.warned = true; }
  }
}
function log(type, msg, extra) {
  db.logs.unshift(Object.assign({ t: now(), type, msg }, extra || {}));
  if (db.logs.length > 500) db.logs.length = 500;
}
function notify(text) {
  if (!DISCORD_WEBHOOK) return;
  try {
    const u = new URL(DISCORD_WEBHOOK);
    const body = JSON.stringify({ content: text.slice(0, 1800) });
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
    r.on('error', () => {}); r.end(body);
  } catch (e) { /* ignora */ }
}

// ---------- bloqueios ----------
function activeBlockForIp(ip) {
  return Object.values(db.blocks).find((b) => b.active && b.ip === ip);
}
function createBlock({ ip, name, reason, key, licenseKey }) {
  let b = activeBlockForIp(ip);
  if (b) {
    b.attempts++; b.lastAttempt = now(); b.reason = reason;
    if (name && b.name === 'Desconhecido') b.name = name;
    if (licenseKey) b.licenseKey = licenseKey;
  } else {
    const id = crypto.randomBytes(6).toString('hex');
    b = db.blocks[id] = { id, ip, name: name || 'Desconhecido', reason, key: key || '', licenseKey: licenseKey || '',
      createdAt: now(), lastAttempt: now(), attempts: 1, active: true };
  }
  log('block', `${b.name} (${ip}) bloqueado: ${reason}`, { ip });
  notify(`🔒 **New Vehicles/Clothes** | Bloqueado: **${b.name}** | IP \`${ip}\` | ${reason}`);
  return b;
}
function unblock(id) {
  const b = db.blocks[id];
  if (!b) return false;
  b.active = false; b.unblockedAt = now();
  db.invalid[b.ip] = 0;
  if (b.licenseKey && db.licenses[b.licenseKey]) {
    db.licenses[b.licenseKey].blocked = false;
    db.licenses[b.licenseKey].blockReason = '';
  }
  log('unblock', `Desbloqueado: ${b.name} (${b.ip})`);
  return true;
}

// ---------- manifesto ----------
function parseManifest(s) {
  const o = {};
  for (const part of String(s || '').split(';')) {
    const i = part.lastIndexOf('=');
    if (i > 0) o[part.slice(0, i)] = part.slice(i + 1).toLowerCase();
  }
  return o;
}
function diffManifest(official, got) {
  const out = [];
  for (const f of Object.keys(official)) {
    if (!(f in got)) out.push(`removido/renomeado: ${f}`);
    else if (got[f] !== official[f]) out.push(`alterado: ${f}`);
  }
  for (const f of Object.keys(got)) if (!(f in official)) out.push(`arquivo extra: ${f}`);
  return out;
}

// ---------- /api/v1/check ----------
const hits = new Map();
function rateLimited(ip, limit, windowSec) {
  const t = now(); const h = hits.get(ip) || [];
  const recent = h.filter((x) => t - x < windowSec); recent.push(t); hits.set(ip, recent);
  return recent.length > limit;
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (!v.some((x) => t - x < 900)) hits.delete(k); }, 60000).unref();

function reply(res, key, nonce, status, extra) {
  extra = extra || {};
  const ts = String(now());
  const exp = String(extra.exp || 0);
  const lines = [
    `status=${status}`, `msg=${clean(extra.msg, 200)}`, `exp=${exp}`, `ts=${ts}`,
    `nonce=${nonce}`, `type=${extra.type || ''}`, `mac=${sign(status, exp, nonce, key, ts)}`,
  ];
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(lines.join('\n'));
}

function handleCheck(req, res, p) {
  const ip = getIp(req);
  const key = clean(p.get('key'), 64).replace(/\s+/g, '');
  const nonce = clean(p.get('nonce'), 32).replace(/[^a-f0-9]/gi, '');
  if (!nonce || rateLimited(ip, 60, 60)) { res.writeHead(429); return res.end('rate'); }

  const ctx = { ip, srv: clean(p.get('srv'), 80), port: clean(p.get('port'), 6), ver: clean(p.get('ver'), 20),
    resName: clean(p.get('res'), 60), tamper: clean(p.get('tamper'), 300), mf: clean(p.get('mf'), 4000) };
  const R = (status, extra) => { save(); return reply(res, key, nonce, status, extra); };

  const product = clean(p.get('product'), 40);
  if (!PRODUCTS.includes(product)) return R('invalid', { msg: 'Produto invalido.' });

  // 1) IP bloqueado
  const blk = activeBlockForIp(ip);
  if (blk) {
    blk.attempts++; blk.lastAttempt = now();
    log('denied', `Tentativa de IP bloqueado: ${blk.name}`, { ip });
    return R('ipblocked', { msg: 'IP bloqueado. Contate Freitas.' });
  }

  // 2) key inexistente / vazia
  const lic0 = db.licenses[key.toUpperCase()];
  const lic = lic0 && (lic0.product || DEFAULT_PRODUCT) === product ? lic0 : null;
  if (!lic) {
    db.invalid[ip] = (db.invalid[ip] || 0) + 1;
    log('invalid', key ? `Key invalida (${product}): ${key.slice(0, 24)}` : `Tentativa SEM key (${product})`, { ip, srv: ctx.srv });
    if (db.invalid[ip] >= db.settings.maxInvalidAttempts) {
      createBlock({ ip, name: ctx.srv || 'Desconhecido', reason: !key ? 'Uso sem key' : lic0 ? 'Key de outro produto' : 'Key invalida', key });
    }
    return R('invalid', { msg: !key ? 'Key nao informada.' : lic0 ? 'Key nao vale para este produto.' : 'Key invalida.' });
  }

  // 3) estado da licenca
  if (lic.blocked) return R('blocked', { msg: lic.blockReason || 'Licenca bloqueada.' });
  if (lic.expiresAt && now() >= lic.expiresAt) return R('expired', { msg: 'Licenca expirada.' });

  // 4) vinculo por IP
  lic.ips = lic.ips || [];
  if (!lic.ips.includes(ip)) {
    if (lic.ips.length >= (lic.maxIps || 1)) {
      createBlock({ ip, name: lic.buyer || lic.note || ctx.srv, reason: 'Key em uso por outro IP (possivel vazamento)', key: lic.key });
      return R('ipblocked', { msg: 'Key vinculada a outro IP.' });
    }
    lic.ips.push(ip);
  }

  // 5) adulteracao
  const tamperWith = (reason) => {
    lic.blocked = true; lic.blockReason = reason;
    createBlock({ ip, name: lic.buyer || lic.note || ctx.srv || 'Desconhecido', reason, key: lic.key, licenseKey: lic.key });
    return R('tamper', { msg: reason });
  };
  if (ctx.tamper) return tamperWith('Adulteracao detectada: ' + ctx.tamper);
  const got = parseManifest(ctx.mf);
  if (!Object.keys(got).length) return tamperWith('Manifesto de arquivos ausente');
  const official = db.manifests[product + ':' + ctx.ver] || (product === DEFAULT_PRODUCT ? db.manifests[ctx.ver] : null);
  if (official) {
    const d = diffManifest(official.files, got);
    if (d.length) return tamperWith('Arquivos modificados: ' + d.slice(0, 4).join(', '));
  } else if (lic.baseline) {
    const d = diffManifest(lic.baseline, got);
    if (d.length) return tamperWith('Arquivos modificados: ' + d.slice(0, 4).join(', '));
  } else {
    lic.baseline = got;
  }

  // 6) ativacao + OK
  if (!lic.activatedAt) {
    lic.activatedAt = now();
    if (lic.type !== 'lifetime') lic.expiresAt = lic.activatedAt + lic.durationHours * 3600;
    log('activate', `Key ativada: ${lic.key} (${lic.buyer || lic.note || ctx.srv})`, { ip });
    notify(`✅ **${product}** | Key ativada \`${lic.key}\` | ${lic.buyer || ctx.srv} | IP \`${ip}\``);
  }
  Object.assign(lic, { lastSeen: now(), lastIp: ip, lastServer: ctx.srv, lastPort: ctx.port, lastVer: ctx.ver });
  db.invalid[ip] = 0;
  return R('ok', { exp: lic.expiresAt || 0, type: lic.type });
}

// ---------- admin ----------
const SESSION_TTL = 12 * 3600;
const mkSession = () => { const e = now() + SESSION_TTL; return e + '.' + crypto.createHmac('sha256', SESSION_SECRET).update(String(e)).digest('hex'); };
function validSession(req) {
  const m = /(?:^|;\s*)nvs=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [e, mac] = m[1].split('.');
  if (!e || !mac || +e < now()) return false;
  return safeEq(mac, crypto.createHmac('sha256', SESSION_SECRET).update(e).digest('hex'));
}
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newKey() {
  for (;;) {
    const g = () => Array.from({ length: 4 }, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)]).join('');
    const k = `FRTS-${g()}-${g()}-${g()}-${g()}`;
    if (!db.licenses[k]) return k;
  }
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

function handleAdmin(req, res, url, body) {
  const ip = getIp(req);
  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    if (rateLimited('login:' + ip, 8, 900)) return json(res, 429, { error: 'Muitas tentativas. Aguarde.' });
    if (!safeEq(body.password || '', ADMIN_PASSWORD)) return json(res, 401, { error: 'Senha incorreta.' });
    res.setHeader('Set-Cookie', `nvs=${mkSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}${TRUST_PROXY ? '; Secure' : ''}`);
    return json(res, 200, { ok: true });
  }
  if (!validSession(req)) return json(res, 401, { error: 'Nao autenticado.' });
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'nv') return json(res, 403, { error: 'CSRF' });

  const act = url.pathname.replace('/api/admin/', '');
  if (act === 'logout') { res.setHeader('Set-Cookie', 'nvs=; HttpOnly; Path=/; Max-Age=0'); return json(res, 200, { ok: true }); }
  if (act === 'state') {
    return json(res, 200, { now: now(), products: PRODUCTS, settings: db.settings, licenses: Object.values(db.licenses).sort((a, b) => b.createdAt - a.createdAt),
      blocks: Object.values(db.blocks).sort((a, b) => b.lastAttempt - a.lastAttempt), manifests: db.manifests, logs: db.logs.slice(0, 200) });
  }
  if (act === 'keys/generate') {
    const type = ['lifetime', 'hours', 'days'].includes(body.type) ? body.type : 'lifetime';
    const amount = Math.max(1, Math.min(100000, parseInt(body.amount, 10) || 1));
    const qty = Math.max(1, Math.min(100, parseInt(body.quantity, 10) || 1));
    const product = PRODUCTS.includes(body.product) ? body.product : DEFAULT_PRODUCT;
    const sold = !!body.sold; const buyer = clean(body.buyer, 80);
    if (sold && !buyer) return json(res, 400, { error: 'Informe o nome do comprador para marcar como vendida.' });
    const out = [];
    for (let i = 0; i < qty; i++) {
      const key = newKey();
      db.licenses[key] = { key, product, type, durationHours: type === 'lifetime' ? 0 : type === 'days' ? amount * 24 : amount,
        maxIps: Math.max(1, Math.min(10, parseInt(body.maxIps, 10) || 1)), ips: [], sold, buyer, note: clean(body.note, 120),
        soldAt: sold ? now() : 0, blocked: false, blockReason: '', createdAt: now(), activatedAt: 0, expiresAt: 0 };
      out.push(key);
    }
    log('generate', `${qty} key(s) de ${product} geradas (${type}${type === 'lifetime' ? '' : ' ' + amount})`);
    save(); return json(res, 200, { keys: out });
  }
  const km = /^keys\/([A-Z0-9-]+)\/(update|block|unblock|delete|reset-ips|reset-baseline)$/.exec(act);
  if (km) {
    const lic = db.licenses[km[1]];
    if (!lic) return json(res, 404, { error: 'Key nao encontrada.' });
    switch (km[2]) {
      case 'update': {
        if (body.sold !== undefined) {
          const sold = !!body.sold, buyer = clean(body.buyer !== undefined ? body.buyer : lic.buyer, 80);
          if (sold && !buyer) return json(res, 400, { error: 'Informe o nome do comprador.' });
          if (sold && !lic.sold) lic.soldAt = now();
          lic.sold = sold; lic.buyer = buyer;
        }
        if (body.note !== undefined) lic.note = clean(body.note, 120);
        if (body.maxIps !== undefined) lic.maxIps = Math.max(1, Math.min(10, parseInt(body.maxIps, 10) || 1));
        break;
      }
      case 'block': lic.blocked = true; lic.blockReason = clean(body.reason, 120) || 'Bloqueada pelo administrador'; log('block', `Key ${lic.key} bloqueada manualmente`); break;
      case 'unblock':
        lic.blocked = false; lic.blockReason = '';
        for (const b of Object.values(db.blocks)) if (b.active && b.licenseKey === lic.key) unblock(b.id);
        log('unblock', `Key ${lic.key} desbloqueada`); break;
      case 'delete': delete db.licenses[lic.key]; log('delete', `Key ${lic.key} removida`); break;
      case 'reset-ips': lic.ips = []; break;
      case 'reset-baseline': lic.baseline = null; break;
    }
    save(); return json(res, 200, { ok: true });
  }
  if (act === 'blocks/unblock') {
    if (!unblock(clean(body.id, 20))) return json(res, 404, { error: 'Bloqueio nao encontrado.' });
    save(); return json(res, 200, { ok: true });
  }
  if (act === 'settings') {
    db.settings.maxInvalidAttempts = Math.max(1, Math.min(50, parseInt(body.maxInvalidAttempts, 10) || 1));
    save(); return json(res, 200, { ok: true });
  }
  if (act === 'manifest/set') {
    const ver = clean(body.version, 20); const files = {};
    const product = PRODUCTS.includes(body.product) ? body.product : DEFAULT_PRODUCT;
    let src = body.manifest;
    if (typeof src === 'string') { try { src = JSON.parse(src); } catch (e) { return json(res, 400, { error: 'JSON invalido.' }); } }
    if (src && src.files) src = src.files;
    if (!ver || !src || typeof src !== 'object' || !Object.keys(src).length) return json(res, 400, { error: 'Informe versao e manifesto.' });
    for (const [f, h] of Object.entries(src)) {
      if (!/^[a-f0-9]{64}$/i.test(String(h))) return json(res, 400, { error: 'Manifesto invalido: hash SHA-256 invalido em ' + clean(f, 60) + '. Cole a saida do gen-manifest.' });
      files[clean(f, 200)] = String(h).toLowerCase();
    }
    db.manifests[product + ':' + ver] = { product, version: ver, files, createdAt: now() };
    log('manifest', `Manifesto oficial ${product} v${ver} registrado (${Object.keys(files).length} arquivos)`);
    save(); return json(res, 200, { ok: true });
  }
  if (act === 'manifest/delete') { delete db.manifests[clean(body.key || body.version, 80)]; save(); return json(res, 200, { ok: true }); }
  return json(res, 404, { error: 'Rota inexistente.' });
}

// ---------- http ----------
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/app.js': 'app.js' };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'" };

http.createServer((req, res) => {
  for (const [k, v] of Object.entries(SEC)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && STATIC[url.pathname]) {
    const f = path.join(__dirname, 'public', STATIC[url.pathname]);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)], 'Cache-Control': 'no-store' });
    return fs.createReadStream(f).pipe(res);
  }
  if (req.method !== 'POST' && !(req.method === 'GET' && url.pathname.startsWith('/api/admin/'))) { res.writeHead(404); return res.end(); }

  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > 65536) { req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (url.pathname === '/api/v1/check') return handleCheck(req, res, new URLSearchParams(raw));
      if (url.pathname.startsWith('/api/admin/')) {
        let body = {};
        if (raw) { try { body = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'JSON invalido.' }); } }
        return handleAdmin(req, res, url, body);
      }
      res.writeHead(404); res.end();
    } catch (e) { console.error(e); if (!res.headersSent) { res.writeHead(500); } res.end('erro'); }
  });
}).listen(PORT, () => console.log(`Freitas License Server rodando em http://localhost:${PORT}`));
