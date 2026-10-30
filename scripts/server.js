import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export const BASE = '/calculadora-mxn-usd/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
export function createServer(transform = (_file, data) => data) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.writeHead(302, { Location: BASE }); res.end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
    const file = path.resolve(root, relative);
    if (!url.pathname.startsWith(BASE) || !file.startsWith(root) || relative.split(/[\\/]/).some(part => part.startsWith('.')) || relative.startsWith('node_modules/')) { res.writeHead(404); res.end(); return; }
    try {
      const data = transform(relative, await readFile(file));
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(data);
    } catch { res.writeHead(404); res.end('No encontrado'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4174);
  createServer().listen(port, '127.0.0.1', () => console.log(`Vista local v1.4 (sin publicar): http://localhost:${port}${BASE}`));
}
