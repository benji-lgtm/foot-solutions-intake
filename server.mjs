// Local preview only: `node server.mjs`, then open http://localhost:5173. Vercel serves the real thing.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, normalize } from 'node:path'
const api = { '/api/doctors': (await import('./api/doctors.js')).POST, '/api/photo': (await import('./api/photo.js')).POST }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.gz': 'application/gzip' }
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (api[path] && req.method === 'POST') {
    let body = ''
    for await (const c of req) body += c
    const r = await api[path](new Request('http://local' + path, { method: 'POST', body }))
    return res.writeHead(r.status, { 'content-type': 'application/json' }).end(await r.text())
  }
  const file = path === '/' ? 'index.html' : normalize(path.slice(1))
  if (file.startsWith('..') || !/^(index\.html|card-read\.js|vendor\/)/.test(file)) return res.writeHead(404).end()
  try { res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(new URL(file, import.meta.url))) }
  catch { res.writeHead(404).end() }
}).listen(process.env.PORT || 5173)
