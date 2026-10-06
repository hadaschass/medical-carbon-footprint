'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { build } = require('../scripts/build-static');

// Runs the bundled engine script from the built page in a bare sandbox and
// checks it answers the same API calls as the server.
function loadBundle(html) {
  const engine = html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  const window = {};
  vm.runInNewContext(engine, { window, URL, Promise, JSON });
  return window;
}

test('static page inlines everything and has no external references', () => {
  const html = build({ fragment: false });
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /src="app\.js"|href="styles\.css"|href="favicon\.svg"/);
  assert.match(html, /data:image\/svg\+xml;base64,/);
});

test('fragment omits the document skeleton and copies instead of downloading', () => {
  const html = build({ fragment: true });
  assert.doesNotMatch(html, /<html[\s>]|<head[\s>]|<body[\s>]|<!doctype/i);
  assert.match(html, /^<title>/);
  assert.match(html, /window\.MCF_EXPORT = 'copy'/);
});

test('bundled engine answers API calls in-page', async () => {
  const window = loadBundle(build({ fragment: false }));
  const search = await window.MCF_LOCAL_API('/api/products?q=latex%20glove');
  assert.equal(search.body.results[0].id, 'latex-exam-glove');

  const product = (await window.MCF_LOCAL_API('/api/products/latex-exam-glove')).body;
  const est = await window.MCF_LOCAL_API('/api/estimate', {
    method: 'POST',
    body: JSON.stringify({ product, quantity: 100 }),
  });
  assert.equal(est.status, 200);
  assert.ok(est.body.quantityKgCO2e > 1 && est.body.quantityKgCO2e < 10);

  const bad = await window.MCF_LOCAL_API('/api/estimate', { method: 'POST', body: '{"product":{}}' });
  assert.equal(bad.status, 422);
});
