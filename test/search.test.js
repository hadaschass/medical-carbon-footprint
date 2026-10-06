'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { searchProducts, draftProduct, levenshtein } = require('../src/engine/search');
const { calculateFootprint } = require('../src/engine/calculator');

const top = (q) => searchProducts(q)[0]?.product.id;

test('finds products by common names', () => {
  assert.equal(top('latex glove'), 'latex-exam-glove');
  assert.equal(top('Latex Gloves'), 'latex-exam-glove');
  assert.equal(top('nitrile gloves'), 'nitrile-exam-glove');
  assert.equal(top('syringe'), 'syringe-5ml');
  assert.equal(top('N95'), 'ffp2-respirator');
  assert.equal(top('surgical mask'), 'surgical-mask');
  assert.equal(top('reusable gown'), 'reusable-surgical-gown');
});

test('tolerates typos', () => {
  assert.equal(top('latx glove'), 'latex-exam-glove');
  assert.equal(top('nitril glove'), 'nitrile-exam-glove');
  assert.equal(top('syrnge'), 'syringe-5ml');
});

test('returns nothing for unrelated queries', () => {
  assert.deepEqual(searchProducts('xyz widget'), []);
});

test('levenshtein distance', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('glove', 'glove'), 0);
});

test('drafts an estimable product for unknown names', () => {
  const draft = draftProduct('silicone breathing mask');
  assert.equal(draft.components[0].material, 'silicone');
  assert.ok(draft.draft);
  assert.ok(calculateFootprint(draft).perUseKgCO2e > 0);

  const unknown = draftProduct('thingamajig');
  assert.equal(unknown.components[0].material, 'polypropylene');
  assert.match(unknown.draftNote, /polypropylene/);

  assert.equal(draftProduct('sterile drape').sterilization, 'ethylene_oxide');
});
