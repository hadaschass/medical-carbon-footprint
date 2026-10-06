#!/usr/bin/env node
'use strict';

/**
 * Builds a single self-contained HTML file that runs the whole calculator in
 * the browser, with no server: the engine modules are bundled inline and the
 * UI's API calls are answered in-page by src/routes.js.
 *
 *   node scripts/build-static.js                  -> docs/index.html (GitHub Pages)
 *   node scripts/build-static.js --fragment FILE  -> page body only, for hosts that
 *                                                    supply their own <html>/<head>
 *                                                    and block downloads
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MODULES = [
  'src/data/factors.js',
  'src/data/products.js',
  'src/engine/calculator.js',
  'src/engine/search.js',
  'src/routes.js',
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Inline <script>/<style> must not contain their own closing tag.
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
const safeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

function bundleEngine() {
  const defs = MODULES.map((rel) =>
    `${JSON.stringify(rel)}: function (module, exports, require) {\n${read(rel)}\n}`).join(',\n');
  return `(function () {
  'use strict';
  var defs = {
${defs}
  };
  var cache = {};
  function resolve(from, spec) {
    var parts = from.split('/').slice(0, -1);
    spec.split('/').forEach(function (p) {
      if (p === '..') parts.pop();
      else if (p !== '.') parts.push(p);
    });
    var id = parts.join('/');
    return /\\.js$/.test(id) ? id : id + '.js';
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    if (!defs[id]) throw new Error('Module not bundled: ' + id);
    var module = { exports: {} };
    cache[id] = module;
    defs[id](module, module.exports, function (spec) { return load(resolve(id, spec)); });
    return module.exports;
  }
  var routes = load('src/routes.js');
  window.MCF_LOCAL_API = function (url, options) {
    options = options || {};
    var u = new URL(url, 'http://local');
    var body = options.body ? JSON.parse(options.body) : {};
    return routes.route(options.method || 'GET', u.pathname, u.searchParams, function () {
      return Promise.resolve(body);
    }).then(function (res) {
      // Hand the UI a copy so edits never touch the bundled library.
      return { status: res.status, body: JSON.parse(JSON.stringify(res.body)) };
    });
  };
})();`;
}

function build({ fragment }) {
  const html = read('public/index.html');
  const css = read('public/styles.css');
  const app = read('public/app.js');
  const favicon = `data:image/svg+xml;base64,${Buffer.from(read('public/favicon.svg')).toString('base64')}`;
  const settings = fragment ? "window.MCF_EXPORT = 'copy';\n" : '';
  const scripts = `<script>\n${safeScript(settings + bundleEngine())}\n</script>\n<script>\n${safeScript(app)}\n</script>`;

  const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const description = html.match(/<meta name="description"[^>]*>/)[0];
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace('<script src="app.js"></script>', () => scripts);
  const style = `<style>\n${safeStyle(css)}\n</style>`;

  if (fragment) return `${title}\n${description}\n${style}\n${body.trim()}\n`;

  return html
    .replace('<link rel="stylesheet" href="styles.css">', () => style)
    .replace('href="favicon.svg"', () => `href="${favicon}"`)
    .replace('<script src="app.js"></script>', () => scripts);
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--fragment');
  const fragment = i !== -1;
  const out = fragment ? path.resolve(args[i + 1] || 'carbon-footprint.html') : path.join(ROOT, 'docs', 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, build({ fragment }));
  console.log(`Wrote ${path.relative(process.cwd(), out) || out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
}

if (require.main === module) main();

module.exports = { build };
