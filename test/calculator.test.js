'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateFootprint, ValidationError } = require('../src/engine/calculator');
const { PRODUCTS } = require('../src/data/products');
const { MATERIALS, PROCESSES, GRID, TRANSPORT } = require('../src/data/factors');

const latexGlove = () => structuredClone(PRODUCTS.find((p) => p.id === 'latex-exam-glove'));

test('every library product produces a positive, finite footprint', () => {
  for (const product of PRODUCTS) {
    const r = calculateFootprint(product);
    assert.ok(Number.isFinite(r.perUseKgCO2e) && r.perUseKgCO2e > 0, product.id);
    const stageSum = r.stages.reduce((s, x) => s + x.kgCO2e, 0);
    assert.ok(Math.abs(stageSum - r.perUseKgCO2e) < 1e-5, `${product.id} stages add up`);
  }
});

test('latex glove stages match the hand calculation', () => {
  const r = calculateFootprint(latexGlove());
  const kg = 0.0055;
  const stage = (key) => r.stages.find((s) => s.key === key).kgCO2e;

  assert.ok(Math.abs(stage('materials') - kg * MATERIALS.natural_rubber_latex.factor) < 1e-6);
  assert.ok(Math.abs(stage('manufacturing') - kg * PROCESSES.dipping.kwhPerKg * GRID.malaysia.factor) < 1e-6);
  assert.ok(Math.abs(stage('packaging') - 0.001 * MATERIALS.cardboard.factor) < 1e-6);
  const tkm = (0.0065 / 1000);
  const transport = tkm * (300 * TRANSPORT.road.factor + 12000 * TRANSPORT.sea.factor + 500 * TRANSPORT.road.factor);
  assert.ok(Math.abs(stage('transport') - transport) < 1e-6);
  assert.equal(stage('sterilization'), 0);
  assert.equal(stage('use'), 0);

  // A latex exam glove is in the published range of a few tens of grams CO2e.
  assert.ok(r.perUseKgCO2e > 0.02 && r.perUseKgCO2e < 0.06, `got ${r.perUseKgCO2e}`);
});

test('quantity scales the total linearly', () => {
  const one = calculateFootprint(latexGlove(), 1);
  const box = calculateFootprint(latexGlove(), 100);
  assert.ok(Math.abs(box.quantityKgCO2e - one.perUseKgCO2e * 100) < 1e-4);
  assert.ok(box.uncertainty.low < box.quantityKgCO2e && box.uncertainty.high > box.quantityKgCO2e);
});

test('reusable products amortise production over their uses', () => {
  const p = latexGlove();
  const single = calculateFootprint(p).perUseKgCO2e;
  p.use = { uses: 10, reprocessingKgPerUse: 0.001, energyKwhPerUse: 0 };
  const r = calculateFootprint(p);
  assert.ok(r.reusable);
  assert.ok(Math.abs(r.perUseKgCO2e - (single / 10 + 0.001)) < 1e-6);
  assert.ok(Math.abs(r.lifetimeKgCO2e - r.perUseKgCO2e * 10) < 1e-5);
});

test('reusable gown beats single-use gown per use', () => {
  const single = calculateFootprint(PRODUCTS.find((p) => p.id === 'single-use-surgical-gown'));
  const reusable = calculateFootprint(PRODUCTS.find((p) => p.id === 'reusable-surgical-gown'));
  assert.ok(reusable.perUseKgCO2e < single.perUseKgCO2e);
});

test('lower-carbon grid and sterilisation choices reduce the footprint', () => {
  const base = calculateFootprint(latexGlove()).perUseKgCO2e;
  const greener = latexGlove();
  greener.country = 'france';
  assert.ok(calculateFootprint(greener).perUseKgCO2e < base);

  const sterile = latexGlove();
  sterile.sterilization = 'ethylene_oxide';
  assert.ok(calculateFootprint(sterile).perUseKgCO2e > base);
  assert.ok(calculateFootprint(sterile).recommendations.some((t) => /EtO/.test(t)));
});

test('air freight raises transport emissions', () => {
  const p = latexGlove();
  p.transport = [{ mode: 'air', km: 12000 }];
  const r = calculateFootprint(p);
  const air = r.stages.find((s) => s.key === 'transport').kgCO2e;
  const sea = calculateFootprint(latexGlove()).stages.find((s) => s.key === 'transport').kgCO2e;
  assert.ok(air > sea * 10);
  assert.ok(r.recommendations.some((t) => /Air freight/.test(t)));
});

test('validation rejects malformed products with every problem listed', () => {
  const bad = latexGlove();
  bad.components[0].material = 'unobtainium';
  bad.components[0].massG = -1;
  bad.country = 'atlantis';
  bad.transport = [{ mode: 'teleport', km: 5 }];
  assert.throws(() => calculateFootprint(bad), (err) => {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.errors.length, 4);
    return true;
  });
});

test('validation rejects empty components, bad uses and bad quantity', () => {
  const empty = latexGlove();
  empty.components = [];
  assert.throws(() => calculateFootprint(empty), ValidationError);

  const fractional = latexGlove();
  fractional.use = { uses: 2.5 };
  assert.throws(() => calculateFootprint(fractional), ValidationError);

  assert.throws(() => calculateFootprint(latexGlove(), 0), ValidationError);
  assert.throws(() => calculateFootprint(latexGlove(), 'ten'), ValidationError);
  assert.throws(() => calculateFootprint(null), ValidationError);
  assert.throws(() => calculateFootprint({ ...latexGlove(), name: '' }), ValidationError);
});

test('prototype keys are not accepted as factor names', () => {
  const p = latexGlove();
  p.components[0].material = 'constructor';
  assert.throws(() => calculateFootprint(p), ValidationError);
});
