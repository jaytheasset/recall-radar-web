# LLM Environment Setup

Phase 44A adds safe local environment handling for Recall Taxonomy V2 classifier scripts. It does not run full classification, migrate canonical data, or change runtime UI.

## Purpose

Use local environment variables for LLM classifier probes and future per-source classification tests without committing secrets.

## Local Setup

Copy the example file:

```powershell
Copy-Item .env.example .env.local
```

Shell equivalent:

```sh
cp .env.example .env.local
```

Put real values only in `.env.local`. Do not commit `.env.local`.

## Required Gemini Variables

```text
RECALL_CLASSIFIER_PROVIDER=gemini
RECALL_CLASSIFIER_MODEL=gemini-2.5-flash-lite
RECALL_CLASSIFIER_LIMIT=100
RECALL_CLASSIFIER_SAMPLE_STRATEGY=balanced
RECALL_CLASSIFIER_OUTPUT_DIR=outputs/llm-classifier
GEMINI_API_KEY=your_key_here
```

Recommended model for the first live test:

```text
RECALL_CLASSIFIER_MODEL=gemini-2.5-flash-lite
```

## Pricing Estimates

Set editable estimates before large runs:

```text
RECALL_CLASSIFIER_INPUT_USD_PER_1M=0.10
RECALL_CLASSIFIER_OUTPUT_USD_PER_1M=0.40
```

Verify current provider pricing before using these estimates for production planning.

## Diagnostics

Run:

```powershell
npm run debug:llm-classifier-env
```

This prints provider, model, limit, sample strategy, output directory, masked key presence, pricing envs, and readiness flags. It never prints full API keys.

## Gemini Probe

Run:

```powershell
npm run probe:gemini-classifier
```

The probe sends one artificial recall classification prompt only when `GEMINI_API_KEY` is present. It does not read live source records and does not write canonical data. If the key is missing, it prints clear setup instructions and exits without a live request.

## Mock Dry Run

```powershell
$env:RECALL_CLASSIFIER_PROVIDER = "mock"
npm run classify:recalls:taxonomy-v2:dry-run
Remove-Item Env:RECALL_CLASSIFIER_PROVIDER
```

## Small Live Dry Run

Use this only after the Gemini probe passes:

```powershell
$env:RECALL_CLASSIFIER_PROVIDER = "gemini"
$env:RECALL_CLASSIFIER_LIMIT = "10"
npm run classify:recalls:taxonomy-v2:dry-run
Remove-Item Env:RECALL_CLASSIFIER_PROVIDER
Remove-Item Env:RECALL_CLASSIFIER_LIMIT
```

This writes ignored local outputs under `outputs/llm-classifier/`.

## PowerShell One-Time Env Example

```powershell
$env:GEMINI_API_KEY = "your_key_here"
$env:RECALL_CLASSIFIER_PROVIDER = "gemini"
$env:RECALL_CLASSIFIER_MODEL = "gemini-2.5-flash-lite"
npm run debug:llm-classifier-env
npm run probe:gemini-classifier
```

For permanent local values, prefer `.env.local`.

## Never Commit

- `.env.local`
- real `GEMINI_API_KEY`
- real `OPENAI_API_KEY`
- generated files under `outputs/llm-classifier/`
- probe outputs under `outputs/llm-classifier/probe/`

## Troubleshooting

- Missing key: copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`, or set the key in the shell.
- Invalid model: set `RECALL_CLASSIFIER_MODEL=gemini-2.5-flash-lite` or another currently available Gemini model.
- Invalid JSON response: rerun the probe and inspect only the validation summary; do not print full keys.
- Rate limit: wait and rerun a smaller sample.
- Network error: verify local network access and provider availability.
