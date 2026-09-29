#!/usr/bin/env node
/* Planly self-hosted server — sync API and, optionally, the app itself.
   No dependencies; each access code is one JSON file in DATA_DIR.

   Whole instance in one process (what the Docker image does):
     PORT=8080 HOST=0.0.0.0 DATA_DIR=./data node server/sync-node.js

   Sync only, app served by nginx (see nginx.example.conf):
     PORT=8787 DATA_DIR=./data SERVE_STATIC=0 node server/sync-node.js

   Environment:
     PORT           port to listen on                      (default 8787)
     HOST           address to bind                        (default 127.0.0.1)
     DATA_DIR       where documents are stored             (default ./data)
     STATIC_DIR     folder with index.html, sw.js, icons/  (default: repository root)
     SERVE_STATIC   0 disables static file serving         (default: enabled)
     ALLOWED_CODES  comma-separated allowlist              (default: any code accepted)

   GET  /api/sync?code=XXX            → { version, updatedAt, doc }
   PUT  /api/sync?code=XXX {base,doc} → 200 { version } | 409 { version, doc } when the server is ahead   */

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..'));
const SERVE_STATIC = process.env.SERVE_STATIC !== '0';
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
/* ---------- static files ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};
const NO_CACHE = new Set(['/index.html', '/sw.js', '/manifest.json', '/version.txt']);

/* the build stamp lives inside index.html; the app polls /version.txt to offer an update */
function buildStamp() {
  try {
    const m = fs.readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8').match(/BUILD='([^']*)'/);
    return m ? m[1] : 'self-hosted';
  } catch { return 'self-hosted'; }
}

function sendFile(res, file, urlPath) {
  let body;
  try { body = fs.readFileSync(file); } catch { return false; }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': NO_CACHE.has(urlPath) ? 'no-cache, must-revalidate' : 'public, max-age=2592000'
  });
  res.end(body);
  return true;
}

function serveStatic(req, res, urlPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method_not_allowed' });

  if (urlPath === '/version.txt') {
    const stamp = buildStamp();
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
    return res.end(stamp);
  }

  // no directory traversal: resolve and verify the result stays inside STATIC_DIR
  const rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath).replace(/^\/+/, '');
  const file = path.resolve(STATIC_DIR, rel);
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + path.sep)) return send(res, 403, { error: 'forbidden' });

  if (sendFile(res, file, urlPath)) return;
  sendFile(res, path.join(STATIC_DIR, 'index.html'), '/index.html') || send(res, 404, { error: 'not_found' });
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
  if (url.pathname !== '/api/sync') {
    return SERVE_STATIC ? serveStatic(req, res, url.pathname) : send(res, 404, { error: 'not_found' });
  }

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
}).listen(PORT, HOST, () => {
  console.log(`Planly on http://${HOST}:${PORT}`);
  console.log(`  data:      ${DATA_DIR}`);
  console.log(`  app:       ${SERVE_STATIC ? STATIC_DIR + ' (build ' + buildStamp() + ')' : 'not served (SERVE_STATIC=0)'}`);
  console.log(`  allowlist: ${ALLOWED.length ? ALLOWED.length + ' code(s)' : 'open — any code accepted'}`);
});
