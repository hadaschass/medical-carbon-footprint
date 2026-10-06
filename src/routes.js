'use strict';

/**
 * Transport-independent API routes. The Node server feeds HTTP requests in
 * here, and the static build calls it directly in the browser, so both
 * deployments answer every request identically.
 */

const factors = require('./data/factors');
const { calculateFootprint, ValidationError } = require('./engine/calculator');
const { searchProducts, findProductById, draftProduct } = require('./engine/search');

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

/**
 * @param {string} method HTTP method
 * @param {string} pathname e.g. "/api/products"
 * @param {URLSearchParams} searchParams
 * @param {() => Promise<object>} readBody resolves the parsed JSON body
 * @returns {Promise<{status: number, body: object}>}
 */
async function route(method, pathname, searchParams, readBody) {
  try {
    if (method === 'GET' && pathname === '/api/products') {
      const q = searchParams.get('q') || '';
      const results = searchProducts(q.slice(0, 200));
      return { status: 200, body: { query: q, results: results.map((r) => summary(r.product, r.score)) } };
    }

    const productMatch = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
    if (method === 'GET' && productMatch) {
      const product = findProductById(productMatch[1]);
      if (!product) return { status: 404, body: { error: 'Product not found' } };
      return { status: 200, body: product };
    }

    if (method === 'GET' && pathname === '/api/factors') {
      return { status: 200, body: factorTables() };
    }

    if (method === 'POST' && pathname === '/api/draft') {
      const body = await readBody();
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return { status: 400, body: { error: 'name is required' } };
      }
      return { status: 200, body: draftProduct(body.name) };
    }

    if (method === 'POST' && pathname === '/api/estimate') {
      const body = await readBody();
      const quantity = body.quantity === undefined ? 1 : body.quantity;
      return { status: 200, body: calculateFootprint(body.product, quantity) };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (err) {
    if (err instanceof ValidationError) return { status: 422, body: { error: 'Invalid product', details: err.errors } };
    if (err.status) return { status: err.status, body: { error: err.message } };
    throw err;
  }
}

module.exports = { route };
