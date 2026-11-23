# Local recall enrichment

The Windows task `Recall Radar AI Enrichment` runs daily at 19:00 Korea time under the signed-in Windows user. It refreshes the project's official sources and processes pending or revised notices, including any initial backlog. The worker uses Node.js 24 and GPT-6-Luna through `codex exec` with an existing ChatGPT sign-in.

```powershell
npm run enrich:recalls:local -- --plan
npm run enrich:recalls:local -- --refresh
npm run enrich:recalls:local -- --refresh --backfill --source=FR_RAPPELCONSO
npm run cache:recall-images -- --plan
npm run cache:recall-images
```

The plan command reports the local queue. Use `--limit` to set the number of notices for a manual run. `--backfill` starts collection from the repository snapshot for the selected source. Each source keeps previously collected notices, and the worker saves validated classifications after each group of batches. A later run picks up missing results and changed source text. Low-confidence results and taxonomy gaps are marked for review.

The worker stores its files in `outputs/llm-classifier/local/`. `current.json` contains the local enriched dataset, `refresh-report.json` records source coverage and fetch warnings, and `scheduled-run.log` holds the most recent scheduled run log. The Windows task uses these local outputs. The website still uses the repository's committed data snapshot.

After collection, the scheduled run converts new official product photos to WebP locally with Sharp. The image cache also works as a standalone backfill and reuses files by original URL. Photos are resized to fit within 960 pixels on either side. The cache uses one WebP per photo for cards and detail pages. `image-cache-report.json` records failures and the dates they are eligible for another attempt. A local site build serves available files in `public/recall-images/cache/`. New cache files are ignored by Git until explicitly added for a release. To publish them through Cloudflare Pages, force-add the WebP files for the site snapshot to the deployment commit.

Run `npm run prepare:recall-site-snapshot` to prepare the next site build locally from a complete enrichment run. It retains existing recall URLs and writes the notice and classification snapshots in `data/processed/`. The website withholds AI classifications marked for review and displays the official notice fields. The scheduled task leaves the site snapshot untouched.
