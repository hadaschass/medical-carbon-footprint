# Medical Product Carbon Footprint Calculator

An interactive web app that estimates the **cradle-to-grave carbon footprint
(kg CO₂e)** of a medical product. Type a product name such as
**"latex glove"** and the app finds it in its product library, even with typos
like "latx glove". It shows the footprint per unit and for the quantity you
enter, splits it by life-cycle stage and by part, and suggests how to reduce it.

## Quick start

```bash
git clone https://github.com/hadaschass/medical-carbon-footprint.git
cd medical-carbon-footprint
npm start          # http://localhost:3000  (PORT=8080 npm start to change)
npm test           # unit, API and static-build tests (node:test)
```

Requires Node.js ≥ 18. No third-party dependencies.

### Static version (no server)

`npm run build` writes `docs/index.html`: one self-contained file with the
calculation engine bundled in. It runs entirely in the browser, so you can
open it straight from disk or host it on any static host. To publish it on
GitHub Pages, go to **Settings → Pages**, choose *Deploy from a branch*, and
pick `main` and the `/docs` folder. Re-run `npm run build` after changing
anything in `src/` or `public/`; a test fails if the bundle breaks.

`node scripts/build-static.js --fragment out.html` writes the page body only.
Use it for hosts that supply their own `<html>`/`<head>` and block file
downloads. In that version the export buttons copy CSV/JSON to the clipboard
instead of downloading a file.

## Features

- **Product search with autocomplete**: typo-tolerant matching against 20
  reference products: gloves (latex, nitrile, vinyl, sterile surgical),
  masks/respirators, syringes, needles, cannulas, IV bags and sets, catheters,
  single-use vs reusable gowns, gauze, lab consumables, scissors, and a pulse
  oximeter.
- **Unknown products**: if a name is not in the library, the app drafts a bill
  of materials. It guesses the main material from the name (e.g. "silicone …",
  "cotton …"), and you then refine it.
- **Fully editable model**: materials and masses, manufacturing process and
  country (grid intensity), sterilisation method, packaging, transport legs,
  number of uses, reprocessing, energy in use, and end-of-life route.
  Results recalculate live.
- **Results**: total per functional unit with a ±30 % range, everyday
  equivalents, a life-cycle-stage bar chart (with a table view), per-part
  hotspots, and tailored reduction tips.
- **Comparison**: save several products to a side-by-side chart, saved in the browser.
- **Export**: download the result as CSV or JSON.
- Light/dark theme, responsive down to phone width, keyboard-accessible combobox.

## Method

Per functional unit (per use for reusable items):

| Stage | Calculation |
|---|---|
| Raw materials | Σ part mass × material factor (kg CO₂e/kg) |
| Manufacturing | Σ part mass × process energy (kWh/kg) × grid factor of the manufacturing country |
| Packaging | Σ packaging mass × material factor |
| Sterilisation | (product + packaging mass) × method factor |
| Transport | Σ (shipped mass in t) × km × mode factor (kg CO₂e/t·km) |
| Use & reprocessing | reprocessing per use + energy per use × grid factor |
| End of life | Σ mass × waste-route factor (biogenic carbon counted as neutral) |

For reusable products, production, transport and disposal are divided by the
number of uses.

The factors in `src/data/factors.js` are **indicative secondary data**
(ICE v3, PlasticsEurope, UK DEFRA/DESNZ, IEA, and published LCAs of medical
devices). They are meant for screening-level hotspot analysis and comparing
options. They are not suitable for certified claims or EPDs. Replace them with
supplier-specific data where you have it.

## Project layout

```
server.js                 HTTP server (static UI + JSON API)
scripts/build-static.js   single-file static build (docs/index.html)
src/routes.js             API routes shared by the server and the static build
src/data/factors.js       emission-factor library
src/data/products.js      reference product library
src/engine/calculator.js  footprint model + input validation
src/engine/search.js      fuzzy product search + draft generator
public/                   interactive frontend (HTML/CSS/JS)
test/                     node:test suites
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/products?q=latex glove` | ranked product matches |
| GET | `/api/products/:id` | full product definition |
| GET | `/api/factors` | selectable factor tables |
| POST | `/api/draft` `{ name }` | draft definition for an unknown product |
| POST | `/api/estimate` `{ product, quantity }` | footprint result (422 with details on invalid input) |
