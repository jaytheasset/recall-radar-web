# Launch Checklist

Use this checklist before a controlled public launch, staging deployment, or final merge to `main`.

## A. Current Launch Scope

- Static Astro site.
- Static processed JSON is bundled at build/runtime from `data/processed/recalls.json`.
- 1201 indexed recall notices.
- 10 official source feeds.
- Active sources: `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`, `AU_PRODUCT_SAFETY`, `NZ_PRODUCT_SAFETY`, `HK_CFS`, `FSANZ_FOOD_RECALLS`.
- No backend, database, email service, runtime API, or account system.
- No live alerting, product registration, affiliate/referral, or LLM feature.
- No full source backfills yet.
- Cross-source dedupe is not implemented yet.

## B. Pre-Launch Commands

Run from the project root:

```powershell
npm run audit:sources
npm run audit:fsanz-food-recalls
npm run audit:new-zealand-product-safety
npm run audit:hong-kong-cfs
npm run audit:australia-product-safety
npm run audit:uk-fsa
npm run audit:eu-safety-gate
npm run audit:canada
npm run audit:rappelconso
npm run check
npm run build
```

Shortcut:

```powershell
npm run validate:launch
```

Do not run network update scripts as part of launch validation unless intentionally refreshing source data.

## C. Network-Fetch Commands

These commands perform network fetches or may update local data files. Run them only in an intentional data-refresh phase, not during normal build/deploy:

- `npm run build:data`
- `npm run fetch:cpsc`
- `npm run fetch:fda-food`
- `npm run fetch:rappelconso`
- `npm run fetch:canada`
- `npm run fetch:eu-safety-gate`
- `npm run fetch:uk-fsa`
- `npm run fetch:australia-product-safety`
- `npm run fetch:new-zealand-product-safety`
- `npm run fetch:hong-kong-cfs`
- `npm run fetch:fsanz-food-recalls`
- `npm run data:rappelconso:fetch`
- `npm run data:canada:fetch`
- `npm run data:eu-safety-gate:fetch`
- `npm run data:uk-fsa:fetch`
- `npm run data:australia-product-safety:fetch`
- `npm run data:new-zealand-product-safety:fetch`
- `npm run data:hong-kong-cfs:fetch`
- `npm run data:fsanz-food-recalls:fetch`
- `npm run update:rappelconso`
- `npm run update:canada`
- `npm run update:eu-safety-gate`
- `npm run update:uk-fsa`
- `npm run update:australia-product-safety`
- `npm run update:new-zealand-product-safety`
- `npm run update:hong-kong-cfs`
- `npm run update:fsanz-food-recalls`

## D. Data/Source Checklist

Confirm current counts:

- Total: 1201
- CPSC: 301
- FDA/openFDA: 100
- FR_RAPPELCONSO: 100
- CA_RECALLS: 100
- EU_SAFETY_GATE: 100
- UK_FSA: 100
- AU_PRODUCT_SAFETY: 100
- NZ_PRODUCT_SAFETY: 100
- HK_CFS: 100
- FSANZ_FOOD_RECALLS: 100
- Duplicate ids: 0
- Unknown source ids: 0
- Active source filters: `all`, `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`, `AU_PRODUCT_SAFETY`, `NZ_PRODUCT_SAFETY`, `HK_CFS`, `FSANZ_FOOD_RECALLS`

`npm run audit:sources` should pass before launch.

## E. User-Facing Safety Checklist

Verify no consumer-facing copy says:

- safe
- not recalled
- complete global coverage
- all worldwide recalls
- confirmed affected
- definitely affected

Required search disclaimer:

> Search results are possible matches, not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.

Required no-result warning substance:

> No clear match found. We did not find a clear match in the indexed recall notices. This does not mean the product is safe or recall-free.

## F. Source Coverage Wording

Allowed wording:

- 1201 indexed recall notices
- 10 official source feeds
- official recall notices across markets
- possible matches
- verify with official notice

Avoid wording:

- all recalls worldwide
- complete global database
- comprehensive worldwide coverage
- government-certified safety check

## G. Smoke Test URLs

Verify these routes return 200:

- `/`
- `/checker`
- `/checker?source=CPSC`
- `/checker?source=FDA`
- `/checker?source=FR_RAPPELCONSO`
- `/checker?source=CA_RECALLS`
- `/checker?source=EU_SAFETY_GATE`
- `/checker?source=UK_FSA`
- `/checker?source=AU_PRODUCT_SAFETY`
- `/checker?source=NZ_PRODUCT_SAFETY`
- `/checker?source=HK_CFS`
- `/checker?source=FSANZ_FOOD_RECALLS`
- `/checker?q=zzzz-not-real`
- `/watchlist`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- `/household-product-recalls`
- `/us-product-recalls`
- `/canada-product-recalls`
- `/eu-safety-gate-recalls`
- `/france-product-recalls`
- `/uk-food-recalls`
- `/australia-product-recalls`
- `/new-zealand-product-recalls`
- `/hong-kong-food-recalls`
- `/australia-new-zealand-food-recalls`
- `/brands/aldi`
- `/404`
- `/robots.txt`

Homepage source cards:

- Australia card says Product Safety Australia and general product recalls.
- New Zealand card says Product Safety New Zealand and general product recalls.
- FSANZ card says Food Standards Australia New Zealand / FSANZ Food Recalls and food recalls.
- FSANZ is not presented as a merged Australia/New Zealand general product source.

Representative detail pages:

- CPSC: `/recalls/17-stories-furniture-14-drawer-dressers-tip-over-and-entrapment-hazards-cpsc-26323`
- FDA/openFDA: `/recalls/003020-sour-cream-and-onion-net-wt-10-lbs-jcb-flavors-1224-clark-st-fda-h-0887-2026`
- France RappelConso: `/recalls/acps-oris-attelage-remorque-pour-citroen-berlingo-ou-peugeot-partner-fr-rappelconso-2026-06-0226`
- Canada: `/recalls/9227-8712-quebec-inc-brand-and-l-erabeille-brand-pure-maple-syrup-ca-recalls-82260`
- EU Safety Gate: `/recalls/abirdon-teething-toy-safety-gate-alert-eu-safety-gate-10099469`
- UK FSA: `/recalls/3d-trading-m-and-m-s-pipoca-popcorn-because-of-undeclared-allergens-uk-fsa-fsa-aa-20-2026`
- Australia Product Safety: `/recalls/12-lcd-writing-tablet-au-product-safety-12-lcd-writing-tablet`
- New Zealand Product Safety: `/recalls/bath-toy-squishy-dollarama-nz-product-safety-bath-toy-squishy-and-music-instrument-toy`
- Hong Kong CFS: `/recalls/not-to-consume-a-kind-of-prepackaged-frozen-sardines-detected-with-hk-cfs-2026-619`
- FSANZ Food Recalls: `/recalls/kaisi-melbourne-pty-ltd-wu-xian-zhai-soybean-snacks-five-spice-flavour-fsanz-food-recalls-fsanz-2026-35`

## H. Mobile/Responsive Checklist

Check narrow mobile widths for:

- homepage
- checker
- result cards
- source filter
- watchlist
- recall detail page
- long source labels
- long product titles
- French/European text
- no horizontal overflow

## I. SEO Basics Checklist

Confirm:

- Homepage has title and description.
- Checker page has title and description.
- Recall detail pages have title and description.
- Category pages have title and description.
- Brand pages have title and description.
- `public/robots.txt` allows crawling.
- No accidental `noindex` is present unless intentionally added later.

Sitemap status:

- No sitemap tooling is currently configured.
- Sitemap generation is deferred until a site URL/canonical deployment target is chosen.

Canonical/site URL status:

- `astro.config.mjs` does not currently set a `site` URL.
- Add a canonical site URL only after the launch domain is known.

## J. Known Launch Limitations

- Static processed data only.
- No runtime freshness.
- No full source backfills.
- No cross-source dedupe.
- No user product registration.
- No email alerts.
- No backend account system.
- Source text may remain English, French, or multilingual.
- Not every official notice has structured barcode/model/lot/date details.
- Some source feeds have sparse brand, action, image, or distribution fields.

## K. Merge/Release Checklist

- Merge stacked branches in order.
- Run `npm run validate:launch` after final merge to `main`.
- Confirm clean git status.
- Confirm deployed build uses the latest intended `data/processed/recalls.json`.
- Confirm no network update scripts run during deploy.
- Smoke test the deployed/staging URL.
- Tag a release only after smoke testing passes.

## L. Recall Taxonomy V2 Design Gate

- Run `npm run audit:recall-taxonomy-v2-design` before starting taxonomy migration work.
- Confirm Phase 41 did not change source ids, source routes, source counts, canonical processed data, or current category pages.
- Treat old `category` compatibility as deprecated future debt, not as a permanent launch requirement.
- Do not migrate UI routes to taxonomy v2 until an offline classifier dry run and human review pass are complete.

## M. LLM Classifier Dry-Run Gate

- Run `npm run classify:recalls:taxonomy-v2:dry-run` in mock mode before any taxonomy migration phase.
- Run `npm run audit:llm-classifier-dry-run`.
- Confirm generated files stay under ignored `outputs/llm-classifier/`.
- Confirm no dry-run outputs, API keys, canonical data changes, route changes, or source-count changes are committed.
- Confirm the known Yamaha/UMAX/Bistro vehicle-style edge case is sampled and reported.
- Confirm any future live-provider run is reviewed separately and uses only local environment variables.

## N. Recall Data Schema V2 Gate

- Run `npm run audit:recall-data-schema-v2-readiness`.
- Confirm future V2 records require classification and do not require old category.
- Confirm `data/processed/recalls-v2.json` is not created until a separate reviewed migration phase.
- Confirm Phase 44 per-source outputs are planned for ignored `outputs/llm-classifier/per-source/` files only.
- Confirm runtime category/search/filter pages still use the current schema until an explicit V2 migration branch.
