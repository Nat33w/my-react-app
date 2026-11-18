// Tiny API server for Indie Radar. Steam's store has no CORS headers, so the
// browser can't call it directly; this server fetches and caches it instead.
// In production it also serves the React build from /build.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { LISTS, fetchList, fetchDetails } = require('./steam');

const PORT = Number(process.env.PORT) || 3001;
const BUILD_DIR = path.join(__dirname, '..', 'build');
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map();

async function cached(key, fn, force = false) {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(BUILD_DIR)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('API server is running. Start the UI with "npm start" (or run "npm run build" first).');
  }
  let file = path.normalize(path.join(BUILD_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(BUILD_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(BUILD_DIR, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === '/api/lists') {
      return sendJson(res, 200, Object.entries(LISTS).map(([key, l]) => ({ key, label: l.label })));
    }

    if (pathname === '/api/games') {
      const list = searchParams.get('list') || 'new';
      const pages = Math.min(6, Math.max(1, Number(searchParams.get('pages')) || 2));
      const force = searchParams.get('refresh') === '1';
      const data = await cached(`games:${list}:${pages}`, () => fetchList(list, pages), force);
      return sendJson(res, 200, data);
    }

    const m = pathname.match(/^\/api\/details\/(\d+)$/);
    if (m) {
      const data = await cached(`details:${m[1]}`, () => fetchDetails(m[1]));
      return sendJson(res, 200, data);
    }

    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    return sendJson(res, 502, { error: err.message || 'Failed to reach Steam' });
  }
});

server.listen(PORT, () => {
  console.log(`Indie Radar API listening on http://localhost:${PORT}`);
});
