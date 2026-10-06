'use strict';

const {
  MATERIALS,
  PROCESSES,
  GRID,
  STERILIZATION,
  TRANSPORT,
  END_OF_LIFE,
  EQUIVALENTS,
} = require('../data/factors');

const STAGES = [
  { key: 'materials', label: 'Raw materials' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'sterilization', label: 'Sterilisation' },
  { key: 'transport', label: 'Transport' },
  { key: 'use', label: 'Use & reprocessing' },
  { key: 'endOfLife', label: 'End of life' },
];

const LIMITS = {
  maxItems: 50,
  maxMassG: 1e6, // 1 tonne per functional unit
  maxKm: 50000,
  maxUses: 1e6,
  maxQuantity: 1e9,
};

class ValidationError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function checkNumber(errors, value, label, { min = 0, max = Infinity } = {}) {
  if (!isFiniteNumber(value) || value < min || value > max) {
    errors.push(`${label} must be a number between ${min} and ${max}`);
  }
}

function checkKey(errors, table, key, label) {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(table, key)) {
    errors.push(`${label} "${key}" is not recognised`);
  }
}

function checkList(errors, list, label, required) {
  if (!Array.isArray(list)) {
    errors.push(`${label} must be a list`);
    return false;
  }
  if (required && list.length === 0) errors.push(`${label} must contain at least one item`);
  if (list.length > LIMITS.maxItems) errors.push(`${label} may contain at most ${LIMITS.maxItems} items`);
  return true;
}

/** Throws a ValidationError listing every problem found in the product definition. */
function validateProduct(product) {
  const errors = [];
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    throw new ValidationError(['product must be an object']);
  }
  if (typeof product.name !== 'string' || !product.name.trim() || product.name.length > 200) {
    errors.push('name must be a non-empty string of at most 200 characters');
  }

  if (checkList(errors, product.components, 'components', true)) {
    product.components.forEach((c, i) => {
      const at = `components[${i}]`;
      if (!c || typeof c !== 'object') return errors.push(`${at} must be an object`);
      checkKey(errors, MATERIALS, c.material, `${at}.material`);
      checkKey(errors, PROCESSES, c.process, `${at}.process`);
      checkNumber(errors, c.massG, `${at}.massG`, { max: LIMITS.maxMassG });
      return undefined;
    });
  }

  if (checkList(errors, product.packaging || [], 'packaging', false)) {
    (product.packaging || []).forEach((p, i) => {
      const at = `packaging[${i}]`;
      if (!p || typeof p !== 'object') return errors.push(`${at} must be an object`);
      checkKey(errors, MATERIALS, p.material, `${at}.material`);
      checkNumber(errors, p.massG, `${at}.massG`, { max: LIMITS.maxMassG });
      return undefined;
    });
  }

  if (checkList(errors, product.transport || [], 'transport', false)) {
    (product.transport || []).forEach((t, i) => {
      const at = `transport[${i}]`;
      if (!t || typeof t !== 'object') return errors.push(`${at} must be an object`);
      checkKey(errors, TRANSPORT, t.mode, `${at}.mode`);
      checkNumber(errors, t.km, `${at}.km`, { max: LIMITS.maxKm });
      return undefined;
    });
  }

  checkKey(errors, GRID, product.country, 'country');
  checkKey(errors, STERILIZATION, product.sterilization, 'sterilization');
  checkKey(errors, END_OF_LIFE, product.endOfLife, 'endOfLife');
  if (product.packagingEndOfLife !== undefined) {
    checkKey(errors, END_OF_LIFE, product.packagingEndOfLife, 'packagingEndOfLife');
  }

  const use = product.use;
  if (use !== undefined) {
    if (!use || typeof use !== 'object') {
      errors.push('use must be an object');
    } else {
      checkNumber(errors, use.uses, 'use.uses', { min: 1, max: LIMITS.maxUses });
      if (isFiniteNumber(use.uses) && !Number.isInteger(use.uses)) errors.push('use.uses must be a whole number');
      checkNumber(errors, use.reprocessingKgPerUse ?? 0, 'use.reprocessingKgPerUse', { max: 1000 });
      checkNumber(errors, use.energyKwhPerUse ?? 0, 'use.energyKwhPerUse', { max: 10000 });
      if (use.country !== undefined) checkKey(errors, GRID, use.country, 'use.country');
    }
  }

  if (errors.length) throw new ValidationError(errors);
}

const round = (v, digits = 6) => Number(v.toFixed(digits));

/**
 * Cradle-to-grave footprint of one functional unit.
 *
 * Returns kg CO2e per *use*; for reusable products the production, transport
 * and disposal of the item are divided over `use.uses` cycles, and each cycle
 * adds its own reprocessing and energy-in-use emissions.
 */
function calculateFootprint(product, quantity = 1) {
  validateProduct(product);
  if (!isFiniteNumber(quantity) || quantity <= 0 || quantity > LIMITS.maxQuantity) {
    throw new ValidationError([`quantity must be a number between 0 and ${LIMITS.maxQuantity}`]);
  }

  const packaging = product.packaging || [];
  const transport = product.transport || [];
  const use = { uses: 1, reprocessingKgPerUse: 0, energyKwhPerUse: 0, country: product.country, ...product.use };
  const grid = GRID[product.country].factor;
  const packagingRoute = product.packagingEndOfLife || product.endOfLife;

  const productMassKg = product.components.reduce((s, c) => s + c.massG / 1000, 0);
  const packagingMassKg = packaging.reduce((s, p) => s + p.massG / 1000, 0);
  const shippedMassKg = productMassKg + packagingMassKg;

  // Per-component detail lets the UI point at hotspots.
  const components = product.components.map((c) => {
    const kg = c.massG / 1000;
    const material = kg * MATERIALS[c.material].factor;
    const manufacturing = kg * PROCESSES[c.process].kwhPerKg * grid;
    const endOfLife = kg * MATERIALS[c.material].eol[product.endOfLife];
    return {
      name: c.name || MATERIALS[c.material].name,
      material: c.material,
      materialName: MATERIALS[c.material].name,
      massG: c.massG,
      kgCO2e: { material, manufacturing, endOfLife, total: material + manufacturing + endOfLife },
    };
  });

  const unit = {
    materials: components.reduce((s, c) => s + c.kgCO2e.material, 0),
    manufacturing: components.reduce((s, c) => s + c.kgCO2e.manufacturing, 0),
    packaging: packaging.reduce((s, p) => s + (p.massG / 1000) * MATERIALS[p.material].factor, 0),
    sterilization: shippedMassKg * STERILIZATION[product.sterilization].factor,
    transport: transport.reduce((s, t) => s + (shippedMassKg / 1000) * t.km * TRANSPORT[t.mode].factor, 0),
    endOfLife:
      components.reduce((s, c) => s + c.kgCO2e.endOfLife, 0) +
      packaging.reduce((s, p) => s + (p.massG / 1000) * MATERIALS[p.material].eol[packagingRoute], 0),
  };

  const perUseUse =
    (use.reprocessingKgPerUse || 0) + (use.energyKwhPerUse || 0) * GRID[use.country || product.country].factor;

  const perUse = {};
  for (const { key } of STAGES) {
    perUse[key] = key === 'use' ? perUseUse : unit[key] / use.uses;
  }
  const totalPerUse = Object.values(perUse).reduce((s, v) => s + v, 0);
  const lifetimeTotal = totalPerUse * use.uses;

  const stages = STAGES.map(({ key, label }) => ({
    key,
    label,
    kgCO2e: round(perUse[key]),
    share: totalPerUse > 0 ? round(perUse[key] / totalPerUse, 4) : 0,
  }));

  const quantityTotal = totalPerUse * quantity;
  const equivalents = Object.entries(EQUIVALENTS).map(([key, e]) => ({
    key,
    label: e.label,
    value: round(quantityTotal / e.factor, 2),
  }));

  for (const c of components) {
    for (const k of Object.keys(c.kgCO2e)) c.kgCO2e[k] = round(c.kgCO2e[k] / use.uses);
  }
  components.sort((a, b) => b.kgCO2e.total - a.kgCO2e.total);

  return {
    name: product.name,
    functionalUnit: product.functionalUnit || '1 unit',
    reusable: use.uses > 1,
    uses: use.uses,
    massG: { product: round(productMassKg * 1000, 3), packaging: round(packagingMassKg * 1000, 3) },
    perUseKgCO2e: round(totalPerUse),
    lifetimeKgCO2e: round(lifetimeTotal),
    quantity,
    quantityKgCO2e: round(quantityTotal),
    // Secondary-data screening estimates are commonly quoted at about ±30 %.
    uncertainty: { low: round(quantityTotal * 0.7), high: round(quantityTotal * 1.3), note: '±30 % screening-level uncertainty' },
    stages,
    hotspot: stages.reduce((a, b) => (b.kgCO2e > a.kgCO2e ? b : a)),
    components,
    equivalents,
    recommendations: recommend(product, perUse, totalPerUse),
  };
}

function recommend(product, perUse, total) {
  const tips = [];
  const share = (k) => (total > 0 ? perUse[k] / total : 0);
  const materials = product.components.map((c) => c.material);

  if (share('materials') > 0.3) {
    tips.push('Raw materials dominate: lighter-gauge designs (less material per unit) cut emissions almost proportionally.');
  }
  if (share('manufacturing') > 0.25 && GRID[product.country].factor > 0.4) {
    tips.push(`Manufacturing on the ${GRID[product.country].name} grid (${GRID[product.country].factor} kg CO2e/kWh) is a hotspot: prefer suppliers using renewable electricity or biomass-fired drying ovens.`);
  }
  if (product.sterilization === 'ethylene_oxide') {
    tips.push('EtO sterilisation is carbon- and toxicity-intensive: ask whether gamma or e-beam sterilisation is validated for this product.');
  }
  if (product.sterilization !== 'none' && share('sterilization') > 0.1) {
    tips.push('Sterilisation is significant: confirm sterility is clinically required, or bundle items into procedure packs to sterilise less packaging.');
  }
  if ((product.transport || []).some((t) => t.mode === 'air')) {
    tips.push('Air freight emits ~40x more per tonne-km than container shipping: plan inventory to avoid air shipments.');
  }
  if (share('packaging') > 0.15) {
    tips.push('Packaging is a large share: request bulk/reduced packaging and recycled-content cartons.');
  }
  if (product.endOfLife === 'incineration' && materials.some((m) => ['polypropylene', 'pp_nonwoven', 'hdpe', 'ldpe', 'pet', 'nitrile_rubber', 'polystyrene'].includes(m)) && share('endOfLife') > 0.15) {
    tips.push('Fossil-based plastics release their carbon when incinerated: correct waste segregation (domestic or recycling instead of clinical waste where safe) reduces end-of-life emissions.');
  }
  if (materials.includes('natural_rubber_latex') || materials.includes('nitrile_rubber') || materials.includes('pvc')) {
    tips.push('Glove stewardship: avoiding unnecessary glove use (e.g. hand hygiene instead of gloves for routine non-contact care) is the most effective reduction.');
  }
  if ((product.use?.uses || 1) === 1) {
    tips.push('Check whether a reusable or remanufactured alternative exists; for many items the per-use footprint falls by 50-80 %.');
  }
  return tips;
}

module.exports = { calculateFootprint, validateProduct, ValidationError, STAGES, LIMITS };
