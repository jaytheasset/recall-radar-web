# CPSC Classifier Input Preview

Phase 44E-1 adds a local CPSC-only classifier input preview before any Gemini classification.

## Purpose

The preview shows exactly what the current generic classifier input builder would send for CPSC records, then compares it with a proposed CPSC-specific input view. This catches prompt noise before a live LLM run.

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Why CPSC Is First

CPSC is the largest current source with 301 indexed notices. It covers broad consumer product types and includes the Yamaha UMAX Bistro golf car case that previously exposed category confusion. That makes CPSC a useful first source for checking whether LLM input captures product identity without misleading food or restaurant-like terms.

## Why Input Must Be Source-Specific

Official sources expose different fields. A generic input can be useful for early dry runs, but source-specific previews help remove:

- page boilerplate
- contact blocks
- repeated descriptions
- generated fallback text
- image URLs and captions
- raw HTML
- oversized remedy text
- duplicate identifiers

Reducing noise lowers token cost and reduces misclassification risk.

## Current Generic Input Fields

The current generic builder in `scripts/build-recall-classifier-input.ts` uses:

- `id`
- `source`
- `title`
- `productNames`
- `brandNames`
- `legacyCategory`
- `rawSourceCategory`
- `hazard`
- `remedy`
- `description`
- `sourceUrl`
- `recallDate`
- `identifiers`

Phase 44E-1 does not change that live dry-run builder.

## Proposed CPSC Input Fields

The preview proposes a CPSC-specific shape:

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `productNames`
- `brandNames`
- `sourceCategory`
- `productDescription`
- `hazardText`
- `remedyText`
- `recallNumber`
- `identifiers`
- `affectedUnits`
- `sourceHints.source = CPSC`
- `sourceHints.market = United States`
- `sourceHints.officialSource = Consumer Product Safety Commission`
- `sourceHints.sourceApi = SaferProducts recall API`
- `sourceHints.domainHint = consumer-product`
- `sourceHints.classificationOwner = llm`

These are source evidence fields only. Product family, product type, hazard type, audience, and other final Taxonomy V2 values remain LLM-owned.

## Excluded Fields

The proposed CPSC input excludes:

- full raw objects
- full HTML
- image URLs
- image captions
- contact blocks
- social/share/navigation/footer text
- boilerplate official disclaimer text
- generated fallback strings such as `Review the official CPSC notice`
- repeated duplicate strings
- long remedy instructions when they are not needed for classification

## How To Run

```powershell
npm run preview:cpsc-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:CPSC_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:cpsc-classifier-input
Remove-Item Env:CPSC_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:cpsc-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/cpsc/cpsc-input-preview.json`
- `outputs/llm-classifier/input-preview/cpsc/cpsc-input-preview.md`
- `outputs/llm-classifier/input-preview/cpsc/cpsc-noise-report.json`
- `outputs/llm-classifier/input-preview/cpsc/cpsc-token-comparison.json`

Do not commit these files.

## Yamaha/Bistro Review

Open the markdown report and search for `Yamaha`, `UMAX`, or `Bistro`.

The representative sample should show product evidence such as golf cars, utility vehicle language, model year, brand/company, hazard, and recall number. The word `Bistro` should be treated as a model/product term in this CPSC notice, not as food evidence.

## Token Reduction

The token comparison file estimates generic input tokens and proposed CPSC input tokens using a character-based approximation. Treat the reduction as a planning estimate, not billing-grade accounting.

A useful reduction keeps:

- product identity
- brand/company evidence
- hazard evidence
- remedy/action evidence
- key identifiers

while removing boilerplate and duplicated text.

## Next Source Candidates

After CPSC, the next recommended source previews are:

1. FSANZ food recalls, because food identifiers and date marks differ from CPSC.
2. EU Safety Gate, because product identifiers, alert numbers, and multilingual fields vary.
3. FDA/openFDA food enforcement, because product quantity, reason, and classification/status fields differ.
