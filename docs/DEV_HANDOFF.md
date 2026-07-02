# Development Handoff

## Local Setup

```powershell
cd C:\Users\pc\codex-projects\recall-radar-web
npm install
npm run dev
```

Use port `5179` only.

## Data Model

The site-facing recall model is built in `src/lib/recall-data.ts`.

Primary local source:

- `data/processed/recalls.json`

Fallback/demo source:

- `src/data/mock-recalls.ts`

When processed local records exist, they are the primary source for homepage cards, checker search results, recall detail pages, brand pages, and category pages. Mock records remain available only as local fallback/demo data.

Site-facing records include:

- slug
- title
- source label
- source URL
- brand names
- category
- product names
- recall date
- affected units
- description
- hazard
- remedy
- optional FDA fields such as classification, reason, distribution pattern, product quantity, recall number, and status

## Local CPSC Pipeline

Phase 2 added a local-only CPSC recall data pipeline. Phase 3 connects the processed CPSC file to the website. Phase 5 adds local FDA/openFDA food recall records and makes `data/processed/recalls.json` the merged canonical local source.

USDA FSIS integration is deferred. A local Phase 6 attempt against the official USDA FSIS recall endpoint returned HTTP `403 Forbidden` / `Access Denied`; no USDA data was written and no bypass should be attempted. The likely cause is FSIS-side access control, CDN/WAF filtering, User-Agent/header filtering, IP/range filtering, or temporary endpoint restrictions. See `docs/USDA_FSIS_DEFERRED.md`.

Commands:

- `npm run fetch:cpsc` fetches current-year public CPSC recall JSON and writes local files.
- `npm run normalize:cpsc` rebuilds processed recall data from `data/raw/cpsc-recalls.json`.
- `npm run fetch:fda-food` fetches recent public openFDA food enforcement JSON and writes local files.
- `npm run normalize:fda-food` rebuilds FDA processed recall data from `data/raw/fda-food-recalls.json`.
- `npm run fetch:rappelconso` fetches the bounded France RappelConso source spike.
- `npm run normalize:rappelconso` rebuilds RappelConso processed data from `data/raw/rappelconso-recalls.json`.
- `npm run fetch:canada` fetches the bounded Canada Recalls and Safety Alerts source spike.
- `npm run normalize:canada` rebuilds Canada processed data from `data/raw/canada-recalls.json`.
- `npm run fetch:eu-safety-gate` fetches the bounded EU Safety Gate source spike.
- `npm run normalize:eu-safety-gate` rebuilds EU Safety Gate processed data from `data/raw/eu-safety-gate-recalls.json`.
- `npm run fetch:uk-fsa` fetches the bounded UK FSA Food Alerts source spike.
- `npm run normalize:uk-fsa` rebuilds UK FSA processed data from `data/raw/uk-fsa-alerts.json`.
- `npm run audit:sources` audits integrated source counts, active source ids, duplicate ids, sparse fields, and category distribution without making network calls.
- `npm run audit:uk-fsa` audits the bounded UK FSA source spike.
- `npm run validate:launch` runs the local-only launch validation sequence: integrated/source audits, `npm run check`, and `npm run build`.
- `npm run build:data` currently runs the CPSC, FDA/openFDA, France RappelConso, Canada, EU Safety Gate, and UK FSA fetch pipelines.

Local output files:

- `data/raw/cpsc-recalls.json`
- `data/raw/fda-food-recalls.json`
- `data/raw/rappelconso-recalls.json`
- `data/raw/canada-recalls.json`
- `data/raw/eu-safety-gate-recalls.json`
- `data/raw/uk-fsa-alerts.json`
- `data/processed/cpsc-recalls.json`
- `data/processed/fda-recalls.json`
- `data/processed/rappelconso-recalls.json`
- `data/processed/canada-recalls.json`
- `data/processed/eu-safety-gate-recalls.json`
- `data/processed/uk-fsa-alerts.json`
- `data/processed/recalls.json`

The fetch script calls `https://www.saferproducts.gov/RestWebServices/Recall` without an API key. It writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

The FDA/openFDA fetch script calls `https://api.fda.gov/food/enforcement.json` without an API key. It fetches a limited set of recent records, writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

The EU Safety Gate fetch script calls official EU Safety Gate endpoints only:

- `https://ec.europa.eu/safety-gate-alerts/public/api/notification/mostRecent/?`
- `https://ec.europa.eu/safety-gate-alerts/public/api/notification/{id}?language=en`

It fetches a bounded default of 100 recent dangerous non-food product alerts, writes only after non-empty records return, and each raw file includes a `fetchedAt` timestamp.

The UK FSA fetch script calls official FSA Food Alerts endpoints only:

- `https://data.food.gov.uk/food-alerts/id.json?_limit=100&_sort=-created`
- `https://data.food.gov.uk/food-alerts/id/{notation}.json`

It fetches a bounded default of 100 recent food alerts, allergy alerts, product recall information notices, and food alerts for action. It writes only after non-empty records return, and each raw file includes a `fetchedAt` timestamp. See `docs/uk-fsa-source.md`.

EU Safety Gate operational update strategy:

- Explicit refresh command: `npm run update:eu-safety-gate`
- The refresh command fetches the bounded Safety Gate data, writes raw EU data, normalizes EU records, rebuilds `data/processed/recalls.json`, and runs `npm run audit:eu-safety-gate`.
- Local-only validation sequence: `npm run data:eu-safety-gate:normalize`, `npm run data:merge`, `npm run audit:eu-safety-gate`.
- Default limit remains `EU_SAFETY_GATE_LIMIT=100`; full EU backfill is a separate phase.
- For the current 100-record spike, commit `data/raw/eu-safety-gate-recalls.json`, `data/processed/eu-safety-gate-recalls.json`, and `data/processed/recalls.json` together only after audit passes.
- Block or investigate an EU data merge if source counts change unexpectedly, duplicate ids or slug collisions appear, suspicious category mappings appear, or any EU record maps to `food-allergy`.

Normalized records use `src/data/recall-types.ts` and include `id`, `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`. FDA, France, Canada, and EU records can also include `classification`, `reason`, `distributionPattern`, `productQuantity`, `recallNumber`, `status`, and official image fields when available.

Do not call fetch scripts during UI-only phases unless a later task explicitly asks for fresh local data.

Phase 10 current source counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- UK FSA Food Alerts: 100
- Total: 801

Phase 10.1 UK FSA QA notes:

- `scripts/audit-uk-fsa-alerts.ts` reports pack size, batch/date, allergen/risk, retailer/distribution-like details, image availability, related-media availability, alert type distribution, and suspicious category mappings.
- UK FSA records remain conservatively routed to food/allergy because the source is food alerts, allergy alerts, product recall information notices, and food alerts for action.
- Food Alert For Action records avoid treating generic "Food businesses selling these products..." instructions as a brand/company name.

Phase 10.2 UK FSA update workflow:

- `npm run update:uk-fsa` is the explicit network refresh workflow and runs fetch, normalize, merge, and audit in sequence.
- Local-only validation should use `npm run data:uk-fsa:normalize`, `npm run data:merge`, and `npm run audit:uk-fsa`.
- Keep `UK_FSA_LIMIT=100` as the default until a separate full-backfill phase reviews raw file size, page count, brand page growth, and commit strategy.

Phase 11 integrated source QA:

- Active source ids are `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, and `UK_FSA`.
- `npm run audit:sources` verifies the integrated source registry and canonical `data/processed/recalls.json` stay aligned.
- Current expected counts are 301 CPSC, 100 FDA/openFDA, 100 France RappelConso, 100 Canada Recalls and Safety Alerts, 100 EU Safety Gate, and 100 UK FSA Food Alerts, for 801 total records.
- Current static build output is around 1382 pages, and `data/processed/recalls.json` is around 5.8 MB.
- Full backfills should measure canonical data size, detail page count, brand page count, build time, and static output size before merge.
- Cross-source dedupe is not implemented yet; source-prefixed ids are preserved.

Phase 13 launch readiness:

- `docs/LAUNCH_CHECKLIST.md` is the launch/staging handoff checklist.
- `npm run validate:launch` is the preferred local-only pre-launch validation command.
- `public/robots.txt` allows crawling.
- `src/pages/404.astro` provides a simple static not-found page.
- No sitemap is configured yet; defer sitemap generation until a deployment domain/canonical site URL is chosen.

## Site Data Loader

`src/lib/recall-data.ts`:

- loads `data/processed/recalls.json` at build time
- maps CPSC and FDA/openFDA records into a UI-safe `SiteRecall` shape
- routes source labels through `src/lib/recall-sources.ts`
- builds concise recall detail slugs from cleaned title text, with product/brand fallback context
- limits generated detail slugs at word boundaries while preserving uniqueness with the CPSC id
- builds brand groups from `brandNames`
- keeps raw CPSC brand/legal names on each recall
- adds normalized consumer-facing brand display names and shorter brand slugs through `src/lib/brand-normalize.ts`
- classifies records lightly into baby/kids, battery/electronics, food/allergy, household/appliance, or general consumer product
- routes FDA/openFDA and UK FSA food records into the food/allergy page for browsing
- falls back to mock records only when no processed records are available

## Brand Normalization

`src/lib/brand-normalize.ts` is intentionally conservative:

- prefers explicit `dba`, `d/b/a`, or `doing business as` names
- removes trailing CPSC location phrases such as `of Houston, Texas` when safe
- removes common legal suffix noise such as `Inc.`, `LLC`, `Ltd.`, `Corporation`, and `Co. Ltd.`
- keeps the raw source name available on recall detail and brand pages
- limits brand slugs to avoid very long legal-entity URLs
- avoids cutting brand slugs in the middle of a word
- keeps brand routes unique if two different display names normalize to the same slug

Example:

- raw source name: `7111495 Canada Inc., dba Arizer Tech, of Waterloo, Ontario`
- display brand: `Arizer Tech`
- route: `/brands/arizer-tech`

## Slug Quality

`src/lib/slug.ts` removes common low-value recall-title phrases before generating recall page URLs, including `recalled due to`, `risk of`, `serious injury or death`, `sold exclusively`, `sold at`, and standalone importer/manufacturer clauses. Recall slugs keep the source id suffix, such as `cpsc-26565`, so cleaned URLs remain stable and unique for the same source record.

## Search Helper

`src/lib/recall-search.ts` exports:

- `searchRecalls`
- `getRecallMatch`
- `MATCH_LABELS`
- `SEARCH_RESULTS_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

The checker renders grouped indexed-notice results with match badges, recall date, source label, product/brand context, reason/risk summary, category, and detail links. Keep the generic search disclaimer and no-result warning consistent wherever search results appear.

Phase 7 added local-only search controls on `/checker`:

- keyword/product/brand/model/UPC/lot text query
- source filter for all markets plus `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, and `UK_FSA`
- category filter for baby/kids, battery/electronics, food/allergy, household/appliance, food, and general records
- sort controls for best match, newest first, and oldest first
- optional date windows for last 30 days, last 90 days, and all time
- URL query state such as `/checker?q=arizer`, `/checker?q=pistachio&source=FDA`, and `/checker?q=smoke&source=CPSC`

The checker remains static and local-only. It embeds the local processed recall records at build time and does not add a server, API route, database, or external data call.

## Recall Detail Pages

Recall detail pages use structured local summaries instead of long official text blocks. Each detail page shows product, brand/company, hazard, remedy, affected units, a conservative what-to-check checklist, company recall history, related recalls, and a smaller official source attribution link.

`src/lib/recall-checklist.ts` derives checklist items from available local fields such as product names, brand/company names, recall numbers, affected units, and identifier-like text already present in the local record. It does not invent model, UPC, lot, or date-code values.

`src/lib/related-recalls.ts` builds company recall history from conservative normalized brand/company matching and related recalls from category, hazard keywords, product terms, and source tie-breakers. It avoids matching only on legal suffixes, generic company words, or location-only overlap.

## Local Watchlist Demo

Phase 8 adds a static `/watchlist` page and browser-only watchlist UX.

- Storage key: `recall-radar-watchlist-v1`
- Implementation: `src/lib/watchlist.ts`
- Users can save search terms from `/checker` with source and category preferences.
- Users can save normalized brand pages from `/brands/[brand]`.
- Users can remove individual saved items or clear the watchlist.
- `/watchlist` embeds the existing indexed notices at build time and previews matching recall records in the browser.
- The email preview form is non-submitting UI only; it does not submit, send, store, or transmit email addresses.

The watchlist is not an alert backend. It uses only browser `localStorage`; there is no API endpoint, server persistence, database, email service, external dependency, or network request.

## I18n Foundation

Phase 15 adds planning docs for future multilingual UI support without wiring localization into the visible app.

- `docs/i18n-foundation.md` defines translation boundaries, future locale planning, source-language policy, SEO considerations, and deferred items.
- `docs/i18n-string-audit.md` audits the main UI areas and identifies which strings are product-owned UI versus source-derived recall fields.
- `src/lib/i18n.ts` contains an English-only message dictionary for future typed message work. It is not connected to pages yet.
- Current launch UI remains English-only.
- Official source text remains in the source language and should not be automatically translated or rewritten as official notice truth.
- Locale routes such as `/en` or `/ko`, browser language detection, `hreflang`, translated slugs, translated source records, and LLM translation are deferred.

## Guardrails

Keep this repo static/local-first. Do not add secrets, deployments, databases, or runtime source calls. Only run source fetch scripts when a data-pipeline or source-refresh phase explicitly requests them.
