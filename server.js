'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const factors = require('./src/data/factors');
const { calculateFootprint, ValidationError } = require('./src/engine/calculator');
const { searchProducts, findProductById, draftProduct } = require('./src/engine/search');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 100 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:",
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Body must be valid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function summary(product, score) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    functionalUnit: product.functionalUnit,
    score,
  };
}

function factorTables() {
  const pick = (table, fields) =>
    Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Object.fromEntries(fields.map((f) => [f, v[f]]))]));
  return {
    materials: pick(factors.MATERIALS, ['name', 'factor', 'eol']),
    processes: pick(factors.PROCESSES, ['name', 'kwhPerKg']),
    grid: pick(factors.GRID, ['name', 'factor']),
    sterilization: pick(factors.STERILIZATION, ['name', 'factor']),
    transport: pick(factors.TRANSPORT, ['name', 'factor']),
    endOfLife: pick(factors.END_OF_LIFE, ['name']),
  };
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/products') {
    const q = url.searchParams.get('q') || '';
    const results = searchProducts(q.slice(0, 200));
    return sendJson(res, 200, { query: q, results: results.map((r) => summary(r.product, r.score)) });
  }

  const productMatch = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && productMatch) {
    const product = findProductById(productMatch[1]);
    if (!product) return sendJson(res, 404, { error: 'Product not found' });
    return sendJson(res, 200, product);
  }

  if (req.method === 'GET' && pathname === '/api/factors') {
    return sendJson(res, 200, factorTables());
  }

  if (req.method === 'POST' && pathname === '/api/draft') {
    const body = await readJsonBody(req);
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return sendJson(res, 400, { error: 'name is required' });
    }
    return sendJson(res, 200, draftProduct(body.name));
  }

  if (req.method === 'POST' && pathname === '/api/estimate') {
    const body = await readJsonBody(req);
    const quantity = body.quantity === undefined ? 1 : body.quantity;
    return sendJson(res, 200, calculateFootprint(body.product, quantity));
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, SECURITY_HEADERS);
    return res.end();
  }
  let requested;
  try {
    requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, SECURITY_HEADERS);
    return res.end('Bad request');
  }
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, SECURITY_HEADERS);
    return res.end('Forbidden');
  }
  return fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      ...SECURITY_HEADERS,
    });
    return res.end(req.method === 'HEAD' ? undefined : data);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return sendJson(res, 400, { error: 'Bad request' });
    }
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
    try {
      return await handleApi(req, res, url);
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 422, { error: 'Invalid product', details: err.errors });
      if (err.status) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      return sendJson(res, 500, { error: 'Internal server error' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => {
    console.log(`Medical product carbon footprint calculator running at http://localhost:${port}`);
  });
}

module.exports = { createServer };
