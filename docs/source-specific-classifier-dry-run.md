# Source-Specific Classifier Dry Run

This dry run compares two LLM inputs for the same sample records:

- `genericInput`: the current common input shape shared by every source.
- `proposedInput`: the source-specific input preview built from each official source's structure.

Run all source-specific input previews first:

```powershell
npm run preview:all-classifier-inputs
npm run audit:all-classifier-input-previews
```

Then run a bounded live-provider comparison:

```powershell
$env:RECALL_CLASSIFIER_PROVIDER = "gemini"
$env:RECALL_CLASSIFIER_MODEL = "gemini-2.5-flash-lite"
npm run classify:recalls:taxonomy-v2:source-specific-dry-run
Remove-Item Env:RECALL_CLASSIFIER_PROVIDER
Remove-Item Env:RECALL_CLASSIFIER_MODEL
```

Audit the local output:

```powershell
npm run audit:source-specific-classifier-dry-run
```

Outputs are ignored and written under:

`outputs/llm-classifier/source-specific-dry-run/`

Generated files:

- `source-specific-dry-run-results.json`
- `source-specific-dry-run-report.md`
- `source-specific-dry-run-changes.json`
- `source-specific-dry-run-failures.json`

This phase does not write final Taxonomy V2 values to `data/raw`, `data/processed`, a database, or runtime UI. It only tests whether source-specific evidence improves or changes Gemini classification compared with the generic input.

The dry run records source-specific `evidenceFields` aliases when Gemini returns names such as `hazardText`, `riskText`, `sourceProductType`, or `actionText`. Those aliases are mapped to the closest allowed generic evidence enum for validation, and the repairs are kept in the ignored output report for review.
