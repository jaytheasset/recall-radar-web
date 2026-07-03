# Launch Checklist

Use this checklist before a controlled public launch, staging deployment, or final merge to `main`.

## A. Current Launch Scope

- Static Astro site.
- Static processed JSON is bundled at build/runtime from `data/processed/recalls.json`.
- 801 indexed recall notices.
- 6 official source feeds.
- Active sources: `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`.
- No backend, database, email service, runtime API, or account system.
- No live alerting, product registration, affiliate/referral, or LLM feature.
- No full source backfills yet.
- Cross-source dedupe is not implemented yet.

## B. Pre-Launch Commands

Run from the project root:

```powershell
npm run audit:sources
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
- `npm run data:rappelconso:fetch`
- `npm run data:canada:fetch`
- `npm run data:eu-safety-gate:fetch`
- `npm run data:uk-fsa:fetch`
- `npm run update:rappelconso`
- `npm run update:canada`
- `npm run update:eu-safety-gate`
- `npm run update:uk-fsa`

## D. Data/Source Checklist

Confirm current counts:

- Total: 801
- CPSC: 301
- FDA/openFDA: 100
- FR_RAPPELCONSO: 100
- CA_RECALLS: 100
- EU_SAFETY_GATE: 100
- UK_FSA: 100
- Duplicate ids: 0
- Unknown source ids: 0
- Active source filters: `all`, `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`

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

- 801 indexed recall notices
- 6 official source feeds
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
- `/checker?q=zzzz-not-real`
- `/watchlist`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- `/household-product-recalls`
- `/brands/aldi`
- `/404`
- `/robots.txt`

Representative detail pages:

- CPSC: `/recalls/17-stories-furniture-14-drawer-dressers-tip-over-and-entrapment-hazards-cpsc-26323`
- FDA/openFDA: `/recalls/003020-sour-cream-and-onion-net-wt-10-lbs-jcb-flavors-1224-clark-st-fda-h-0887-2026`
- France RappelConso: `/recalls/acps-oris-attelage-remorque-pour-citroen-berlingo-ou-peugeot-partner-fr-rappelconso-2026-06-0226`
- Canada: `/recalls/9227-8712-quebec-inc-brand-and-l-erabeille-brand-pure-maple-syrup-ca-recalls-82260`
- EU Safety Gate: `/recalls/abirdon-teething-toy-safety-gate-alert-eu-safety-gate-10099469`
- UK FSA: `/recalls/3d-trading-m-and-m-s-pipoca-popcorn-because-of-undeclared-allergens-uk-fsa-fsa-aa-20-2026`

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
