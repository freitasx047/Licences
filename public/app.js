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

// ---------- ícones (Lucide) ----------
const ic = (name) => el('i', { 'data-lucide': name });
const paintIcons = () => { if (window.lucide) window.lucide.createIcons(); };

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
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); paintIcons(); }
async function login() {
  try { await api('login', { password: $('#pw').value }); $('#pw').value = ''; $('#loginErr').textContent = ''; await boot(); }
  catch (e) { $('#loginErr').textContent = e.message; }
}
$('#btnLogin').onclick = login;
$('#pw').onkeydown = (e) => { if (e.key === 'Enter') login(); };
$('#btnLogout').onclick = async () => { await api('logout', {}).catch(() => {}); showLogin(); };
$('#btnRefresh').onclick = async () => { try { await refresh(); toast('Dados atualizados'); } catch (e) { toast(e.message, true); } };

// ---------- estado ----------
async function refresh() { S = await api('state'); render(); }
async function boot() {
  try { await refresh(); $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); paintIcons(); }
  catch (e) { showLogin(); }
}
async function act(path, body, okMsg) {
  try { await api(path, body || {}); if (okMsg) toast(okMsg); await refresh(); }
  catch (e) { toast(e.message, true); }
}

// ---------- tabs ----------
const TAB_INFO = {
  overview: ['Visão geral', 'Resumo das suas licenças e atividade recente'],
  keys: ['Keys', 'Gere, venda e gerencie as licenças'],
  blocked: ['Bloqueados', 'IPs e keys impedidos de usar o sistema'],
  manifest: ['Manifesto', 'Controle anti-adulteração dos arquivos'],
  logs: ['Logs', 'Histórico de eventos do sistema'],
};
$('#tabs').onclick = (e) => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  currentTab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== 'tab-' + currentTab));
  $('#pageTitle').textContent = TAB_INFO[currentTab][0];
  $('#pageSub').textContent = TAB_INFO[currentTab][1];
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
  fillProducts(); renderOverview(act_); renderKeys(); renderBlocked(act_); renderManifest(); renderLogs();
  $('#setMaxInv').value = S.settings.maxInvalidAttempts;
  paintIcons();
}

function fillProducts() {
  for (const id of ['#gProduct', '#mProduct']) {
    const sel = $(id); const prev = sel.value;
    if (sel.options.length !== S.products.length) {
      sel.replaceChildren(...S.products.map((p) => el('option', { value: p, text: p })));
      if (prev) sel.value = prev;
    }
  }
}

// ---------- componentes do dashboard ----------
const COLORS = { 'p-ok': 'var(--ok)', 'p-info': 'var(--accent2)', 'p-mut': '#5d6485', 'p-warn': 'var(--warn)', 'p-bad': 'var(--bad)' };
const cardHead = (icon, title, sub) => el('div', { class: 'card-head' }, ic(icon), el('div', {}, el('h2', { text: title }), sub ? el('p', { class: 'muted', text: sub }) : null));

function statCard(icon, tone, label, value) {
  return el('div', { class: 'stat' }, el('div', { class: 'stat-ic ' + tone }, ic(icon)), el('div', {}, el('b', { text: value }), el('span', { text: label })));
}

function donut(parts, total) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('class', 'donut');
  const R = 50, C = 2 * Math.PI * R;
  const mk = (color, len, off) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', R);
    c.setAttribute('transform', 'rotate(-90 60 60)');
    c.style.stroke = color;
    c.setAttribute('stroke-dasharray', len + ' ' + (C - len)); c.setAttribute('stroke-dashoffset', -off);
    return c;
  };
  svg.append(mk('var(--card2)', C, 0));
  if (total > 0) {
    const used = parts.filter((p) => p.v > 0); let off = 0;
    for (const p of used) {
      const full = C * p.v / total; const len = Math.max(full - (used.length > 1 ? 2.5 : 0), 0.5);
      svg.append(mk(p.color, len, off)); off += full;
    }
  }
  return svg;
}

function statusDonutCard() {
  const map = new Map();
  for (const l of S.licenses) { const [txt, cls] = licStatus(l); const o = map.get(txt) || { name: txt, color: COLORS[cls], v: 0 }; o.v++; map.set(txt, o); }
  const parts = [...map.values()].sort((a, b) => b.v - a.v);
  const total = S.licenses.length;
  return el('div', { class: 'card' }, cardHead('pie-chart', 'Status das keys', 'Como suas licenças estão distribuídas'),
    el('div', { class: 'donut-wrap' },
      el('div', { class: 'donut-box' }, donut(parts, total), el('div', { class: 'donut-center' }, el('b', { text: total }), el('span', { text: 'keys' }))),
      el('div', { class: 'legend' }, parts.length ? parts.map((p) => el('div', {}, el('i', { class: 'sw', style: 'background:' + p.color }), el('span', { text: p.name }), el('em', { text: p.v })))
        : el('p', { class: 'muted', text: 'Gere sua primeira key na aba Keys.' }))));
}

function productsCard() {
  const cnt = {};
  for (const l of S.licenses) { const p = l.product || 'new_vehicles'; cnt[p] = (cnt[p] || 0) + 1; }
  const list = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...list.map((x) => x[1]));
  return el('div', { class: 'card' }, cardHead('package', 'Keys por produto', 'Quantidade de licenças em cada produto'),
    list.length ? el('div', { class: 'bars' }, list.map(([name, n]) => el('div', {},
      el('div', { class: 'bar-top' }, el('span', { text: name }), el('span', { text: n })),
      el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: 'width:' + Math.round(n / max * 100) + '%' })))))
      : el('p', { class: 'empty-note', text: 'Nenhuma key criada ainda.' }));
}

function activityCard() {
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today0); d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), ok: 0, bad: 0, mut: 0 };
  });
  for (const l of S.logs) {
    const d = new Date(l.t * 1000); d.setHours(0, 0, 0, 0);
    const diff = Math.round((today0 - d) / 864e5); if (diff < 0 || diff > 6) continue;
    const day = days[6 - diff];
    if (l.type === 'activate') day.ok++; else if (l.type === 'block' || l.type === 'denied') day.bad++; else day.mut++;
  }
  const max = Math.max(1, ...days.map((d) => d.ok + d.bad + d.mut));
  const seg = (n, color) => el('div', { class: 'act-seg', style: 'height:' + (n / max * 100) + '%;background:' + color });
  return el('div', { class: 'card' }, cardHead('bar-chart-3', 'Atividade dos últimos 7 dias', 'Eventos registrados por dia'),
    el('div', { class: 'activity' }, days.map((d) => {
      const tot = d.ok + d.bad + d.mut;
      return el('div', { class: 'act-col' }, el('span', { class: 'act-num', text: tot || '' }),
        el('div', { class: 'act-track' }, seg(d.ok, 'var(--ok)'), seg(d.mut, 'var(--accent)'), seg(d.bad, 'var(--bad)')),
        el('span', { class: 'act-day', text: d.label }));
    })),
    el('div', { class: 'act-legend' },
      el('span', {}, el('i', { class: 'sw', style: 'background:var(--ok)' }), 'Ativações'),
      el('span', {}, el('i', { class: 'sw', style: 'background:var(--accent)' }), 'Outros'),
      el('span', {}, el('i', { class: 'sw', style: 'background:var(--bad)' }), 'Bloqueios / negados')));
}

function eventsCard() {
  const tone = (t) => t === 'block' || t === 'denied' ? ['t-bad', 'shield-x'] : t === 'activate' ? ['t-ok', 'badge-check'] : ['t-accent', 'info'];
  const items = S.logs.slice(0, 6);
  return el('div', { class: 'card' }, cardHead('radio', 'Eventos recentes', 'O que aconteceu por último'),
    items.length ? el('div', { class: 'events' }, items.map((l) => {
      const [t, i] = tone(l.type);
      return el('div', { class: 'event' }, el('div', { class: 'ev-ic ' + t }, ic(i)),
        el('div', { class: 'ev-body' }, el('p', { text: l.msg }), el('small', { text: fmt(l.t) + (l.ip ? ' • ' + l.ip : '') })));
    })) : el('p', { class: 'empty-note', text: 'Nenhum evento registrado.' }));
}

function renderOverview(blocked) {
  const L = S.licenses; const st = (f) => L.filter(f).length;
  const cards = [
    statCard('key-round', 't-accent', 'Total de keys', L.length),
    statCard('circle-check', 't-ok', 'Ativas', st((l) => !l.blocked && l.activatedAt && !(l.expiresAt && S.now >= l.expiresAt))),
    statCard('shopping-bag', 't-info', 'Vendidas', st((l) => l.sold)),
    statCard('inbox', 't-mut', 'Disponíveis', st((l) => !l.sold && !l.activatedAt)),
    statCard('timer-off', 't-warn', 'Expiradas', st((l) => l.expiresAt && S.now >= l.expiresAt)),
    statCard('ban', 't-bad', 'Bloqueados', blocked.length),
  ];
  const online = L.filter((l) => l.lastSeen && S.now - l.lastSeen < 86400).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 15)
    .map((l) => [el('code', { text: l.key }), l.product || 'new_vehicles', l.buyer || l.note || '—', l.lastServer || '—', l.lastIp || '—', fmt(l.lastSeen)]);

  $('#tab-overview').replaceChildren(
    el('div', { class: 'stats' }, cards),
    el('div', { class: 'dash' }, activityCard(), statusDonutCard()),
    el('div', { class: 'dash dash-2' }, productsCard(), eventsCard()),
    el('div', { class: 'card' }, cardHead('wifi', 'Online recentemente', 'Keys vistas nas últimas 24 horas'),
      el('div', { class: 'scroll' }, table(['Key', 'Produto', 'Comprador/Obs.', 'Servidor', 'IP', 'Última vez'], online))));
}

function table(head, rows) {
  const t = el('table', {});
  t.append(el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))));
  const tb = el('tbody', {});
  for (const r of rows) tb.append(el('tr', {}, r.map((c) => el('td', {}, c))));
  if (!rows.length) tb.append(el('tr', {}, el('td', { class: 'empty', text: 'Nada por aqui ainda.', colSpan: head.length })));
  t.append(tb); return t;
}
// botão com ícone Lucide; se `only` = true mostra só o ícone (texto vira tooltip)
const btn = (txt, cls, onclick, icon, only) => {
  const b = el('button', { class: 'sm ' + (cls || '') + (only ? ' icon' : ''), type: 'button', onclick }, icon ? ic(icon) : null, only ? null : txt);
  if (only) { b.title = txt; b.setAttribute('aria-label', txt); }
  return b;
};

function renderKeys() {
  const q = $('#keySearch').value.toLowerCase();
  const list = S.licenses.filter((l) => !q || [l.key, l.product, l.buyer, l.note, l.lastIp, l.lastServer].join(' ').toLowerCase().includes(q));
  const rows = list.map((l) => {
    const [txt, cls] = licStatus(l);
    const actions = el('div', { class: 'cell-actions' },
      btn('Copiar key', '', () => { navigator.clipboard.writeText(l.key); toast('Key copiada'); }, 'copy', true),
      btn(l.sold ? 'Editar venda' : 'Vender', 'good', () => {
        const name = prompt('Nome do comprador:', l.buyer || ''); if (name === null) return;
        act('keys/' + l.key + '/update', { sold: true, buyer: name }, 'Marcada como vendida');
      }, l.sold ? 'pencil' : 'badge-dollar-sign', true),
      l.sold ? btn('Desmarcar venda', '', () => act('keys/' + l.key + '/update', { sold: false }, 'Venda removida'), 'undo-2', true) : null,
      l.blocked ? btn('Desbloquear', 'good', () => act('keys/' + l.key + '/unblock', {}, 'Desbloqueada'), 'lock-open', true)
        : btn('Bloquear', 'danger', () => { const r = prompt('Motivo do bloqueio:', 'Bloqueada pelo administrador'); if (r !== null) act('keys/' + l.key + '/block', { reason: r }, 'Bloqueada'); }, 'lock', true),
      btn('Resetar IPs', '', () => confirm('Liberar a key para um novo IP?') && act('keys/' + l.key + '/reset-ips', {}, 'IPs resetados'), 'network', true),
      btn('Resetar base', '', () => confirm('Resetar manifesto base desta key?') && act('keys/' + l.key + '/reset-baseline', {}, 'Base resetada'), 'rotate-ccw', true),
      btn('Excluir', 'danger', () => confirm('Excluir ' + l.key + ' definitivamente?') && act('keys/' + l.key + '/delete', {}, 'Excluída'), 'trash-2', true));
    return [el('code', { text: l.key }), l.product || 'new_vehicles', pill(txt, cls), typeLabel(l), l.buyer || l.note || '—',
      (l.ips || []).join(', ') + ' (' + (l.maxIps || 1) + ' máx)', l.expiresAt ? fmt(l.expiresAt) : (l.activatedAt ? 'Nunca' : '—'), fmt(l.lastSeen), actions];
  });
  $('#keysTable').replaceChildren(...table(['Key', 'Produto', 'Status', 'Tipo', 'Comprador/Obs.', 'IPs', 'Expira', 'Visto', 'Ações'], rows).children);
  paintIcons();
}
$('#keySearch').oninput = () => S && renderKeys();

function renderBlocked(blocked) {
  const rows = blocked.map((b) => [
    b.name, el('code', { text: b.ip }), el('span', { text: b.reason }), b.key ? el('code', { text: b.key.slice(0, 24) }) : '—',
    String(b.attempts), fmt(b.createdAt), fmt(b.lastAttempt), btn('Desbloquear', 'good', () => act('blocks/unblock', { id: b.id }, 'Desbloqueado'), 'lock-open'),
  ]);
  $('#blockTable').replaceChildren(...table(['Nome (comprador/servidor)', 'IP', 'Motivo', 'Key', 'Tentativas', 'Bloqueado em', 'Última tentativa', ''], rows).children);
}

function renderManifest() {
  const rows = Object.entries(S.manifests).map(([k, m]) => [m.product || 'new_vehicles', m.version || k, String(Object.keys(m.files).length) + ' arquivos', fmt(m.createdAt),
    btn('Remover', 'danger', () => confirm('Remover manifesto ' + k + '?') && act('manifest/delete', { key: k }, 'Removido'), 'trash-2')]);
  $('#manifestTable').replaceChildren(...table(['Produto', 'Versão', 'Arquivos', 'Registrado em', ''], rows).children);
}

function renderLogs() {
  const cls = (t) => t === 'block' || t === 'denied' ? 'p-bad' : t === 'activate' ? 'p-ok' : 'p-mut';
  const rows = S.logs.map((l) => [fmt(l.t), pill(l.type, cls(l.type)), l.ip || '—', el('span', { text: l.msg })]);
  $('#logTable').replaceChildren(...table(['Quando', 'Tipo', 'IP', 'Mensagem'], rows).children);
}

// ---------- ações dos formulários ----------
$('#gType').onchange = () => { $('#gAmount').disabled = $('#gType').value === 'lifetime'; };
$('#btnGen').onclick = async () => {
  try {
    const r = await api('keys/generate', { product: $('#gProduct').value, type: $('#gType').value, amount: $('#gAmount').value, quantity: $('#gQty').value,
      maxIps: $('#gIps').value, buyer: $('#gBuyer').value, note: $('#gNote').value, sold: $('#gSold').checked });
    const o = $('#genOut'); o.textContent = r.keys.join('\n'); o.classList.remove('hidden');
    $('#btnCopyGen').classList.remove('hidden');
    toast(r.keys.length + ' key(s) gerada(s)'); await refresh();
  } catch (e) { toast(e.message, true); }
};
$('#btnCopyGen').onclick = () => { navigator.clipboard.writeText($('#genOut').textContent); toast('Keys copiadas'); };
$('#btnSettings').onclick = () => act('settings', { maxInvalidAttempts: $('#setMaxInv').value }, 'Configuração salva');
$('#btnManifest').onclick = async () => {
  let ver = $('#mVer').value.trim(); let product = $('#mProduct').value; const raw = $('#mJson').value.trim();
  try {
    const j = JSON.parse(raw);
    if (!ver && j.version) ver = j.version;
    if (j.product && S.products.includes(j.product)) product = j.product;
  } catch (e) { return toast('JSON inválido', true); }
  await act('manifest/set', { version: ver, product, manifest: raw }, 'Manifesto registrado');
};

paintIcons();
boot();
setInterval(() => { if (!$('#app').classList.contains('hidden')) refresh().catch(() => {}); }, 15000);
