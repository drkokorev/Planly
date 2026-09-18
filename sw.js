/* Planly service worker: офлайн-кэш оболочки приложения. */
const CACHE = 'planly-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'
];

const OFFLINE_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Planly</title><style>
:root{color-scheme:light dark;--bg:#f2f2f7;--text:#0b0b0c;--text2:#6c6c70;--accent:#17a05e;--chip:rgba(120,120,128,.12)}
@media(prefers-color-scheme:dark){:root{--bg:#000;--text:#fff;--text2:#98989f;--accent:#30d97f;--chip:rgba(120,120,128,.22)}}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--text);
font:15px/1.45 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-align:center;padding:24px}
.gl{width:56px;height:56px;border-radius:50%;background:var(--chip);display:grid;place-items:center;margin:0 auto 16px;font-size:26px}
h1{font-size:20px;margin:0 0 8px;font-weight:600}
p{color:var(--text2);margin:0 0 20px;max-width:280px}
code{font-size:12px;color:var(--text2);word-break:break-all}
button{background:var(--accent);color:#fff;border:0;border-radius:12px;padding:13px 22px;font:600 15px system-ui}
</style></head><body><div><div class="gl">⚡</div>
<h1 id="h"></h1><p id="p"></p>
<button id="b" onclick="location.reload()"></button>
<p style="margin-top:20px"><code id="u"></code></p></div>
<script>
var M={ru:['Нет связи с сервером','Planly не смог загрузиться. Проверьте интернет и попробуйте снова.','Повторить'],
 en:['No connection','Planly could not load. Check your internet and try again.','Retry'],
 es:['Sin conexión','Planly no pudo cargarse. Comprueba tu conexión e inténtalo de nuevo.','Reintentar'],
 de:['Keine Verbindung','Planly konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.','Erneut versuchen'],
 zh:['无法连接服务器','Planly 无法加载。请检查网络后重试。','重试'],
 hi:['सर्वर से कनेक्शन नहीं','Planly लोड नहीं हो सका। इंटरनेट जाँचें और फिर कोशिश करें।','फिर कोशिश करें']};
var l=((navigator.languages&&navigator.languages[0])||navigator.language||'en').slice(0,2), m=M[l]||M.en;
document.documentElement.lang=l; document.getElementById('h').textContent=m[0];
document.getElementById('p').textContent=m[1]; document.getElementById('b').textContent=m[2];
document.getElementById('u').textContent=location.href;
</script></body></html>`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // в кэш кладём только удачные ответы со своего origin,
        // иначе туда попадают страницы ошибок и приложение «залипает» на них
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(hit => {
          if (hit) return hit;
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html').then(shell =>
              shell || new Response(OFFLINE_PAGE, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              })
            );
          }
          return Response.error();
        })
      )
  );
});
