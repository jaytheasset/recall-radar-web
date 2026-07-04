# LLM Recall Classifier Dry Run

Phase 42 adds an offline-first dry-run pipeline for Recall Taxonomy V2. It does not migrate canonical data, does not change UI filtering, and does not write to `data/raw` or `data/processed`.

Phase 43 keeps this dry-run pipeline as a review tool and defines the future V2 persistence path. Per-source classification outputs for the next phase should go under ignored `outputs/llm-classifier/per-source/` and should not modify canonical data.

Phase 44A adds `.env.local` loading for local classifier CLI scripts plus `npm run debug:llm-classifier-env` and `npm run probe:gemini-classifier`. See `docs/llm-env-setup.md`.

Phase 44E-1 adds a CPSC-only input preview before live per-source classification. See `docs/cpsc-classifier-input-preview.md`.

Phase 44E-2 adds an FSANZ-only food recall input preview before live per-source classification. See `docs/fsanz-classifier-input-preview.md`.

Phase 44E-3 adds a New Zealand Product Safety-only input preview before live per-source classification. See `docs/new-zealand-classifier-input-preview.md`.

Phase 44E-4 adds a Hong Kong CFS-only food alert input preview before live per-source classification. See `docs/hong-kong-cfs-classifier-input-preview.md`.

## Purpose

The dry run tests whether Recall Taxonomy V2 can classify the current indexed notices into the new taxonomy shape before any migration phase. It compares generated taxonomy fields with the existing legacy `category` field and highlights suspicious mismatches for manual review.

## Provider Modes

- `mock` is the default and requires no network or API key.
- `gemini` is optional and runs only when `GEMINI_API_KEY` is set.
- `openai` is optional and runs only when `OPENAI_API_KEY` is set.

Set the provider with:

```powershell
$env:RECALL_CLASSIFIER_PROVIDER = "mock"
npm run classify:recalls:taxonomy-v2:dry-run
Remove-Item Env:RECALL_CLASSIFIER_PROVIDER
```

Optional model override:

```powershell
$env:RECALL_CLASSIFIER_MODEL = "gemini-2.5-flash-lite"
```

Optional sample size:

```powershell
$env:RECALL_CLASSIFIER_LIMIT = "100"
```

## Output

Generated dry-run files are written to ignored local output only:

- `outputs/llm-classifier/dry-run-results.json`
- `outputs/llm-classifier/dry-run-report.md`
- `outputs/llm-classifier/dry-run-cost-estimate.json`
- `outputs/llm-classifier/dry-run-mismatches.json`
- `outputs/llm-classifier/dry-run-failures.json`

These outputs are intentionally not committed.

## Prompt Contract

Prompt version: `recall-classifier-v1`

The classifier must return strict JSON shaped as `RecallClassificationV2`:

- `taxonomyVersion`
- `method`
- `model`
- `promptVersion`
- `productFamily`
- `productType`
- `hazardType`
- `hazardTags`
- `recallDomain`
- `audience`
- `confidence`
- `needsReview`
- `reason`
- `evidenceFields`

Enum values come from `src/data/recall-taxonomy-v2.ts`. Unknown or low-evidence records should use `unknown` and set `needsReview: true`.

## Sampling

The default balanced sample is capped by `RECALL_CLASSIFIER_LIMIT` and attempts to include:

- all active sources
- legacy category coverage
- food-source examples
- general product examples
- image-backed and image-less records
- ambiguous legacy terms
- the Yamaha/UMAX/Bistro/golf/utility vehicle suspicious case when present

## Cost Estimate

The dry run estimates tokens using a conservative character-based approximation. Cost projections are token-only unless pricing is provided through:

- `RECALL_CLASSIFIER_INPUT_USD_PER_1M`
- `RECALL_CLASSIFIER_OUTPUT_USD_PER_1M`

Projected volumes:

- current 1201 indexed notices
- 10,000 notices
- 100,000 notices

## Audit

Run:

```powershell
npm run audit:llm-classifier-dry-run
```

The audit checks:

- required scripts and docs exist
- output directory is ignored
- npm scripts are wired
- provider modes are present and key-gated
- prompt uses taxonomy v2 and strict JSON language
- sample selection includes the known suspicious Yamaha/Bistro vehicle edge case
- generated local dry-run output validates against `RecallClassificationV2` when present
- no committed API-key-like values are present in the classifier files

For CPSC input-noise review, run:

```powershell
npm run preview:cpsc-classifier-input
npm run audit:cpsc-classifier-input-preview
```

Those commands write ignored preview reports only and do not call an LLM.

For FSANZ food recall input-noise review, run:

```powershell
npm run preview:fsanz-classifier-input
npm run audit:fsanz-classifier-input-preview
```

Those commands compare generic input with an FSANZ-specific food recall input shape, write ignored preview reports only, and do not call an LLM.

For New Zealand Product Safety input-noise review, run:

```powershell
npm run preview:new-zealand-classifier-input
npm run audit:new-zealand-classifier-input-preview
```

Those commands compare generic input with a New Zealand-specific consumer product input shape, write ignored preview reports only, and do not call an LLM.

For Hong Kong CFS input-noise review, run:

```powershell
npm run preview:hong-kong-cfs-classifier-input
npm run audit:hong-kong-cfs-classifier-input-preview
```

Those commands compare generic input with a Hong Kong CFS-specific food alert input shape, write ignored preview reports only, and do not call an LLM.

## Non-Goals

This phase does not:

- write canonical taxonomy fields into recall records
- change homepage, checker, source pages, category pages, detail pages, or filters
- add new sources or countries
- run source refreshes, backfills, normalizers, or merge scripts
- activate Korea SafetyKorea
- add backend, database, accounts, email, translation, or runtime LLM calls
