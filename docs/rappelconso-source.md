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

## Phase 7.1 QA

Audit command:

```powershell
npm run audit:rappelconso
```

Audit method:

- Reads `data/processed/rappelconso-recalls.json`.
- Checks only local processed data; it does not call RappelConso or any external API.
- Reports missing fields, duplicate ids, slug collisions, category distribution, identifier availability, image availability, distribution details, official notice URL shape, long titles, and suspicious category mappings.

Current QA result:

- Source id: `FR_RAPPELCONSO`
- RappelConso records: 100
- Duplicate ids: 0
- Slug collisions: 0
- Missing source URLs: 0
- Missing titles: 0
- Missing recall dates: 0
- Missing product names: 0
- Missing brand names: 0
- Missing hazard/reason: 0
- Missing remedy/action: 40
- Records with images: 61
- Records with GTIN/barcode-like values: 37
- Records with lot/batch/code/date-like values: 52
- Records with distribution details: 60
- Records with official RappelConso notice URL shape: 100

Raw RappelConso category distribution:

- alimentation: 49
- automobiles et moyens de déplacement: 42
- bébés-enfants (hors alimentaire): 3
- autres: 2
- hygiène-beauté: 1
- sports-loisirs: 1
- vêtements, mode, epi: 1
- appareils électriques, outils: 1

Site category distribution after conservative mapping:

- food-allergy: 49
- general-consumer-product: 45
- baby-kids: 5
- household-appliance: 1
- battery-electronics: 0

Phase 7.1 fixes:

- Added `scripts/audit-rappelconso.ts` and `npm run audit:rappelconso`.
- Hardened French category mapping so automobile notices remain `general-consumer-product` until Recall Radar has a vehicle-specific category.
- Hardened appliance mapping so `appareils électriques, outils` records are not pulled into food/allergy just because a product name contains food-related words.
- Kept baby/kids mapping only for records with clear child, baby, toy, or childcare language.
- Updated the audit URL check to accept both RappelConso `/interne` and `/rapex` official notice paths.

## Deferred

- Full RappelConso backfill.
- Broader multilingual synonym expansion.
- Translation workflow.
- Runtime freshness checks.
- Deduplication across international sources.
- Additional country sources.
