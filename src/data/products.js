'use strict';

/**
 * Library of reference medical products.
 *
 * Every product is described per *functional unit* (e.g. "1 glove") with:
 *   components    product materials: { name, material, massG, process }
 *   packaging     packaging share allocated to one unit: { name, material, massG }
 *   country       manufacturing country (key of GRID)
 *   sterilization key of STERILIZATION
 *   transport     freight legs from factory to hospital: { mode, km }
 *   use           { uses, reprocessingKgPerUse, energyKwhPerUse, country }
 *                 uses > 1 marks a reusable product; its production impacts
 *                 are amortised over that many uses.
 *   endOfLife     waste route for the product (key of END_OF_LIFE)
 *   packagingEndOfLife waste route for packaging
 *
 * Masses are typical published/catalogue values; treat them as defaults the
 * user is expected to refine.
 */

const SINGLE_USE = { uses: 1, reprocessingKgPerUse: 0, energyKwhPerUse: 0, country: 'global' };

const ASIA_TO_HOSPITAL = [
  { mode: 'road', km: 300 },
  { mode: 'sea', km: 12000 },
  { mode: 'road', km: 500 },
];

const PRODUCTS = [
  {
    id: 'latex-exam-glove',
    name: 'Latex examination glove (non-sterile)',
    aliases: ['latex glove', 'latex gloves', 'exam glove', 'examination glove', 'medical glove', 'rubber glove'],
    category: 'Gloves',
    functionalUnit: '1 glove',
    components: [
      { name: 'Glove film', material: 'natural_rubber_latex', massG: 5.5, process: 'dipping' },
    ],
    packaging: [
      { name: 'Dispenser box + shipping carton (share)', material: 'cardboard', massG: 1.0 },
    ],
    country: 'malaysia',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'latex-surgical-glove',
    name: 'Sterile latex surgical gloves (pair)',
    aliases: ['surgical glove', 'surgical gloves', 'sterile glove', 'sterile latex glove'],
    category: 'Gloves',
    functionalUnit: '1 pair',
    components: [
      { name: 'Glove films (x2)', material: 'natural_rubber_latex', massG: 20, process: 'dipping' },
    ],
    packaging: [
      { name: 'Inner paper wrap', material: 'paper', massG: 6 },
      { name: 'Peel pouch film', material: 'ldpe', massG: 3 },
      { name: 'Carton (share)', material: 'cardboard', massG: 4 },
    ],
    country: 'malaysia',
    sterilization: 'gamma',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'nitrile-exam-glove',
    name: 'Nitrile examination glove (non-sterile)',
    aliases: ['nitrile glove', 'nitrile gloves', 'blue glove'],
    category: 'Gloves',
    functionalUnit: '1 glove',
    components: [
      { name: 'Glove film', material: 'nitrile_rubber', massG: 3.5, process: 'dipping' },
    ],
    packaging: [
      { name: 'Dispenser box + shipping carton (share)', material: 'cardboard', massG: 0.8 },
    ],
    country: 'malaysia',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'vinyl-exam-glove',
    name: 'Vinyl (PVC) examination glove',
    aliases: ['vinyl glove', 'vinyl gloves', 'pvc glove'],
    category: 'Gloves',
    functionalUnit: '1 glove',
    components: [
      { name: 'Glove film', material: 'pvc', massG: 5.0, process: 'dipping' },
    ],
    packaging: [
      { name: 'Dispenser box + shipping carton (share)', material: 'cardboard', massG: 0.9 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'surgical-mask',
    name: 'Surgical face mask (type IIR, 3-ply)',
    aliases: ['face mask', 'mask', 'surgical mask', 'medical mask', 'procedure mask'],
    category: 'Respiratory protection',
    functionalUnit: '1 mask',
    components: [
      { name: '3-ply SMS body', material: 'pp_nonwoven', massG: 2.5, process: 'nonwoven' },
      { name: 'Nose wire', material: 'steel', massG: 0.3, process: 'metal_forming' },
      { name: 'Ear loops', material: 'polyurethane', massG: 0.5, process: 'extrusion' },
    ],
    packaging: [
      { name: 'Box (share)', material: 'cardboard', massG: 0.8 },
      { name: 'Bag (share)', material: 'ldpe', massG: 0.2 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'ffp2-respirator',
    name: 'FFP2 / N95 respirator',
    aliases: ['n95', 'ffp2', 'ffp3', 'respirator', 'kn95'],
    category: 'Respiratory protection',
    functionalUnit: '1 respirator',
    components: [
      { name: 'Filter layers', material: 'pp_nonwoven', massG: 8, process: 'nonwoven' },
      { name: 'Head straps', material: 'polyurethane', massG: 1.0, process: 'extrusion' },
      { name: 'Nose clip', material: 'aluminium', massG: 0.5, process: 'metal_forming' },
    ],
    packaging: [
      { name: 'Individual pouch', material: 'ldpe', massG: 1.0 },
      { name: 'Box (share)', material: 'cardboard', massG: 2.0 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'syringe-5ml',
    name: 'Disposable syringe 5 mL (without needle)',
    aliases: ['syringe', 'syringes', 'disposable syringe', 'luer syringe'],
    category: 'Injection & infusion',
    functionalUnit: '1 syringe',
    components: [
      { name: 'Barrel', material: 'polypropylene', massG: 3.2, process: 'injection_molding' },
      { name: 'Plunger', material: 'polypropylene', massG: 1.4, process: 'injection_molding' },
      { name: 'Plunger seal', material: 'synthetic_rubber', massG: 0.3, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Blister paper', material: 'paper', massG: 1.0 },
      { name: 'Blister film', material: 'ldpe', massG: 1.0 },
      { name: 'Carton (share)', material: 'cardboard', massG: 1.5 },
    ],
    country: 'china',
    sterilization: 'ethylene_oxide',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'incineration',
  },
  {
    id: 'hypodermic-needle',
    name: 'Hypodermic needle 21G',
    aliases: ['needle', 'needles', 'injection needle', 'hypodermic'],
    category: 'Injection & infusion',
    functionalUnit: '1 needle',
    components: [
      { name: 'Cannula', material: 'stainless_steel', massG: 0.15, process: 'metal_forming' },
      { name: 'Hub', material: 'polypropylene', massG: 0.5, process: 'injection_molding' },
      { name: 'Protective cap', material: 'hdpe', massG: 0.4, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Blister paper', material: 'paper', massG: 0.5 },
      { name: 'Blister film', material: 'ldpe', massG: 0.3 },
    ],
    country: 'china',
    sterilization: 'ethylene_oxide',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'incineration',
  },
  {
    id: 'iv-cannula',
    name: 'Peripheral IV cannula',
    aliases: ['cannula', 'iv cannula', 'venflon', 'catheter iv', 'peripheral catheter'],
    category: 'Injection & infusion',
    functionalUnit: '1 cannula',
    components: [
      { name: 'Catheter tube', material: 'polyurethane', massG: 0.2, process: 'extrusion' },
      { name: 'Hub & wings', material: 'polypropylene', massG: 2.5, process: 'injection_molding' },
      { name: 'Introducer needle', material: 'stainless_steel', massG: 0.3, process: 'metal_forming' },
      { name: 'Needle cap', material: 'hdpe', massG: 0.8, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Peel pouch paper', material: 'paper', massG: 1.0 },
      { name: 'Peel pouch film', material: 'ldpe', massG: 1.0 },
    ],
    country: 'malaysia',
    sterilization: 'ethylene_oxide',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'incineration',
  },
  {
    id: 'iv-bag-1l',
    name: 'IV fluid bag 1 L (empty container)',
    aliases: ['iv bag', 'infusion bag', 'saline bag', 'drip bag'],
    category: 'Injection & infusion',
    functionalUnit: '1 bag (container only, excludes the fluid)',
    components: [
      { name: 'Bag film and ports', material: 'pvc', massG: 50, process: 'extrusion' },
    ],
    packaging: [
      { name: 'Overwrap', material: 'ldpe', massG: 8 },
      { name: 'Carton (share)', material: 'cardboard', massG: 15 },
    ],
    country: 'global',
    sterilization: 'steam',
    transport: [{ mode: 'road', km: 1000 }],
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'iv-administration-set',
    name: 'IV administration (giving) set',
    aliases: ['iv set', 'giving set', 'infusion set', 'iv line', 'drip set'],
    category: 'Injection & infusion',
    functionalUnit: '1 set',
    components: [
      { name: 'Tubing', material: 'pvc', massG: 20, process: 'extrusion' },
      { name: 'Drip chamber & spike', material: 'polypropylene', massG: 4, process: 'injection_molding' },
      { name: 'Roller clamp & connector', material: 'abs', massG: 3, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Peel pouch paper', material: 'paper', massG: 3 },
      { name: 'Peel pouch film', material: 'ldpe', massG: 3 },
      { name: 'Carton (share)', material: 'cardboard', massG: 5 },
    ],
    country: 'mexico',
    sterilization: 'ethylene_oxide',
    transport: [{ mode: 'road', km: 2500 }],
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'incineration',
  },
  {
    id: 'foley-catheter',
    name: 'Foley urinary catheter (silicone)',
    aliases: ['foley', 'urinary catheter', 'catheter', 'silicone catheter'],
    category: 'Catheters & tubes',
    functionalUnit: '1 catheter',
    components: [
      { name: 'Catheter shaft & balloon', material: 'silicone', massG: 12, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Peel pouch paper', material: 'paper', massG: 5 },
      { name: 'Peel pouch film', material: 'ldpe', massG: 5 },
    ],
    country: 'malaysia',
    sterilization: 'ethylene_oxide',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'incineration',
  },
  {
    id: 'single-use-surgical-gown',
    name: 'Single-use surgical gown (SMS polypropylene)',
    aliases: ['gown', 'surgical gown', 'disposable gown', 'isolation gown'],
    category: 'Apparel & drapes',
    functionalUnit: '1 gown',
    components: [
      { name: 'Gown body', material: 'pp_nonwoven', massG: 150, process: 'nonwoven' },
    ],
    packaging: [
      { name: 'Wrap', material: 'paper', massG: 20 },
      { name: 'Pouch', material: 'ldpe', massG: 15 },
      { name: 'Carton (share)', material: 'cardboard', massG: 20 },
    ],
    country: 'china',
    sterilization: 'ethylene_oxide',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'incineration',
  },
  {
    id: 'reusable-surgical-gown',
    name: 'Reusable surgical gown (polyester, 75 cycles)',
    aliases: ['reusable gown', 'washable gown', 'textile gown'],
    category: 'Apparel & drapes',
    functionalUnit: '1 use',
    components: [
      { name: 'Gown body', material: 'polyester_textile', massG: 350, process: 'textile' },
    ],
    packaging: [
      { name: 'Delivery bag (share)', material: 'ldpe', massG: 10 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: { uses: 75, reprocessingKgPerUse: 0.25, energyKwhPerUse: 0, country: 'global' },
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'cotton-gauze-swab',
    name: 'Cotton gauze swab 10 x 10 cm',
    aliases: ['gauze', 'swab', 'gauze swab', 'gauze pad', 'sponge'],
    category: 'Wound care',
    functionalUnit: '1 swab',
    components: [
      { name: 'Woven gauze', material: 'cotton', massG: 1.0, process: 'textile' },
    ],
    packaging: [
      { name: 'Paper wrap (share)', material: 'paper', massG: 0.3 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'specimen-container',
    name: 'Specimen container 60 mL (sterile)',
    aliases: ['specimen cup', 'urine cup', 'sample container', 'specimen jar'],
    category: 'Laboratory',
    functionalUnit: '1 container',
    components: [
      { name: 'Pot', material: 'polypropylene', massG: 8, process: 'injection_molding' },
      { name: 'Screw lid', material: 'hdpe', massG: 3, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Bag (share)', material: 'ldpe', massG: 0.5 },
    ],
    country: 'global',
    sterilization: 'gamma',
    transport: [{ mode: 'road', km: 1500 }],
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'blood-collection-tube',
    name: 'Vacuum blood collection tube (PET)',
    aliases: ['blood tube', 'vacutainer', 'collection tube', 'test tube'],
    category: 'Laboratory',
    functionalUnit: '1 tube',
    components: [
      { name: 'Tube', material: 'pet', massG: 4, process: 'injection_molding' },
      { name: 'Stopper', material: 'synthetic_rubber', massG: 1, process: 'injection_molding' },
      { name: 'Cap', material: 'hdpe', massG: 1.5, process: 'injection_molding' },
      { name: 'Label', material: 'paper', massG: 0.1, process: 'converting' },
    ],
    packaging: [
      { name: 'Tray (share)', material: 'polystyrene', massG: 0.5 },
    ],
    country: 'usa',
    sterilization: 'gamma',
    transport: [{ mode: 'road', km: 800 }, { mode: 'sea', km: 9000 }, { mode: 'road', km: 300 }],
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'face-shield',
    name: 'Disposable face shield',
    aliases: ['visor', 'face shield', 'faceshield'],
    category: 'Respiratory protection',
    functionalUnit: '1 shield',
    components: [
      { name: 'Visor', material: 'pet', massG: 30, process: 'extrusion' },
      { name: 'Foam headband', material: 'polyurethane', massG: 2, process: 'extrusion' },
      { name: 'Elastic band', material: 'polyurethane', massG: 2, process: 'extrusion' },
    ],
    packaging: [
      { name: 'Box (share)', material: 'cardboard', massG: 5 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: SINGLE_USE,
    endOfLife: 'incineration',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'reusable-surgical-scissors',
    name: 'Reusable stainless steel surgical scissors (500 cycles)',
    aliases: ['scissors', 'surgical scissors', 'mayo scissors', 'surgical instrument'],
    category: 'Surgical instruments',
    functionalUnit: '1 use',
    components: [
      { name: 'Scissors', material: 'stainless_steel', massG: 60, process: 'metal_forming' },
    ],
    packaging: [
      { name: 'Pouch', material: 'ldpe', massG: 5 },
    ],
    country: 'germany',
    sterilization: 'none',
    transport: [{ mode: 'road', km: 3000 }],
    use: { uses: 500, reprocessingKgPerUse: 0.05, energyKwhPerUse: 0, country: 'global' },
    endOfLife: 'recycling',
    packagingEndOfLife: 'recycling',
  },
  {
    id: 'pulse-oximeter',
    name: 'Fingertip pulse oximeter (reusable)',
    aliases: ['oximeter', 'pulse ox', 'spo2 meter', 'saturation monitor'],
    category: 'Electronic devices',
    functionalUnit: '1 use',
    components: [
      { name: 'Housing', material: 'abs', massG: 25, process: 'injection_molding' },
      { name: 'Electronics & display', material: 'electronics', massG: 8, process: 'electronics_assembly' },
      { name: 'Finger pad', material: 'silicone', massG: 2, process: 'injection_molding' },
    ],
    packaging: [
      { name: 'Box', material: 'cardboard', massG: 40 },
      { name: 'Bag', material: 'ldpe', massG: 5 },
    ],
    country: 'china',
    sterilization: 'none',
    transport: ASIA_TO_HOSPITAL,
    use: { uses: 2000, reprocessingKgPerUse: 0.002, energyKwhPerUse: 0.0005, country: 'global' },
    endOfLife: 'recycling',
    packagingEndOfLife: 'recycling',
  },
];

module.exports = { PRODUCTS };
