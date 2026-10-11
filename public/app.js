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
// ---------- ícones (Lucide embutido, sem CDN) ----------
const ICONS = {"shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /> <path d=\"m9 12 2 2 4-4\" />", "lock-keyhole": "<circle cx=\"12\" cy=\"16\" r=\"1\" /> <rect x=\"3\" y=\"10\" width=\"18\" height=\"12\" rx=\"2\" /> <path d=\"M7 10V7a5 5 0 0 1 10 0v3\" />", "log-in": "<path d=\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\" /> <polyline points=\"10 17 15 12 10 7\" /> <line x1=\"15\" x2=\"3\" y1=\"12\" y2=\"12\" />", "layout-dashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /> <rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />", "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /> <circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />", "ban": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m4.9 4.9 14.2 14.2\" />", "file-json-2": "<path d=\"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M4 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1\" /> <path d=\"M8 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1\" />", "scroll-text": "<path d=\"M15 12h-5\" /> <path d=\"M15 8h-5\" /> <path d=\"M19 17V5a2 2 0 0 0-2-2H4\" /> <path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\" />", "log-out": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" /> <polyline points=\"16 17 21 12 16 7\" /> <line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\" />", "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />", "sparkles": "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\" /> <path d=\"M20 3v4\" /> <path d=\"M22 5h-4\" /> <path d=\"M4 17v2\" /> <path d=\"M5 18H3\" />", "wand-sparkles": "<path d=\"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72\" /> <path d=\"m14 7 3 3\" /> <path d=\"M5 6v4\" /> <path d=\"M19 14v4\" /> <path d=\"M10 2v2\" /> <path d=\"M7 8H3\" /> <path d=\"M21 16h-4\" /> <path d=\"M11 3H9\" />", "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /> <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />", "list": "<path d=\"M3 12h.01\" /> <path d=\"M3 18h.01\" /> <path d=\"M3 6h.01\" /> <path d=\"M8 12h13\" /> <path d=\"M8 18h13\" /> <path d=\"M8 6h13\" />", "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /> <path d=\"m21 21-4.3-4.3\" />", "shield-alert": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /> <path d=\"M12 8v4\" /> <path d=\"M12 16h.01\" />", "siren": "<path d=\"M7 18v-6a5 5 0 1 1 10 0v6\" /> <path d=\"M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z\" /> <path d=\"M21 12h1\" /> <path d=\"M18.5 4.5 18 5\" /> <path d=\"M2 12h1\" /> <path d=\"M12 2v1\" /> <path d=\"m4.929 4.929.707.707\" /> <path d=\"M12 12v6\" />", "save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /> <path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /> <path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />", "fingerprint": "<path d=\"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4\" /> <path d=\"M14 13.12c0 2.38 0 6.38-1 8.88\" /> <path d=\"M17.29 21.02c.12-.6.43-2.3.5-3.02\" /> <path d=\"M2 12a10 10 0 0 1 18-6\" /> <path d=\"M2 16h.01\" /> <path d=\"M21.8 16c.2-2 .131-5.354 0-6\" /> <path d=\"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2\" /> <path d=\"M8.65 22c.21-.66.45-1.32.57-2\" /> <path d=\"M9 6.8a6 6 0 0 1 9 5.2v2\" />", "upload": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /> <polyline points=\"17 8 12 3 7 8\" /> <line x1=\"12\" x2=\"12\" y1=\"3\" y2=\"15\" />", "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" /> <path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" /> <path d=\"M10 12h4\" />", "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />", "chart-pie": "<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /> <path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" />", "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\" /> <path d=\"M12 22V12\" /> <path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\" /> <path d=\"m7.5 4.27 9 5.15\" />", "chart-column": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /> <path d=\"M18 17V9\" /> <path d=\"M13 17V5\" /> <path d=\"M8 17v-3\" />", "radio": "<path d=\"M4.9 19.1C1 15.2 1 8.8 4.9 4.9\" /> <path d=\"M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5\" /> <circle cx=\"12\" cy=\"12\" r=\"2\" /> <path d=\"M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5\" /> <path d=\"M19.1 4.9C23 8.8 23 15.1 19.1 19\" />", "shield-x": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /> <path d=\"m14.5 9.5-5 5\" /> <path d=\"m9.5 9.5 5 5\" />", "badge-check": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" /> <path d=\"m9 12 2 2 4-4\" />", "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 16v-4\" /> <path d=\"M12 8h.01\" />", "circle-check": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m9 12 2 2 4-4\" />", "shopping-bag": "<path d=\"M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z\" /> <path d=\"M3 6h18\" /> <path d=\"M16 10a4 4 0 0 1-8 0\" />", "inbox": "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\" /> <path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" />", "timer-off": "<path d=\"M10 2h4\" /> <path d=\"M4.6 11a8 8 0 0 0 1.7 8.7 8 8 0 0 0 8.7 1.7\" /> <path d=\"M7.4 7.4a8 8 0 0 1 10.3 1 8 8 0 0 1 .9 10.2\" /> <path d=\"m2 2 20 20\" /> <path d=\"M12 12v-2\" />", "wifi": "<path d=\"M12 20h.01\" /> <path d=\"M2 8.82a15 15 0 0 1 20 0\" /> <path d=\"M5 12.859a10 10 0 0 1 14 0\" /> <path d=\"M8.5 16.429a5 5 0 0 1 7 0\" />", "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />", "badge-dollar-sign": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" /> <path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\" /> <path d=\"M12 18V6\" />", "undo-2": "<path d=\"M9 14 4 9l5-5\" /> <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\" />", "lock-open": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 9.9-1\" />", "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />", "network": "<rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /> <rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /> <rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1\" /> <path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\" /> <path d=\"M12 12V8\" />", "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /> <path d=\"M3 3v5h5\" />", "trash-2": "<path d=\"M3 6h18\" /> <path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /> <path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /> <line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /> <line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />"};
const paintIcons = () => {
  document.querySelectorAll('i[data-lucide]').forEach((i) => {
    const body = ICONS[i.getAttribute('data-lucide')]; if (!body) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('class', 'lucide'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = body; // body vem do código, não de usuário
    i.replaceWith(s);
  });
};

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
  return el('div', { class: 'card' }, cardHead('chart-pie', 'Status das keys', 'Como suas licenças estão distribuídas'),
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
  return el('div', { class: 'card' }, cardHead('chart-column', 'Atividade dos últimos 7 dias', 'Eventos registrados por dia'),
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
// botão com ícone Lucide + texto; `tip` = explicação ao passar o mouse
const btn = (txt, cls, onclick, icon, only, tip) => {
  const b = el('button', { class: 'sm ' + (cls || '') + (only ? ' icon' : ''), type: 'button', onclick }, icon ? ic(icon) : null, only ? null : txt);
  b.title = tip || txt; if (only) b.setAttribute('aria-label', txt);
  return b;
};

function renderKeys() {
  const q = $('#keySearch').value.toLowerCase();
  const list = S.licenses.filter((l) => !q || [l.key, l.product, l.buyer, l.note, l.lastIp, l.lastServer].join(' ').toLowerCase().includes(q));
  const rows = list.map((l) => {
    const [txt, cls] = licStatus(l);
    const actions = el('div', { class: 'cell-actions' },
      btn('Copiar', '', () => { navigator.clipboard.writeText(l.key); toast('Key copiada'); }, 'copy', false, 'Copiar a key'),
      btn(l.sold ? 'Editar venda' : 'Vender', 'good', () => {
        const name = prompt('Nome do comprador:', l.buyer || ''); if (name === null) return;
        act('keys/' + l.key + '/update', { sold: true, buyer: name }, 'Marcada como vendida');
      }, l.sold ? 'pencil' : 'badge-dollar-sign', false, 'Marcar como vendida e informar o comprador'),
      l.sold ? btn('Desmarcar', '', () => act('keys/' + l.key + '/update', { sold: false }, 'Venda removida'), 'undo-2', false, 'Remover a marca de vendida') : null,
      l.blocked ? btn('Desbloquear', 'good', () => act('keys/' + l.key + '/unblock', {}, 'Desbloqueada'), 'lock-open', false, 'Liberar esta key novamente')
        : btn('Bloquear', 'danger', () => { const r = prompt('Motivo do bloqueio:', 'Bloqueada pelo administrador'); if (r !== null) act('keys/' + l.key + '/block', { reason: r }, 'Bloqueada'); }, 'lock', false, 'Impedir esta key de funcionar'),
      btn('Reset IPs', '', () => confirm('Liberar a key para um novo IP?') && act('keys/' + l.key + '/reset-ips', {}, 'IPs resetados'), 'network', false, 'Apaga os IPs usados para a key aceitar um novo IP'),
      btn('Reset base', '', () => confirm('Resetar manifesto base desta key?') && act('keys/' + l.key + '/reset-baseline', {}, 'Base resetada'), 'rotate-ccw', false, 'Reseta o manifesto base (anti-adulteração) desta key'),
      btn('Excluir', 'danger', () => confirm('Excluir ' + l.key + ' definitivamente?') && act('keys/' + l.key + '/delete', {}, 'Excluída'), 'trash-2', false, 'Excluir a key para sempre'));
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
