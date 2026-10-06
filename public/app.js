'use strict';

(() => {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    factors: null,
    product: null,
    result: null,
    quantity: 1,
    suggestions: [],
    activeIndex: -1,
    estimateSeq: 0,
  };

  const COMPARE_KEY = 'mcf-compare-v1';
  const THEME_KEY = 'mcf-theme';
  const MAX_COMPARE = 12;

  // ---------- helpers ----------

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'className') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function debounce(fn, ms) {
    let t;
    const debounced = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    debounced.cancel = () => clearTimeout(t);
    return debounced;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `Request failed (${res.status})`);
      err.details = body.details;
      throw err;
    }
    return body;
  }

  function sig(value, digits = 3) {
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1000) return Math.round(value).toLocaleString();
    return Number(value.toPrecision(digits)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  /** Formats kg CO2e with a sensible unit: g below 1 kg, t from 1000 kg. */
  function fmtCO2(kg) {
    const abs = Math.abs(kg);
    if (abs >= 1000) return { value: sig(kg / 1000), unit: 't CO₂e' };
    if (abs >= 1) return { value: sig(kg), unit: 'kg CO₂e' };
    return { value: sig(kg * 1000), unit: 'g CO₂e' };
  }
  const fmtText = (kg) => {
    const f = fmtCO2(kg);
    return `${f.value} ${f.unit}`;
  };
  const pct = (share) => `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`;

  function setStatus(message, isError = false) {
    const node = $('#status');
    node.textContent = message || '';
    node.classList.toggle('error', isError);
  }

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable: feature degrades to in-memory only */
      }
    },
  };

  // ---------- tooltip ----------

  const tooltip = $('#tooltip');
  function attachTooltip(node, textFn) {
    const show = (x, y) => {
      tooltip.textContent = textFn();
      tooltip.hidden = false;
      const rect = tooltip.getBoundingClientRect();
      const left = Math.min(Math.max(8, x + 12), window.innerWidth - rect.width - 8);
      const top = y - rect.height - 12 < 8 ? y + 16 : y - rect.height - 12;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    node.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
    node.addEventListener('mouseleave', () => { tooltip.hidden = true; });
    node.addEventListener('focus', () => {
      const r = node.getBoundingClientRect();
      show(r.left + r.width / 2, r.top);
    });
    node.addEventListener('blur', () => { tooltip.hidden = true; });
  }

  // ---------- search / autocomplete ----------

  const input = $('#product-input');
  const list = $('#suggestions');

  function closeSuggestions() {
    // Invalidate any lookup still in flight so it cannot re-open the list.
    state.suggestSeq = (state.suggestSeq || 0) + 1;
    fetchSuggestions.cancel();
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    state.activeIndex = -1;
  }

  function renderSuggestions() {
    list.replaceChildren();
    const query = input.value.trim();
    const items = state.suggestions.map((s) => ({ type: 'product', ...s }));
    if (query) items.push({ type: 'custom', name: query });
    if (!items.length) return closeSuggestions();

    items.forEach((item, i) => {
      const li = el('li', {
        id: `sugg-${i}`,
        role: 'option',
        'aria-selected': i === state.activeIndex ? 'true' : 'false',
        onmousedown: (e) => {
          e.preventDefault();
          chooseSuggestion(item);
        },
      }, item.type === 'product'
        ? [item.name, el('span', { className: 's-meta', text: `${item.category} · per ${item.functionalUnit}` })]
        : [`Define “${item.name}” as a custom product`, el('span', { className: 's-meta', text: 'Not listed? Build it from materials and masses' })]);
      list.append(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (state.activeIndex >= 0) input.setAttribute('aria-activedescendant', `sugg-${state.activeIndex}`);
    else input.removeAttribute('aria-activedescendant');
    state.renderedItems = items;
    return undefined;
  }

  const fetchSuggestions = debounce(async () => {
    const q = input.value.trim();
    if (!q) {
      state.suggestions = [];
      return closeSuggestions();
    }
    const seq = state.suggestSeq;
    try {
      const { results } = await api(`/api/products?q=${encodeURIComponent(q)}`);
      if (seq !== state.suggestSeq || input.value.trim() !== q) return undefined; // stale response
      state.suggestions = results;
      state.activeIndex = -1;
      renderSuggestions();
    } catch {
      /* typing should never surface network noise; submit reports errors */
    }
    return undefined;
  }, 150);

  input.addEventListener('input', fetchSuggestions);
  input.addEventListener('blur', () => setTimeout(closeSuggestions, 100));
  input.addEventListener('keydown', (e) => {
    const items = state.renderedItems || [];
    if (list.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      state.activeIndex = (state.activeIndex + delta + items.length) % items.length;
      renderSuggestions();
    } else if (e.key === 'Enter' && state.activeIndex >= 0) {
      e.preventDefault();
      chooseSuggestion(items[state.activeIndex]);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  function chooseSuggestion(item) {
    closeSuggestions();
    if (item.type === 'product') {
      input.value = item.name;
      loadProduct(item.id);
    } else {
      loadDraft(item.name);
    }
  }

  $('#search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    closeSuggestions();
    const q = input.value.trim();
    if (!q) {
      setStatus('Type the name of a medical product, e.g. “latex glove”.', true);
      input.focus();
      return;
    }
    try {
      const { results } = await api(`/api/products?q=${encodeURIComponent(q)}`);
      if (results.length && results[0].score >= 0.6) {
        await loadProduct(results[0].id, q);
      } else {
        await loadDraft(q);
      }
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  document.querySelectorAll('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.example;
      $('#search-form').requestSubmit();
    });
  });

  $('#quantity-input').addEventListener('input', (e) => {
    const q = Number(e.target.value);
    const valid = Number.isFinite(q) && q > 0;
    e.target.setAttribute('aria-invalid', valid ? 'false' : 'true');
    if (!valid) return;
    state.quantity = q;
    if (state.product) scheduleEstimate();
  });

  async function loadProduct(id, query) {
    const product = await api(`/api/products/${encodeURIComponent(id)}`);
    await setProduct(product);
    setStatus(query && query.toLowerCase() !== product.name.toLowerCase()
      ? `Matched “${query}” to “${product.name}”. Not right? Pick another from the suggestions or edit the details.`
      : `Loaded “${product.name}”.`);
  }

  async function loadDraft(name) {
    const product = await api('/api/draft', { method: 'POST', body: JSON.stringify({ name }) });
    await setProduct(product);
    setStatus(`“${name}” is not in the library — a draft was created. Fill in its materials and masses.`);
  }

  async function setProduct(product) {
    await factorsReady;
    if (!state.factors) return;
    state.product = structuredClone(product);
    $('#workspace').hidden = false;
    const note = $('#draft-note');
    note.hidden = !product.draftNote;
    note.textContent = product.draftNote || '';
    renderEditor();
    estimate();
  }

  // ---------- editor ----------

  function optionsFrom(table, selected, labelFn = (v) => v.name) {
    return Object.entries(table).map(([key, v]) =>
      el('option', { value: key, selected: key === selected }, labelFn(v)));
  }

  function setPath(path, value) {
    const keys = path.split('.');
    let obj = state.product;
    for (let i = 0; i < keys.length - 1; i += 1) {
      obj[keys[i]] = obj[keys[i]] ?? {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  let fieldSeq = 0;
  function field(labelText, path, value, { type = 'text', options, step, min, max } = {}) {
    const id = `f-${(fieldSeq += 1)}`;
    const control = options
      ? el('select', { id, 'data-path': path }, options)
      : el('input', { id, 'data-path': path, type, value: value ?? '', step, min, max, inputmode: type === 'number' ? 'decimal' : undefined });
    if (type === 'number') control.dataset.number = 'true';
    return el('div', { className: 'field' }, [el('label', { for: id, text: labelText }), control]);
  }

  function removeButton(listKey, index, label) {
    return el('button', {
      type: 'button',
      className: 'icon-btn',
      'aria-label': `Remove ${label}`,
      title: 'Remove',
      onclick: () => {
        state.product[listKey].splice(index, 1);
        renderEditor();
        estimate();
      },
    }, '×');
  }

  function addButton(text, onclick) {
    return el('button', { type: 'button', className: 'ghost small-btn add-btn', onclick }, text);
  }

  function renderEditor() {
    const f = state.factors;
    const p = state.product;
    p.packaging = p.packaging || [];
    p.transport = p.transport || [];
    p.use = { uses: 1, reprocessingKgPerUse: 0, energyKwhPerUse: 0, country: 'global', ...p.use };
    const materialLabel = (m) => `${m.name} (${m.factor} kg/kg)`;

    const components = p.components.map((c, i) =>
      el('div', { className: 'item-row component' }, [
        field('Part', `components.${i}.name`, c.name),
        field('Material', `components.${i}.material`, c.material, { options: optionsFrom(f.materials, c.material, materialLabel) }),
        field('Mass (g)', `components.${i}.massG`, c.massG, { type: 'number', step: 'any', min: 0 }),
        field('Process', `components.${i}.process`, c.process, { options: optionsFrom(f.processes, c.process) }),
        p.components.length > 1 ? removeButton('components', i, c.name || 'component') : el('span'),
      ]));

    const packaging = p.packaging.map((pk, i) =>
      el('div', { className: 'item-row pack' }, [
        field('Item', `packaging.${i}.name`, pk.name),
        field('Material', `packaging.${i}.material`, pk.material, { options: optionsFrom(f.materials, pk.material, materialLabel) }),
        field('Mass (g)', `packaging.${i}.massG`, pk.massG, { type: 'number', step: 'any', min: 0 }),
        removeButton('packaging', i, pk.name || 'packaging'),
      ]));

    const legs = p.transport.map((t, i) =>
      el('div', { className: 'item-row leg' }, [
        field('Mode', `transport.${i}.mode`, t.mode, { options: optionsFrom(f.transport, t.mode, (v) => `${v.name} (${v.factor} kg/t·km)`) }),
        field('Distance (km)', `transport.${i}.km`, t.km, { type: 'number', step: 'any', min: 0 }),
        removeButton('transport', i, 'transport leg'),
      ]));

    const form = $('#editor');
    form.replaceChildren(
      el('div', { className: 'grid-2' }, [
        field('Product name', 'name', p.name),
        field('Functional unit', 'functionalUnit', p.functionalUnit),
        field('Manufacturing country', 'country', p.country, { options: optionsFrom(f.grid, p.country, (v) => `${v.name} (${v.factor} kg/kWh)`) }),
        field('Sterilisation', 'sterilization', p.sterilization, { options: optionsFrom(f.sterilization, p.sterilization) }),
        field('Product end of life', 'endOfLife', p.endOfLife, { options: optionsFrom(f.endOfLife, p.endOfLife) }),
        field('Packaging end of life', 'packagingEndOfLife', p.packagingEndOfLife || p.endOfLife, { options: optionsFrom(f.endOfLife, p.packagingEndOfLife || p.endOfLife) }),
      ]),
      el('h3', { text: 'Materials (bill of materials)' }),
      el('div', { className: 'rows' }, [
        ...components,
        addButton('+ Add material', () => {
          p.components.push({ name: 'New part', material: 'polypropylene', massG: 1, process: 'injection_molding' });
          renderEditor();
          estimate();
        }),
      ]),
      el('h3', { text: 'Packaging per unit' }),
      el('div', { className: 'rows' }, [
        ...packaging,
        addButton('+ Add packaging', () => {
          p.packaging.push({ name: 'Packaging', material: 'cardboard', massG: 1 });
          renderEditor();
          estimate();
        }),
      ]),
      el('h3', { text: 'Transport to hospital' }),
      el('div', { className: 'rows' }, [
        ...legs,
        addButton('+ Add transport leg', () => {
          p.transport.push({ mode: 'road', km: 100 });
          renderEditor();
          estimate();
        }),
      ]),
      el('h3', { text: 'Use phase' }),
      el('div', { className: 'grid-2' }, [
        field('Number of uses (1 = single-use)', 'use.uses', p.use.uses, { type: 'number', step: 1, min: 1 }),
        field('Reprocessing per use (kg CO₂e)', 'use.reprocessingKgPerUse', p.use.reprocessingKgPerUse, { type: 'number', step: 'any', min: 0 }),
        field('Energy per use (kWh)', 'use.energyKwhPerUse', p.use.energyKwhPerUse, { type: 'number', step: 'any', min: 0 }),
        field('Country of use', 'use.country', p.use.country, { options: optionsFrom(f.grid, p.use.country) }),
      ]),
    );
  }

  $('#editor').addEventListener('input', (e) => {
    const target = e.target;
    const path = target.dataset.path;
    if (!path || !state.product) return;
    let value = target.value;
    if (target.dataset.number) {
      value = target.value === '' ? NaN : Number(target.value);
      const ok = Number.isFinite(value) && value >= 0;
      target.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) return;
    }
    setPath(path, value);
    scheduleEstimate();
  });

  // ---------- estimate & results ----------

  async function estimate() {
    if (!state.product) return;
    const seq = (state.estimateSeq += 1);
    try {
      const result = await api('/api/estimate', {
        method: 'POST',
        body: JSON.stringify({ product: state.product, quantity: state.quantity }),
      });
      if (seq !== state.estimateSeq) return; // a newer request superseded this one
      state.result = result;
      renderResults();
      if ($('#status').classList.contains('error')) setStatus('');
    } catch (err) {
      if (seq !== state.estimateSeq) return;
      setStatus(err.details ? `Please check: ${err.details.join('; ')}` : err.message, true);
    }
  }
  const scheduleEstimate = debounce(estimate, 250);

  function barChart(rows, { highlightTop = true, ariaLabel }) {
    const max = Math.max(...rows.map((r) => r.value), 0);
    const top = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0]);
    return el('div', { className: 'bars', role: 'list', 'aria-label': ariaLabel }, rows.map((r) => {
      const bar = el('div', { className: 'bar' });
      bar.style.width = max > 0 ? `${(r.value / max) * 100}%` : '0';
      const row = el('div', {
        className: `bar-row${highlightTop && r === top && r.value > 0 ? ' top' : ''}${r.className ? ` ${r.className}` : ''}`,
        role: 'listitem',
        tabindex: 0,
        'aria-label': `${r.label}: ${r.valueText}`,
      }, [
        el('span', { className: 'bar-label', text: r.label }),
        el('div', { className: 'bar-track' }, bar),
        el('span', { className: 'bar-value', text: r.valueText }),
      ]);
      attachTooltip(row, () => r.tooltip);
      return row;
    }));
  }

  function renderResults() {
    const r = state.result;
    const per = fmtCO2(r.perUseKgCO2e);
    const unitText = r.reusable ? `per use (${r.uses.toLocaleString()} uses per item)` : `per ${r.functionalUnit}`;
    const qtyLine = state.quantity !== 1
      ? `${state.quantity.toLocaleString()} ${r.reusable ? 'uses' : 'units'}: ${fmtText(r.quantityKgCO2e)} (range ${fmtText(r.uncertainty.low)} – ${fmtText(r.uncertainty.high)})`
      : `Range ${fmtText(r.uncertainty.low)} – ${fmtText(r.uncertainty.high)} (${r.uncertainty.note})`;
    const lifetime = r.reusable ? ` · whole item over its life: ${fmtText(r.lifetimeKgCO2e)}` : '';

    const stageRows = r.stages.map((s) => ({
      label: s.label,
      value: s.kgCO2e,
      valueText: fmtText(s.kgCO2e),
      tooltip: `${s.label}: ${fmtText(s.kgCO2e)} — ${pct(s.share)} of total`,
    }));

    const stageTable = el('div', { className: 'table-scroll', hidden: true }, el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Stage' }), el('th', { className: 'num', text: 'kg CO₂e' }), el('th', { className: 'num', text: 'Share' })])),
      el('tbody', {}, r.stages.map((s) => el('tr', {}, [
        el('td', { text: s.label }),
        el('td', { className: 'num', text: sig(s.kgCO2e, 4) }),
        el('td', { className: 'num', text: pct(s.share) }),
      ]))),
    ]));
    const chart = barChart(stageRows, { ariaLabel: 'Footprint by life-cycle stage' });
    const toggle = el('button', {
      type: 'button',
      className: 'ghost small-btn',
      'aria-pressed': 'false',
      onclick: () => {
        const showTable = stageTable.hidden;
        stageTable.hidden = !showTable;
        chart.hidden = showTable;
        toggle.textContent = showTable ? 'Show chart' : 'Show table';
        toggle.setAttribute('aria-pressed', String(showTable));
      },
    }, 'Show table');

    const componentTable = el('div', { className: 'table-scroll' }, el('table', {}, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Part' }), el('th', { text: 'Material' }), el('th', { className: 'num', text: 'Mass (g)' }),
        el('th', { className: 'num', text: 'Material + mfg + disposal' }),
      ])),
      el('tbody', {}, r.components.map((c) => el('tr', {}, [
        el('td', { text: c.name }),
        el('td', { text: c.materialName }),
        el('td', { className: 'num', text: sig(c.massG) }),
        el('td', { className: 'num', text: fmtText(c.kgCO2e.total) }),
      ]))),
    ]));

    $('#results').replaceChildren(
      el('div', { className: 'hero' }, [
        el('span', { className: 'hero-value', text: per.value }),
        el('span', { className: 'hero-unit', text: `${per.unit} ${unitText}` }),
        el('span', { className: 'hero-sub', text: `${r.name}. ${qtyLine}${lifetime}` }),
        el('span', { className: 'hero-sub', text: `Biggest contributor: ${r.hotspot.label} (${pct(r.hotspot.share)}). Product mass ${sig(r.massG.product)} g + packaging ${sig(r.massG.packaging)} g.` }),
      ]),
      el('div', { className: 'equivalents', 'aria-label': `Equivalent to, for ${state.quantity.toLocaleString()} unit(s)` },
        r.equivalents.map((e) => el('div', { className: 'tile' }, [
          el('div', { className: 'tile-value', text: sig(e.value) }),
          el('div', { className: 'tile-label', text: e.label }),
        ]))),
      el('div', { className: 'chart-head' }, [el('h3', { text: 'By life-cycle stage' }), toggle]),
      chart,
      stageTable,
      el('h3', { text: 'Hotspots by part' }),
      componentTable,
      el('h3', { text: 'How to reduce it' }),
      el('ul', { className: 'tips' }, r.recommendations.map((t) => el('li', { text: t }))),
      el('div', { className: 'actions' }, [
        el('button', { type: 'button', className: 'primary', onclick: addToCompare }, 'Add to comparison'),
        el('button', { type: 'button', className: 'ghost', onclick: downloadCsv }, 'Download CSV'),
        el('button', { type: 'button', className: 'ghost', onclick: downloadJson }, 'Download JSON'),
      ]),
    );
  }

  // ---------- comparison ----------

  let compareItems = storage.get(COMPARE_KEY, []);
  if (!Array.isArray(compareItems)) compareItems = [];

  function addToCompare() {
    const r = state.result;
    if (!r) return;
    compareItems = compareItems.filter((c) => c.name !== r.name);
    compareItems.push({
      name: r.name,
      unit: r.reusable ? 'per use' : `per ${r.functionalUnit}`,
      perUseKgCO2e: r.perUseKgCO2e,
    });
    compareItems = compareItems.slice(-MAX_COMPARE);
    storage.set(COMPARE_KEY, compareItems);
    renderCompare();
    setStatus(`Added “${r.name}” to the comparison.`);
  }

  function renderCompare() {
    const section = $('#compare');
    section.hidden = compareItems.length === 0;
    if (!compareItems.length) return;
    const sorted = [...compareItems].sort((a, b) => b.perUseKgCO2e - a.perUseKgCO2e);
    const chart = barChart(sorted.map((c) => ({
      label: `${c.name} (${c.unit})`,
      value: c.perUseKgCO2e,
      valueText: fmtText(c.perUseKgCO2e),
      tooltip: `${c.name}: ${fmtText(c.perUseKgCO2e)} ${c.unit}`,
      className: 'compare-row',
    })), { highlightTop: false, ariaLabel: 'Saved products compared' });
    const removeList = el('div', { className: 'examples' }, sorted.map((c) =>
      el('button', {
        type: 'button',
        className: 'chip',
        'aria-label': `Remove ${c.name} from comparison`,
        onclick: () => {
          compareItems = compareItems.filter((x) => x.name !== c.name);
          storage.set(COMPARE_KEY, compareItems);
          renderCompare();
        },
      }, `× ${c.name}`)));
    $('#compare-chart').replaceChildren(chart, removeList);
  }

  $('#compare-clear').addEventListener('click', () => {
    compareItems = [];
    storage.set(COMPARE_KEY, compareItems);
    renderCompare();
  });

  // ---------- export ----------

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  const csvCell = (v) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function downloadCsv() {
    const r = state.result;
    const rows = [
      ['Product', r.name],
      ['Functional unit', r.reusable ? `1 use of ${r.uses}` : r.functionalUnit],
      ['Footprint per unit/use (kg CO2e)', r.perUseKgCO2e],
      ['Quantity', r.quantity],
      ['Footprint for quantity (kg CO2e)', r.quantityKgCO2e],
      [],
      ['Stage', 'kg CO2e per unit/use', 'Share'],
      ...r.stages.map((s) => [s.label, s.kgCO2e, s.share]),
      [],
      ['Part', 'Material', 'Mass (g)', 'Material kg CO2e', 'Manufacturing kg CO2e', 'End of life kg CO2e'],
      ...r.components.map((c) => [c.name, c.materialName, c.massG, c.kgCO2e.material, c.kgCO2e.manufacturing, c.kgCO2e.endOfLife]),
    ];
    download(`${slug(r.name)}-carbon-footprint.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv');
  }

  function downloadJson() {
    const payload = { product: state.product, quantity: state.quantity, result: state.result };
    download(`${slug(state.result.name)}-carbon-footprint.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  // ---------- theme ----------

  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
  }
  applyTheme(storage.get(THEME_KEY, null));
  $('#theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storage.set(THEME_KEY, next);
  });

  // ---------- boot ----------

  const factorsReady = api('/api/factors')
    .then((factors) => { state.factors = factors; })
    .catch((err) => setStatus(`Could not load emission factors: ${err.message}`, true));
  renderCompare();
  input.focus();
})();
