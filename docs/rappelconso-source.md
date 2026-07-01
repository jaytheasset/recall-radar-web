# France RappelConso Source Spike

France RappelConso is the first non-U.S. official source spike in Recall Radar.

## Source

Official references:

- RappelConso open data support: `https://rappel.conso.gouv.fr/support/open-data`
- data.gouv dataset: `https://www.data.gouv.fr/datasets/rappelconso-v2-rappels-de-produits/`
- data.gouv GTIN dataset: `https://www.data.gouv.fr/datasets/rappelconso-v2-produits-tries-par-gtin/`

The implementation uses the RappelConso V2 GTIN-spaced dataset exposed through the data.economie.gouv.fr records endpoint:

`https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records`

## Ingestion Method

The local fetch script is:

```powershell
npm run fetch:rappelconso
```

Default behavior:

- Fetches the 100 most recent records ordered by `date_publication desc`.
- Saves a bounded raw wrapper to `data/raw/rappelconso-recalls.json`.
- Normalizes records to `data/processed/rappelconso-recalls.json`.
- Rebuilds `data/processed/recalls.json`.
- Refuses to overwrite processed output when zero records are returned.

The limit is configurable:

```powershell
npm run fetch:rappelconso -- --limit=50
```

The source endpoint is also configurable for future data.gouv changes:

```powershell
npm run fetch:rappelconso -- --url=https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records
```

To rebuild processed data from the saved raw file:

```powershell
npm run normalize:rappelconso
```

## Source Model

Source id:

`FR_RAPPELCONSO`

Display label:

`France · RappelConso`

Current bounded spike:

- 100 RappelConso records
- Static/local processed data only
- No browser runtime API call
- No backend, database, email, account, LLM, notification, or product registration feature

## Mapped Fields

RappelConso fields are mapped into the existing `NormalizedRecall` shape:

- `numero_fiche`, `rappel_guid`, or `id` -> stable id and `recallNumber`
- `lien_vers_la_fiche_rappel` -> `sourceUrl`
- `date_publication` -> `recallDate`
- `categorie_produit` / `sous_categorie_produit` -> source category text
- `marque_produit` -> `brandNames`
- `libelle` / `modeles_ou_references` -> `productNames`
- `identification_produits` -> searchable product identifier text
- `motif_rappel` / `risques_encourus` -> reason and hazard
- `conduites_a_tenir_par_le_consommateur` / `modalites_de_compensation` -> remedy/action
- `conditionnements` -> affected units or product quantity where useful
- `zone_geographique_de_vente` / `distributeurs` -> distribution details
- `liens_vers_les_images` -> official RappelConso image links when safe to display
- original raw record -> `raw`

## Known Limitations

- French source text remains French.
- GTIN/barcode availability depends on the source record.
- Not all records have structured identifiers.
- Images and distributor links may be incomplete.
- RappelConso data is included as a bounded local processed spike, not as live runtime coverage.
- Category mapping is conservative and may classify some French product types as general consumer products until expanded.
- The current script fetches a limited recent slice by default to avoid silently generating thousands of static pages.

## Deferred

- Full RappelConso backfill.
- Broader multilingual synonym expansion.
- Translation workflow.
- Runtime freshness checks.
- Deduplication across international sources.
- Additional country sources.
