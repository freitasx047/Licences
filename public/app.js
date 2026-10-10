'use strict';
// Painel Freitas • Licenças — todo conteúdo dinâmico entra via textContent (sem XSS)
const $ = (s) => document.querySelector(s);
let S = null; // estado
let currentTab = 'overview';

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('data-')) e.setAttribute(k, v);
    else e[k] = v;
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleString('pt-BR') : '—';
const pill = (txt, cls) => el('span', { class: 'pill ' + cls, text: txt });
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 3200);
}
async function api(path, body) {
  const opt = body === undefined ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'nv' }, body: JSON.stringify(body) };
  const r = await fetch('/api/admin/' + path, opt);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') { showLogin(); throw new Error('Sessão expirada'); }
  if (!r.ok) throw new Error(data.error || 'Erro ' + r.status);
  return data;
}

// ---------- login ----------
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
async function login() {
  try { await api('login', { password: $('#pw').value }); $('#pw').value = ''; $('#loginErr').textContent = ''; await boot(); }
  catch (e) { $('#loginErr').textContent = e.message; }
}
$('#btnLogin').onclick = login;
$('#pw').onkeydown = (e) => { if (e.key === 'Enter') login(); };
$('#btnLogout').onclick = async () => { await api('logout', {}).catch(() => {}); showLogin(); };

// ---------- estado ----------
async function refresh() { S = await api('state'); render(); }
async function boot() {
  try { await refresh(); $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }
  catch (e) { showLogin(); }
}
async function act(path, body, okMsg) {
  try { await api(path, body || {}); if (okMsg) toast(okMsg); await refresh(); }
  catch (e) { toast(e.message, true); }
}

// ---------- tabs ----------
$('#tabs').onclick = (e) => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  currentTab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== 'tab-' + currentTab));
};

// ---------- status da key ----------
function licStatus(l) {
  const n = S.now;
  if (l.blocked) return ['Bloqueada', 'p-bad'];
  if (l.expiresAt && n >= l.expiresAt) return ['Expirada', 'p-warn'];
  if (l.activatedAt) return ['Ativa', 'p-ok'];
  if (l.sold) return ['Vendida (não ativada)', 'p-info'];
  return ['Disponível', 'p-mut'];
}
const typeLabel = (l) => l.type === 'lifetime' ? 'Vitalícia' : l.type === 'days' ? (l.durationHours / 24) + ' dia(s)' : l.durationHours + ' hora(s)';

// ---------- render ----------
function render() {
  const act_ = S.blocks.filter((b) => b.active);
  const bb = $('#badgeBlocked'); bb.textContent = act_.length; bb.classList.toggle('hidden', !act_.length);
  renderOverview(act_); renderKeys(); renderBlocked(act_); renderManifest(); renderLogs();
  $('#setMaxInv').value = S.settings.maxInvalidAttempts;
}

function renderOverview(blocked) {
  const L = S.licenses; const st = (f) => L.filter(f).length;
  const stats = [
    ['Total de keys', L.length], ['Ativas', st((l) => !l.blocked && l.activatedAt && !(l.expiresAt && S.now >= l.expiresAt))],
    ['Vendidas', st((l) => l.sold)], ['Disponíveis', st((l) => !l.sold && !l.activatedAt)],
    ['Expiradas', st((l) => l.expiresAt && S.now >= l.expiresAt)], ['Bloqueados', blocked.length],
  ];
  $('#tab-overview').replaceChildren(
    el('div', { class: 'stats' }, stats.map(([k, v]) => el('div', { class: 'stat' }, el('b', { text: v }), el('span', { text: k })))),
    el('div', { class: 'card' }, el('h2', { text: 'Online recentemente (últimas 24h)' }),
      table(['Key', 'Comprador/Obs.', 'Servidor', 'IP', 'Última vez'],
        L.filter((l) => l.lastSeen && S.now - l.lastSeen < 86400).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 15)
          .map((l) => [l.key, l.buyer || l.note || '—', l.lastServer || '—', l.lastIp || '—', fmt(l.lastSeen)]))));
}

function table(head, rows) {
  const t = el('table', {});
  t.append(el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))));
  const tb = el('tbody', {});
  for (const r of rows) tb.append(el('tr', {}, r.map((c) => el('td', {}, c))));
  if (!rows.length) tb.append(el('tr', {}, el('td', { text: 'Nada por aqui ainda.', colSpan: head.length })));
  t.append(tb); return t;
}
const btn = (txt, cls, onclick) => el('button', { class: 'sm ' + (cls || ''), text: txt, onclick });

function renderKeys() {
  const q = $('#keySearch').value.toLowerCase();
  const list = S.licenses.filter((l) => !q || [l.key, l.buyer, l.note, l.lastIp, l.lastServer].join(' ').toLowerCase().includes(q));
  const rows = list.map((l) => {
    const [txt, cls] = licStatus(l);
    const actions = el('div', {},
      btn('Copiar', '', () => { navigator.clipboard.writeText(l.key); toast('Key copiada'); }),
      btn(l.sold ? 'Editar venda' : 'Vender', 'good', () => {
        const name = prompt('Nome do comprador:', l.buyer || ''); if (name === null) return;
        act('keys/' + l.key + '/update', { sold: true, buyer: name }, 'Marcada como vendida');
      }),
      l.sold ? btn('Desmarcar', '', () => act('keys/' + l.key + '/update', { sold: false }, 'Venda removida')) : null,
      l.blocked ? btn('Desbloquear', 'good', () => act('keys/' + l.key + '/unblock', {}, 'Desbloqueada'))
        : btn('Bloquear', 'danger', () => { const r = prompt('Motivo do bloqueio:', 'Bloqueada pelo administrador'); if (r !== null) act('keys/' + l.key + '/block', { reason: r }, 'Bloqueada'); }),
      btn('Reset IPs', '', () => confirm('Liberar a key para um novo IP?') && act('keys/' + l.key + '/reset-ips', {}, 'IPs resetados')),
      btn('Reset base', '', () => confirm('Resetar manifesto base desta key?') && act('keys/' + l.key + '/reset-baseline', {}, 'Base resetada')),
      btn('Excluir', 'danger', () => confirm('Excluir ' + l.key + ' definitivamente?') && act('keys/' + l.key + '/delete', {}, 'Excluída')));
    return [el('code', { text: l.key }), pill(txt, cls), typeLabel(l), l.buyer || l.note || '—',
      (l.ips || []).join(', ') + ' (' + (l.maxIps || 1) + ' máx)', l.expiresAt ? fmt(l.expiresAt) : (l.activatedAt ? 'Nunca' : '—'), fmt(l.lastSeen), actions];
  });
  $('#keysTable').replaceChildren(...table(['Key', 'Status', 'Tipo', 'Comprador/Obs.', 'IPs', 'Expira', 'Visto', 'Ações'], rows).children);
}
$('#keySearch').oninput = () => S && renderKeys();

function renderBlocked(blocked) {
  const rows = blocked.map((b) => [
    b.name, el('code', { text: b.ip }), el('span', { text: b.reason }), b.key ? el('code', { text: b.key.slice(0, 24) }) : '—',
    String(b.attempts), fmt(b.createdAt), fmt(b.lastAttempt), btn('Desbloquear', 'good', () => act('blocks/unblock', { id: b.id }, 'Desbloqueado')),
  ]);
  $('#blockTable').replaceChildren(...table(['Nome (comprador/servidor)', 'IP', 'Motivo', 'Key', 'Tentativas', 'Bloqueado em', 'Última tentativa', ''], rows).children);
}

function renderManifest() {
  const rows = Object.entries(S.manifests).map(([v, m]) => [v, String(Object.keys(m.files).length) + ' arquivos', fmt(m.createdAt),
    btn('Remover', 'danger', () => confirm('Remover manifesto v' + v + '?') && act('manifest/delete', { version: v }, 'Removido'))]);
  $('#manifestTable').replaceChildren(...table(['Versão', 'Arquivos', 'Registrado em', ''], rows).children);
}

function renderLogs() {
  const rows = S.logs.map((l) => [fmt(l.t), pill(l.type, l.type === 'block' || l.type === 'denied' ? 'p-bad' : l.type === 'activate' ? 'p-ok' : 'p-mut'), l.ip || '—', el('span', { text: l.msg })]);
  $('#logTable').replaceChildren(...table(['Quando', 'Tipo', 'IP', 'Mensagem'], rows).children);
}

// ---------- ações dos formulários ----------
$('#gType').onchange = () => { $('#gAmount').disabled = $('#gType').value === 'lifetime'; };
$('#btnGen').onclick = async () => {
  try {
    const r = await api('keys/generate', { type: $('#gType').value, amount: $('#gAmount').value, quantity: $('#gQty').value,
      maxIps: $('#gIps').value, buyer: $('#gBuyer').value, note: $('#gNote').value, sold: $('#gSold').checked });
    const o = $('#genOut'); o.textContent = r.keys.join('\n'); o.classList.remove('hidden');
    toast(r.keys.length + ' key(s) gerada(s)'); await refresh();
  } catch (e) { toast(e.message, true); }
};
$('#btnSettings').onclick = () => act('settings', { maxInvalidAttempts: $('#setMaxInv').value }, 'Configuração salva');
$('#btnManifest').onclick = async () => {
  let ver = $('#mVer').value.trim(); const raw = $('#mJson').value.trim();
  try { const j = JSON.parse(raw); if (!ver && j.version) ver = j.version; } catch (e) { return toast('JSON inválido', true); }
  await act('manifest/set', { version: ver, manifest: raw }, 'Manifesto registrado');
};

boot();
setInterval(() => { if (!$('#app').classList.contains('hidden')) refresh().catch(() => {}); }, 15000);
