#!/usr/bin/env node
/* Planly sync server — self-hosted reference implementation.
   Same protocol as functions/api/sync.js, no dependencies, documents stored as JSON files.

   Run:   PORT=8787 DATA_DIR=./data ALLOWED_CODES=AAAA-BBBB node server/sync-node.js
   Then proxy  /api/sync  from your web server to http://127.0.0.1:8787/api/sync  (see nginx.example.conf).

   GET  /api/sync?code=XXX            → { version, updatedAt, doc }
   PUT  /api/sync?code=XXX {base,doc} → 200 { version } | 409 { version, doc } when the server is ahead   */

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const MAX_BODY = 1024 * 1024;
const CODE_RE = /^[A-Za-z0-9-]{8,64}$/;
const ALLOWED = (process.env.ALLOWED_CODES || '').split(',').map(norm).filter(Boolean);

fs.mkdirSync(DATA_DIR, { recursive: true });

function norm(c) { return String(c || '').trim().toUpperCase().replace(/_/g, '-'); }
function allowed(code) { return ALLOWED.length === 0 || ALLOWED.includes(code); }
function fileOf(code) { return path.join(DATA_DIR, code + '.json'); }
function readDoc(code) {
  try { return JSON.parse(fs.readFileSync(fileOf(code), 'utf8')); }
  catch { return { version: 0, updatedAt: 0, doc: null }; }
}
function writeDoc(code, obj) {
  const tmp = fileOf(code) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, fileOf(code));           // atomic replace
}
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/api/sync') return send(res, 404, { error: 'not_found' });

  const code = norm(url.searchParams.get('code'));
  if (!CODE_RE.test(code)) return send(res, 400, { error: 'bad_code' });
  if (!allowed(code)) return send(res, 403, { error: 'not_allowed' });

  if (req.method === 'GET') return send(res, 200, readDoc(code));

  if (req.method === 'PUT') {
    let text = '';
    req.on('data', chunk => {
      text += chunk;
      if (text.length > MAX_BODY) { send(res, 413, { error: 'too_large' }); req.destroy(); }
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let body;
      try { body = JSON.parse(text); } catch { return send(res, 400, { error: 'bad_json' }); }
      if (!body || typeof body.doc !== 'object' || body.doc === null) return send(res, 400, { error: 'bad_doc' });

      const current = readDoc(code);
      if ((Number(body.base) || 0) !== current.version) return send(res, 409, current);

      const next = { version: current.version + 1, updatedAt: Date.now(), doc: body.doc };
      writeDoc(code, next);
      send(res, 200, { version: next.version, updatedAt: next.updatedAt });
    });
    return;
  }

  send(res, 405, { error: 'method_not_allowed' });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Planly sync server on http://127.0.0.1:${PORT}  data: ${DATA_DIR}  allowlist: ${ALLOWED.length ? ALLOWED.length + ' code(s)' : 'open'}`);
});
