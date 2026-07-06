# Classification Results V2 Apply Pipeline

This step turns an already generated full source-specific classifier preview into the runtime Taxonomy V2 classification file.

It does not call Gemini or OpenAI. It does not fetch, normalize, merge, or backfill source data.

## Input

- `outputs/llm-classifier/full-source-specific-preview/full-source-specific-classifier-results.json`
- `data/processed/recalls.json`

The classifier preview input is local and ignored by git.

## Output

- `data/processed/recall-classifications-v2.json`

This file is read by the site runtime and joined to canonical recall records by `recordId`.

## Commands

```bash
npm run apply:classification-results-v2
npm run audit:classification-results-v2
```

The apply command writes only when the generated output differs from the current file.

## Gates

The apply command blocks when:

- classifier result count does not match canonical recall count
- any canonical recall id is missing
- any extra classifier result id is present
- source counts do not match
- any classifier result failed
- any Taxonomy V2 enum is invalid

The audit command validates the saved runtime file against canonical recalls and writes ignored audit output to:

```text
outputs/llm-classifier/classification-results-v2-audit/
```

## Current Review Meaning

`needsReview`, low confidence, unknown family/hazard, or quality flags are surfaced in the app as category review candidates. The parser does not own final Taxonomy V2 classification.
