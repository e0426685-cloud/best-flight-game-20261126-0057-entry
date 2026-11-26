// Static file server for Island Hopper's game/ — run on its own so the
// screenshot runner (which blocks while Chrome runs) never starves it.
// Usage: node serve-game.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameDir = join(here, 'game');
const port = Number(process.argv[2] || '8123');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(gameDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(gameDir) || !existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(port, () => console.log('serving game/ on', port));
