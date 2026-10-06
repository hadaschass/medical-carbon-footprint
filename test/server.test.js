'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../server');

let server;
let base;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const post = (path, body) => fetch(base + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('search → product → estimate round trip for "latex glove"', async () => {
  const search = await (await fetch(`${base}/api/products?q=latex%20glove`)).json();
  assert.equal(search.results[0].id, 'latex-exam-glove');

  const product = await (await fetch(`${base}/api/products/latex-exam-glove`)).json();
  const res = await post('/api/estimate', { product, quantity: 100 });
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.stages.length, 7);
  assert.ok(result.quantityKgCO2e > 1 && result.quantityKgCO2e < 10);
});

test('unknown product id is 404', async () => {
  const res = await fetch(`${base}/api/products/nope`);
  assert.equal(res.status, 404);
});

test('invalid product is 422 with details', async () => {
  const res = await post('/api/estimate', { product: { name: 'x', components: [] } });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(Array.isArray(body.details) && body.details.length > 0);
});

test('malformed JSON is 400 and oversized body is 413', async () => {
  assert.equal((await post('/api/estimate', '{not json')).status, 400);
  const huge = JSON.stringify({ product: { name: 'x'.repeat(200 * 1024) } });
  const res = await post('/api/estimate', huge).catch(() => ({ status: 413 }));
  assert.equal(res.status, 413);
});

test('draft endpoint returns an editable product', async () => {
  const res = await post('/api/draft', { name: 'cotton bandage' });
  const draft = await res.json();
  assert.equal(draft.components[0].material, 'cotton');
  assert.equal((await post('/api/draft', {})).status, 400);
});

test('factors endpoint lists the selectable options', async () => {
  const f = await (await fetch(`${base}/api/factors`)).json();
  for (const key of ['materials', 'processes', 'grid', 'sterilization', 'transport', 'endOfLife']) {
    assert.ok(Object.keys(f[key]).length > 0, key);
  }
});

test('serves the UI and blocks path traversal', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Medical Carbon Footprint/);
  const traversal = await fetch(`${base}/..%2fserver.js`);
  assert.ok([403, 404].includes(traversal.status));
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
});
