/* Planly · синхронизация: KV-хранилище одного документа на код доступа.
   GET  /api/sync?code=XXX        → { version, updatedAt, doc }
   PUT  /api/sync?code=XXX  {base, doc}
        200 { version }           — записано
        409 { version, doc }      — на сервере уже новее, забирай и сливай  */

const CODE_RE = /^[A-Za-z0-9-]{8,64}$/;

/* Белый список кодов — необязательная переменная окружения ALLOWED_CODES
   (коды через запятую). Не задана или пуста — синхронизация открыта для любого кода.
   Задаётся секретом:  npx wrangler pages secret put ALLOWED_CODES --project-name <проект>  */
const norm = c => c.trim().toUpperCase().replace(/_/g, '-');
function allowed(code, env) {
  const raw = (env && env.ALLOWED_CODES) || '';
  const list = raw.split(',').map(norm).filter(Boolean);
  return list.length === 0 || list.indexOf(code) !== -1;
}
const MAX_BODY = 1024 * 1024;      // 1 МБ на документ — с запасом
const TTL = 400 * 24 * 60 * 60;    // 400 дней с последней записи

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

const keyOf = code => 'doc:' + code;

export async function onRequestGet({ request, env }) {
  const code = norm(new URL(request.url).searchParams.get('code') || '');
  if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400);
  if (!allowed(code, env)) return json({ error: 'not_allowed' }, 403);
  if (!env.PLANLY_SYNC) return json({ error: 'no_kv_binding' }, 503);

  const raw = await env.PLANLY_SYNC.get(keyOf(code));
  if (!raw) return json({ version: 0, updatedAt: 0, doc: null });
  return new Response(raw, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestPut({ request, env }) {
  const code = norm(new URL(request.url).searchParams.get('code') || '');
  if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400);
  if (!allowed(code, env)) return json({ error: 'not_allowed' }, 403);

  if (!env.PLANLY_SYNC) return json({ error: 'no_kv_binding' }, 503);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);

  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body || typeof body.doc !== 'object' || body.doc === null) return json({ error: 'bad_doc' }, 400);

  const raw = await env.PLANLY_SYNC.get(keyOf(code));
  const current = raw ? JSON.parse(raw) : { version: 0, updatedAt: 0, doc: null };
  const base = Number(body.base) || 0;

  if (base !== current.version) return json(current, 409);

  const next = { version: current.version + 1, updatedAt: Date.now(), doc: body.doc };
  await env.PLANLY_SYNC.put(keyOf(code), JSON.stringify(next), { expirationTtl: TTL });
  return json({ version: next.version, updatedAt: next.updatedAt });
}
