#!/usr/bin/env node
'use strict';
// Gera o manifesto oficial (sha256 de meta.xml + todos os <script>, exceto Config.lua)
// Uso: node tools/gen-manifest.js ../new_vehicles   (rode DEPOIS de compilar)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = path.resolve(process.argv[2] || '../new_vehicles');
const SKIP = new Set(['Config.lua']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex');

const meta = fs.readFileSync(path.join(dir, 'meta.xml'), 'utf8');
const version = (/<info[^>]*\sversion="([^"]*)"/.exec(meta) || [])[1] || '0';
const scripts = [...meta.matchAll(/<script\s[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !SKIP.has(s)).sort();

const files = { 'meta.xml': sha('meta.xml') };
for (const s of scripts) {
  if (!fs.existsSync(path.join(dir, s))) { console.error('Arquivo do meta nao existe: ' + s); process.exit(1); }
  files[s] = sha(s);
}
console.log(JSON.stringify({ version, files }, null, 2));
