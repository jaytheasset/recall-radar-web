# Phase 44 Per-Source LLM Classification Plan

Phase 44 should run a bounded Gemini classification test by source. It must not modify canonical data.

## Provider

- Preferred provider: Gemini
- Preferred model: Gemini 2.5 Flash-Lite or the current cheapest suitable Gemini model available in the local environment
- API key: local environment variable only
- No key should be committed or printed

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
