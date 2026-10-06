'use strict';

/**
 * Emission factor library.
 *
 * All values are indicative screening factors in kg CO2-equivalent (GWP100),
 * compiled from public secondary sources (ICE database v3, PlasticsEurope
 * eco-profiles, UK DEFRA/DESNZ conversion factors, IEA grid intensities and
 * published LCAs of single-use medical devices). They are suitable for
 * hotspot analysis and comparing options, not for regulatory claims or
 * EPDs — replace them with supplier-specific data where available.
 */

// Cradle-to-gate production of the raw material, kg CO2e per kg.
// `eol` gives end-of-life emissions per kg of discarded material for each
// waste route. Biogenic carbon (natural rubber, cotton, paper) is treated as
// climate-neutral on combustion, following the GHG Protocol convention.
const MATERIALS = {
  natural_rubber_latex: {
    name: 'Natural rubber latex (compounded)',
    factor: 2.4,
    eol: { incineration: 0.15, landfill: 0.4, recycling: 0.2 },
  },
  nitrile_rubber: {
    name: 'Nitrile butadiene rubber (NBR)',
    factor: 3.7,
    eol: { incineration: 2.6, landfill: 0.03, recycling: 0.2 },
  },
  pvc: {
    name: 'PVC (plasticised, medical grade)',
    factor: 2.6,
    eol: { incineration: 1.6, landfill: 0.03, recycling: 0.2 },
  },
  polypropylene: {
    name: 'Polypropylene (PP)',
    factor: 1.95,
    eol: { incineration: 3.1, landfill: 0.03, recycling: 0.2 },
  },
  pp_nonwoven: {
    name: 'Polypropylene nonwoven (spunbond/meltblown)',
    factor: 2.2,
    eol: { incineration: 3.1, landfill: 0.03, recycling: 0.2 },
  },
  hdpe: {
    name: 'High-density polyethylene (HDPE)',
    factor: 1.9,
    eol: { incineration: 3.1, landfill: 0.03, recycling: 0.2 },
  },
  ldpe: {
    name: 'Low-density polyethylene (LDPE film)',
    factor: 2.1,
    eol: { incineration: 3.1, landfill: 0.03, recycling: 0.2 },
  },
  pet: {
    name: 'Polyethylene terephthalate (PET)',
    factor: 2.7,
    eol: { incineration: 2.3, landfill: 0.03, recycling: 0.2 },
  },
  polystyrene: {
    name: 'Polystyrene (PS)',
    factor: 3.4,
    eol: { incineration: 3.3, landfill: 0.03, recycling: 0.2 },
  },
  polycarbonate: {
    name: 'Polycarbonate (PC)',
    factor: 6.0,
    eol: { incineration: 2.8, landfill: 0.03, recycling: 0.2 },
  },
  abs: {
    name: 'ABS',
    factor: 3.8,
    eol: { incineration: 3.1, landfill: 0.03, recycling: 0.2 },
  },
  synthetic_rubber: {
    name: 'Synthetic polyisoprene / butyl rubber',
    factor: 3.5,
    eol: { incineration: 3.0, landfill: 0.03, recycling: 0.2 },
  },
  polyester_textile: {
    name: 'Polyester fibre (PET textile)',
    factor: 3.4,
    eol: { incineration: 2.3, landfill: 0.03, recycling: 0.2 },
  },
  silicone: {
    name: 'Silicone rubber',
    factor: 5.5,
    eol: { incineration: 1.0, landfill: 0.03, recycling: 0.2 },
  },
  polyurethane: {
    name: 'Polyurethane / elastane',
    factor: 4.3,
    eol: { incineration: 2.4, landfill: 0.03, recycling: 0.2 },
  },
  stainless_steel: {
    name: 'Stainless steel',
    factor: 6.15,
    eol: { incineration: 0.02, landfill: 0.01, recycling: 0.05 },
  },
  steel: {
    name: 'Steel (low alloy / wire)',
    factor: 2.0,
    eol: { incineration: 0.02, landfill: 0.01, recycling: 0.05 },
  },
  aluminium: {
    name: 'Aluminium (global mix)',
    factor: 8.6,
    eol: { incineration: 0.02, landfill: 0.01, recycling: 0.05 },
  },
  glass: {
    name: 'Glass (borosilicate / soda-lime)',
    factor: 1.4,
    eol: { incineration: 0.02, landfill: 0.01, recycling: 0.05 },
  },
  cotton: {
    name: 'Cotton (bleached woven/gauze)',
    factor: 5.9,
    eol: { incineration: 0.05, landfill: 0.8, recycling: 0.2 },
  },
  paper: {
    name: 'Medical-grade paper',
    factor: 1.1,
    eol: { incineration: 0.05, landfill: 0.9, recycling: 0.1 },
  },
  cardboard: {
    name: 'Corrugated cardboard',
    factor: 0.9,
    eol: { incineration: 0.05, landfill: 0.9, recycling: 0.1 },
  },
  electronics: {
    name: 'Electronics (PCB assembly, components)',
    factor: 60,
    eol: { incineration: 0.5, landfill: 0.05, recycling: 0.3 },
  },
  lithium_battery: {
    name: 'Lithium-ion battery cell',
    factor: 12,
    eol: { incineration: 0.5, landfill: 0.05, recycling: 0.3 },
  },
};

// Conversion energy, kWh of electricity-equivalent per kg of processed
// material. Multiplied by the manufacturing country's grid factor.
const PROCESSES = {
  dipping: { name: 'Latex/nitrile dipping, curing & drying', kwhPerKg: 6.0 },
  injection_molding: { name: 'Injection moulding', kwhPerKg: 3.0 },
  extrusion: { name: 'Extrusion / film blowing', kwhPerKg: 1.5 },
  blow_molding: { name: 'Blow moulding', kwhPerKg: 2.5 },
  nonwoven: { name: 'Nonwoven forming & converting', kwhPerKg: 2.5 },
  textile: { name: 'Spinning, weaving & finishing', kwhPerKg: 12.0 },
  metal_forming: { name: 'Metal forming & machining', kwhPerKg: 5.0 },
  electronics_assembly: { name: 'Electronics assembly', kwhPerKg: 20.0 },
  converting: { name: 'Cutting, folding & converting', kwhPerKg: 0.8 },
  assembly: { name: 'Final assembly only', kwhPerKg: 0.3 },
};

// Electricity grid intensity, kg CO2e per kWh (approx. 2023 averages).
const GRID = {
  global: { name: 'Global average', factor: 0.48 },
  china: { name: 'China', factor: 0.58 },
  malaysia: { name: 'Malaysia', factor: 0.58 },
  thailand: { name: 'Thailand', factor: 0.5 },
  vietnam: { name: 'Vietnam', factor: 0.47 },
  india: { name: 'India', factor: 0.71 },
  indonesia: { name: 'Indonesia', factor: 0.68 },
  israel: { name: 'Israel', factor: 0.53 },
  usa: { name: 'United States', factor: 0.37 },
  mexico: { name: 'Mexico', factor: 0.42 },
  germany: { name: 'Germany', factor: 0.38 },
  uk: { name: 'United Kingdom', factor: 0.21 },
  france: { name: 'France', factor: 0.06 },
  ireland: { name: 'Ireland', factor: 0.33 },
};

// Sterilisation, kg CO2e per kg of sterilised product (incl. packaging load).
const STERILIZATION = {
  none: { name: 'Not sterile', factor: 0 },
  ethylene_oxide: { name: 'Ethylene oxide (EtO)', factor: 0.6 },
  gamma: { name: 'Gamma irradiation', factor: 0.15 },
  ebeam: { name: 'Electron beam', factor: 0.1 },
  steam: { name: 'Steam autoclave (industrial)', factor: 0.3 },
};

// Freight, kg CO2e per tonne-km (well-to-wheel).
const TRANSPORT = {
  sea: { name: 'Container ship', factor: 0.016 },
  road: { name: 'Truck (HGV, average laden)', factor: 0.107 },
  rail: { name: 'Rail freight', factor: 0.028 },
  air: { name: 'Air freight (long haul)', factor: 0.6 },
};

const END_OF_LIFE = {
  incineration: { name: 'Clinical waste incineration' },
  landfill: { name: 'Landfill' },
  recycling: { name: 'Recycling (collection & processing)' },
};

// Handy everyday equivalents for communicating results.
const EQUIVALENTS = {
  carKm: { label: 'km driven in an average petrol car', factor: 0.17 },
  phoneCharges: { label: 'smartphone full charges', factor: 0.0082 },
  kettleBoils: { label: 'kettle boils (1 L)', factor: 0.025 },
};

module.exports = {
  MATERIALS,
  PROCESSES,
  GRID,
  STERILIZATION,
  TRANSPORT,
  END_OF_LIFE,
  EQUIVALENTS,
};
