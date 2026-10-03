// Sample frontend server (zero dependencies): serves the page and proxies /api to the backend.
import { createServer, request } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = new URL(process.env.BACKEND_URL || 'http://localhost:8000');
const port = Number(process.env.PORT || 8080);
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'] };

createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const p = request({ hostname: backend.hostname, port: backend.port, path: req.url, method: req.method, headers: { ...req.headers, host: backend.host } }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    p.on('error', () => {
      res.writeHead(502);
      res.end('backend unavailable');
    });
    req.pipe(p);
    return;
  }
  const f = files[req.url.split('?')[0]];
  if (!f) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': f[1] });
  res.end(readFileSync(join(here, f[0])));
}).listen(port, () => console.log(`frontend on http://localhost:${port} → ${backend.origin}`));
