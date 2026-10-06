'use strict';

const { PRODUCTS } = require('../data/products');

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'with', 'medical', 'disposable', 'single', 'use']);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stem(word) {
  if (word.length > 4 && word.endsWith('es') && /(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w))
    .map(stem);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** 1 for an exact token match, 0.8 for a prefix, 0.7 for a small typo, else 0. */
function tokenSimilarity(q, t) {
  if (q === t) return 1;
  if (q.length >= 3 && t.startsWith(q)) return 0.8;
  const allowed = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  return allowed && levenshtein(q, t) <= allowed ? 0.7 : 0;
}

function scoreAgainst(queryTokens, text) {
  const target = tokenize(text);
  if (!target.length || !queryTokens.length) return 0;
  let matched = 0;
  for (const q of queryTokens) {
    matched += Math.max(0, ...target.map((t) => tokenSimilarity(q, t)));
  }
  // Recall over the query, lightly penalising long candidate names.
  const recall = matched / queryTokens.length;
  const precision = matched / target.length;
  return 0.75 * recall + 0.25 * precision;
}

/**
 * Ranks library products against a free-text query such as "latex glove".
 * Returns [{ product, score }] with score in (0, 1], best first.
 */
function searchProducts(query, { limit = 8, minScore = 0.45 } = {}) {
  const q = normalize(query);
  if (!q) {
    return PRODUCTS.slice(0, limit).map((product) => ({ product, score: 0 }));
  }
  const queryTokens = tokenize(q);
  return PRODUCTS.map((product) => {
    const names = [product.name, ...product.aliases];
    let score = Math.max(...names.map((n) => scoreAgainst(queryTokens, n)));
    if (names.some((n) => normalize(n) === q)) score = Math.max(score, 1);
    return { product, score: Number(score.toFixed(3)) };
  })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function findProductById(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

// Keyword hints used to draft a bill of materials for products that are not
// in the library. Order matters: the first match wins.
const MATERIAL_HINTS = [
  [['latex', 'rubber'], 'natural_rubber_latex', 'dipping'],
  [['nitrile'], 'nitrile_rubber', 'dipping'],
  [['vinyl', 'pvc', 'tubing', 'tube', 'bag'], 'pvc', 'extrusion'],
  [['silicone'], 'silicone', 'injection_molding'],
  [['cotton', 'gauze', 'bandage', 'linen', 'towel'], 'cotton', 'textile'],
  [['polyester', 'scrub', 'uniform'], 'polyester_textile', 'textile'],
  [['nonwoven', 'drape', 'gown', 'cap', 'mask', 'apron', 'cover'], 'pp_nonwoven', 'nonwoven'],
  [['steel', 'stainless', 'scalpel', 'forcep', 'scissor', 'clamp', 'instrument', 'needle', 'blade'], 'stainless_steel', 'metal_forming'],
  [['aluminium', 'aluminum'], 'aluminium', 'metal_forming'],
  [['glass', 'vial', 'ampoule'], 'glass', 'blow_molding'],
  [['paper', 'cardboard'], 'paper', 'converting'],
  [['monitor', 'thermometer', 'meter', 'sensor', 'electronic', 'pump', 'device'], 'abs', 'injection_molding'],
  [['polycarbonate'], 'polycarbonate', 'injection_molding'],
  [['polystyrene', 'petri', 'dish'], 'polystyrene', 'injection_molding'],
  [['pet', 'bottle'], 'pet', 'blow_molding'],
];

const DEFAULT_MASS_G = 10;

/**
 * Builds an editable starting point for a product that is not in the
 * library, guessing the main material from words in its name.
 */
function draftProduct(name) {
  const tokens = tokenize(name);
  let material = 'polypropylene';
  let process = 'injection_molding';
  let matchedHint = null;
  for (const [words, m, p] of MATERIAL_HINTS) {
    const hit = words.find((w) => tokens.some((t) => t === w || t.startsWith(w)));
    if (hit) {
      material = m;
      process = p;
      matchedHint = hit;
      break;
    }
  }
  const sterile = tokens.some((t) => ['sterile', 'surgical', 'implant', 'syringe', 'catheter', 'needle'].includes(t));
  return {
    id: null,
    name: String(name || 'Custom product').trim().slice(0, 200) || 'Custom product',
    category: 'Custom',
    functionalUnit: '1 unit',
    draft: true,
    draftNote: matchedHint
      ? `Not in the library. Main material guessed from "${matchedHint}"; please check the material and enter the real mass.`
      : 'Not in the library. Defaulted to polypropylene; please enter the real materials and masses.',
    components: [{ name: 'Main body', material, massG: DEFAULT_MASS_G, process }],
    packaging: [{ name: 'Packaging (share)', material: 'cardboard', massG: 2 }],
    country: 'china',
    sterilization: sterile ? 'ethylene_oxide' : 'none',
    transport: [
      { mode: 'road', km: 300 },
      { mode: 'sea', km: 12000 },
      { mode: 'road', km: 500 },
    ],
    use: { uses: 1, reprocessingKgPerUse: 0, energyKwhPerUse: 0, country: 'global' },
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  };
}

module.exports = { searchProducts, findProductById, draftProduct, normalize, tokenize, levenshtein };
