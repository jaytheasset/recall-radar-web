# Multilingual Search Foundation

Recall Radar currently keeps the product UI in English and preserves official recall fields in the language and wording supplied by each source. Phase 28 adds a search-only alias layer so users can enter common Korean, Japanese, French, or English recall terms while still matching against the existing official record fields.

## Why Search Comes First

Multilingual search helps users discover relevant notices before the site has locale routes or translated pages. It is lower risk than translating detail pages because it does not rewrite official titles, hazards, remedies, identifiers, dates, or source notices.

## Source Text Policy

Official source text remains source-authentic. The alias layer is used only for matching queries to indexed records. Recall cards and detail pages continue to show the official source-derived fields already stored by Recall Radar.

## Alias Dictionary Approach

The alias dictionary is curated and intentionally small. It focuses on practical recall-search terms such as power banks, chargers, batteries, fire/burn hazards, allergens, pistachio, baby sleepers, toys, appliances, choking, falls, and recall/alert terms.

Aliases are not full translations. They are query expansions that help a non-English query match existing English or French terms in official records.

## Identifier Search Policy

Exact identifiers remain searchable through the normal record text:

- UPC, GTIN, EAN, and barcode values.
- Model, item, SKU, serial, lot, and batch codes.
- Recall numbers, alert references, Safety Gate references, and FSA references.

The search helper normalizes punctuation and hyphens for matching but does not mutate stored records.

## Unsupported In This Phase

- No `/ko`, `/ja`, or `/fr` routes.
- No translated recall detail pages.
- No translated official source fields.
- No generated summaries.
- No LLM translation.
- No backend search service.
- No database.
- No source refresh or backfill.
- No new sources or countries.

## Future Path

1. UI locale switch.
2. Korean UI strings.
3. Korean source/category landing pages.
4. Clearly labeled translated summaries for selected recalls.
5. Full multilingual SEO rollout in small, auditable chunks.
