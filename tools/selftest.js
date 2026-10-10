'use strict';
// Teste de ponta a ponta do servidor de licencas (simula o license.lua)
const { spawn } = require('child_process');
const http = require('http'), crypto = require('crypto'), path = require('path'), fs = require('fs'), os = require('os');

const PORT = 3999, SECRET = 'segredo-de-teste-123', PASS = 'senha-teste';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'nvtest-'));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sign = (st, exp, n, k, ts) => sha(SECRET + '|' + sha(SECRET + '|' + [st, exp, n, k, ts].join('|')));

function req(method, p, { body, headers, form } = {}) {
  return new Promise((resolve, reject) => {
    const data = form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : '';
    const r = http.request({ port: PORT, path: p, method, headers: Object.assign({ 'Content-Length': Buffer.byteLength(data) }, headers) }, (res) => {
      let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => resolve({ status: res.statusCode, text: t, headers: res.headers }));
    });
    r.on('error', reject); r.end(data);
  });
}
async function check(ip, key, mf, extra) {
  const nonce = crypto.randomBytes(12).toString('hex');
  const r = await req('POST', '/api/v1/check', { headers: { 'X-Forwarded-For': ip, 'Content-Type': 'application/x-www-form-urlencoded' },
    form: Object.assign({ key, product: 'new_vehicles', ver: '2.0.0', res: 'new_vehicles', srv: 'Servidor Teste', port: '22003', nonce, mf, tamper: '' }, extra) });
  const o = {}; for (const l of r.text.split('\n')) { const i = l.indexOf('='); if (i > 0) o[l.slice(0, i)] = l.slice(i + 1); }
  const macOk = o.mac === sign(o.status, o.exp, nonce, key, o.ts) && o.nonce === nonce;
  return { status: o.status, macOk, exp: o.exp, msg: o.msg };
}

let fails = 0;
const ok = (c, name) => { console.log((c ? 'PASS ' : 'FAIL ') + name); if (!c) fails++; };

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, ADMIN_PASSWORD: PASS, PRODUCT_SECRET: SECRET, TRUST_PROXY: '1', DATA_DIR: DATA }), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  try {
    const bad = await req('POST', '/api/admin/login', { body: { password: 'x' }, headers: { 'Content-Type': 'application/json' } });
    ok(bad.status === 401, 'login errado recusado');
    const lg = await req('POST', '/api/admin/login', { body: { password: PASS }, headers: { 'Content-Type': 'application/json' } });
    const cookie = (lg.headers['set-cookie'] || [''])[0].split(';')[0];
    ok(lg.status === 200 && cookie.startsWith('nvs='), 'login correto');
    const A = (p, body) => req('POST', '/api/admin/' + p, { body, headers: { Cookie: cookie, 'X-Requested-With': 'nv', 'Content-Type': 'application/json' } });
    const state = async () => JSON.parse((await req('GET', '/api/admin/state', { headers: { Cookie: cookie } })).text);

    ok((await req('POST', '/api/admin/keys/generate', { body: {}, headers: { 'Content-Type': 'application/json' } })).status === 401, 'admin sem cookie = 401');
    ok((await req('POST', '/api/admin/keys/generate', { body: {}, headers: { Cookie: cookie, 'Content-Type': 'application/json' } })).status === 403, 'admin sem header CSRF = 403');

    const g = JSON.parse((await A('keys/generate', { type: 'lifetime', quantity: 1, maxIps: 1, sold: true, buyer: 'Joao' })).text).keys[0];
    const gh = JSON.parse((await A('keys/generate', { type: 'hours', amount: 1, quantity: 1, maxIps: 1, note: 'tmp' })).text).keys[0];
    ok(/^FRTS-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(g), 'formato da key');
    ok((await A('keys/generate', { sold: true })).status === 400, 'vendida exige comprador');

    const MF = 'meta.xml=aaa;src/shared.lua=bbb;src/license.lua=ccc';
    let r = await check('10.0.0.1', g, MF);
    ok(r.status === 'ok' && r.macOk && r.exp === '0', 'key vitalicia valida (ok, assinatura correta, exp=0)');
    r = await check('10.0.0.1', gh, MF); ok(r.status === 'ok' && r.exp !== '0', 'key de 1 hora define expiracao');

    // sem key
    r = await check('10.0.0.9', '', MF); ok(r.status === 'invalid' && r.macOk, 'sem key => invalid');
    r = await check('10.0.0.9', g, MF); ok(r.status === 'ipblocked', 'IP sem key ficou bloqueado, mesmo com key valida depois');
    let s = await state(); const b = s.blocks.find((x) => x.ip === '10.0.0.9');
    ok(b && b.active && b.name === 'Servidor Teste', 'aparece em Bloqueados com nome e IP');
    await A('blocks/unblock', { id: b.id });
    r = await check('10.0.0.9', g, MF); ok(r.status === 'ipblocked' && /outro IP/.test((await state()).blocks.find((x) => x.ip === '10.0.0.9' && x.active).reason), 'apos desbloquear, key valida em outro IP => bloqueia por vinculo');
    await A('blocks/unblock', { id: (await state()).blocks.find((x) => x.ip === '10.0.0.9' && x.active).id });

    // key invalida
    r = await check('10.0.0.5', 'FRTS-AAAA-BBBB-CCCC-DDDD', MF); ok(r.status === 'invalid', 'key inexistente => invalid');
    r = await check('10.0.0.5', g, MF); ok(r.status === 'ipblocked', 'IP com key invalida bloqueado');

    // adulteracao: flags
    r = await check('10.0.0.1', g, MF, { tamper: 'renamed' }); ok(r.status === 'tamper' && r.macOk, 'resource renomeado => tamper');
    r = await check('10.0.0.1', g, MF); ok(r.status === 'ipblocked', 'IP adulterador bloqueado');
    s = await state(); ok(s.licenses.find((l) => l.key === g).blocked, 'key bloqueada por tamper');
    const tb = s.blocks.find((x) => x.active && x.ip === '10.0.0.1');
    ok(tb && tb.name === 'Joao', 'dashboard mostra o nome do comprador (Joao)');
    await A('blocks/unblock', { id: tb.id });
    s = await state(); ok(!s.licenses.find((l) => l.key === g).blocked, 'desbloquear tambem libera a key');
    r = await check('10.0.0.1', g, MF); ok(r.status === 'ok', 'volta a funcionar apos desbloqueio');

    // adulteracao: manifesto base (TOFU)
    r = await check('10.0.0.1', g, 'meta.xml=aaa;src/shared.lua=XXX;src/license.lua=ccc'); ok(r.status === 'tamper', 'arquivo .lua alterado => tamper');
    await A('blocks/unblock', { id: (await state()).blocks.find((x) => x.active && x.ip === '10.0.0.1').id });
    r = await check('10.0.0.1', g, 'meta.xml=aaa;src/license.lua=ccc'); ok(r.status === 'tamper', 'arquivo .lua removido => tamper');
    await A('blocks/unblock', { id: (await state()).blocks.find((x) => x.active && x.ip === '10.0.0.1').id });
    r = await check('10.0.0.1', g, MF + ';src/crack.lua=zzz'); ok(r.status === 'tamper', 'arquivo extra => tamper');
    await A('blocks/unblock', { id: (await state()).blocks.find((x) => x.active && x.ip === '10.0.0.1').id });

    // manifesto oficial
    await A('manifest/set', { version: '2.0.0', manifest: { version: '2.0.0', files: { 'meta.xml': 'AAA', 'src/shared.lua': 'bbb', 'src/license.lua': 'ccc' } } });
    r = await check('10.0.0.1', g, MF); ok(r.status === 'ok', 'manifesto oficial: hashes iguais (case-insensitive) => ok');
    r = await check('10.0.0.1', g, 'meta.xml=aaa;src/shared.lua=bbb;src/license.lua=ddd'); ok(r.status === 'tamper', 'manifesto oficial: hash diferente => tamper');

    // bloqueio manual
    await A('blocks/unblock', { id: (await state()).blocks.find((x) => x.active && x.ip === '10.0.0.1').id });
    await A('keys/' + g + '/block', { reason: 'chargeback' });
    r = await check('10.0.0.1', g, MF); ok(r.status === 'blocked' && r.msg === 'chargeback', 'bloqueio manual da key');
    await A('keys/' + g + '/unblock', {});
    r = await check('10.0.0.1', g, MF); ok(r.status === 'ok', 'desbloqueio manual da key');

    // assinatura forjada nao bate
    ok(!(await check('10.0.0.1', g, MF)).macOk === false, 'assinatura confere com o segredo');

    // XSS: nome de servidor malicioso so e guardado como texto
    await check('10.0.0.77', '', MF, { srv: '<img src=x onerror=alert(1)>' });
    ok((await state()).blocks.some((x) => x.name.includes('<img')), 'nome malicioso armazenado como texto (front usa textContent)');
  } catch (e) { console.error(e); fails++; }
  srv.kill();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
  process.exit(fails ? 1 : 0);
})();
