# Phase 44 Per-Source LLM Classification Plan

Phase 44 should run a bounded Gemini classification test by source. It must not modify canonical data.

Phase 44A adds the local env loader, `.env.example`, env diagnostic, and Gemini connectivity probe. Run those first before starting this per-source classification phase.

Phase 44C locks all 15 Taxonomy V2 product families as the future public category list. Gemini classification should preserve the enum values; public route migration remains deferred until classified outputs pass review. Hazard types should be treated as secondary issue tags, not primary public navigation.

Phase 44D adds source-aware identifier guidance. The Gemini test should treat identifiers as optional source-dependent evidence. Do not assume barcode exists, and do not penalize records that use model, lot, batch, date mark, pack size, certification, recall number, alert number, importer, retailer, or distribution details instead.

## Provider

- Preferred provider: Gemini
- Preferred model: Gemini 2.5 Flash-Lite or the current cheapest suitable Gemini model available in the local environment
- API key: local environment variable only
- No key should be committed or printed
- Prerequisite: `npm run debug:llm-classifier-env` and `npm run probe:gemini-classifier` should pass or clearly report missing-key setup.

## Output Location

Write ignored outputs only:

- `outputs/llm-classifier/per-source/<source-id>-classified.json`
- `outputs/llm-classifier/per-source/<source-id>-report.md`
- `outputs/llm-classifier/per-source/summary.json`
- `outputs/llm-classifier/per-source/review-candidates.json`

Do not write `data/processed/recalls-v2.json` in Phase 44.

## Source Sample Plan

| Source | Current count | Phase 44 sample |
| --- | ---: | ---: |
| `CPSC` | 301 | 100 |
| `FDA` | 100 | 100 |
| `FR_RAPPELCONSO` | 100 | 100 |
| `CA_RECALLS` | 100 | 100 |
| `EU_SAFETY_GATE` | 100 | 100 |
| `UK_FSA` | 100 | 100 |
| `AU_PRODUCT_SAFETY` | 100 | 100 |
| `NZ_PRODUCT_SAFETY` | 100 | 100 |
| `HK_CFS` | 100 | 100 |
| `FSANZ_FOOD_RECALLS` | 100 | 100 |

Total planned classification records: up to 1000.

## Required Reports

Generate:

- per-source report
- cross-source taxonomy report
- legacy category vs V2 classification comparison
- cost estimate using pricing env vars when present
- `needsReview` list
- low-confidence list
- `productFamily: unknown` list
- high `productType: other` distribution
- high `hazardType: unknown` distribution
- invalid enum or malformed output report

## Sampling Requirements

- Include all records for 100-count sources.
- For CPSC, sample 100 of 301 and include the Yamaha/UMAX/Bistro case when present.
- Preserve current source ids and counts in reports.
- Include image-backed and image-less examples when possible.
- Include food, consumer product, vehicle-like, medical/health, chemical, and household examples when present.

## Phase 44E Input Preview Prerequisite

Before live per-source Gemini classification, run source-specific input preview tools. Phase 44E-1 starts with CPSC only:

- `npm run preview:cpsc-classifier-input`
- `npm run audit:cpsc-classifier-input-preview`

The CPSC preview compares the current generic classifier input with a proposed CPSC-specific input shape and writes ignored reports under `outputs/llm-classifier/input-preview/cpsc/`. It does not call Gemini, does not classify records, and does not write canonical data.

Phase 44E-2 adds the same gate for FSANZ food recalls:

- `npm run preview:fsanz-classifier-input`
- `npm run audit:fsanz-classifier-input-preview`

The FSANZ preview compares generic input with a source-specific food recall shape using `problemText`, `foodSafetyHazardText`, `dateMarking`, pack-size and batch/lot/barcode evidence, and fixed `food-grocery` source hints. It also samples allergen, pathogen or chemical contamination, foreign matter, and non-allergen legacy `food-allergy` cases. It writes ignored reports under `outputs/llm-classifier/input-preview/fsanz/` and does not call Gemini, classify records, or write canonical data.

Phase 44E-3 adds the same gate for New Zealand Product Safety records:

- `npm run preview:new-zealand-classifier-input`
- `npm run audit:new-zealand-classifier-input-preview`

The New Zealand preview compares generic input with a source-specific consumer-product shape using `productIdentifiers`, `supplierName`, concise agency text, official categories, hazard/action fields, and explicit model/SKU/serial/barcode-style identifiers. It writes ignored reports under `outputs/llm-classifier/input-preview/new-zealand/` and does not call Gemini, classify records, or write canonical data.

Phase 44E-4 adds the same gate for Hong Kong CFS food alerts:

- `npm run preview:hong-kong-cfs-classifier-input`
- `npm run audit:hong-kong-cfs-classifier-input-preview`

The Hong Kong CFS preview compares generic input with a source-specific food alert shape using `productDescription`, `riskText`, `actionText`, importer/retailer/origin fields, pack/date/batch/barcode-style identifiers, and fixed `food-grocery` source hints. It samples allergen, contamination, foreign matter, identifier, image-backed, image-less, and non-allergen food cases when present. It writes ignored reports under `outputs/llm-classifier/input-preview/hong-kong-cfs/` and does not call Gemini, classify records, or write canonical data.

Canada detail parsing adds the same gate for Canada recalls:

- `npm run preview:canada-classifier-input`
- `npm run audit:canada-classifier-input-preview`

The Canada preview compares generic input with a source-specific official extraction shape using `sourceRecallType`, `sourceCategory`, `sourceRecallClass`, summary product/issue/action fields, affected product table rows, part numbers, and UPCs. These source fields are evidence only. The parser does not fill `productFamily`, `productType`, `hazardType`, `audience`, or other final Taxonomy V2 fields. It writes ignored reports under `outputs/llm-classifier/input-preview/canada/` and does not call Gemini, classify records, or write canonical data.

RappelConso adds the same gate for France recalls:

- `npm run preview:rappelconso-classifier-input`
- `npm run audit:rappelconso-classifier-input-preview`

The RappelConso preview compares generic input with a source-specific official extraction shape using French source category, subcategory, recall nature, product identification values, risk/reason text, consumer action text, sale-period dates, and distribution fields. These source fields are evidence only. The parser does not fill `productFamily`, `productType`, `hazardType`, `audience`, or other final Taxonomy V2 fields. It writes ignored reports under `outputs/llm-classifier/input-preview/rappelconso/` and does not call Gemini, classify records, or write canonical data.

## Review Questions

Phase 44 should answer:

- Which sources produce the most `needsReview` records?
- Which sources overuse `productType: other`?
- Which sources overuse `hazardType: unknown`?
- Are food records separated from general consumer-product records?
- Are vehicle-like consumer records handled without relying on legacy category?
- Are source-specific categories no longer required for public browsing?
- Is Gemini output stable enough for a migration planning phase?

## Do Not

- Do not modify `data/raw`.
- Do not modify `data/processed`.
- Do not run fetch, normalize, merge, backfill, or `build:data`.
- Do not add sources.
- Do not change UI routes or filters.
- Do not create `data/processed/recalls-v2.json`.
- Do not add a backend, database, API route, accounts, email, or translation.
