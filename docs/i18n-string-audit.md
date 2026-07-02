# I18n String Audit

This audit identifies practical translation boundaries for a future multilingual UI. It is intentionally not a full string catalog.

## Header and Navigation

- Examples: app name, checker link, watchlist link, category links.
- Type: product UI.
- Safe to translate later: yes.
- Notes and risks: keep route paths, source filter values, and category ids stable unless a separate routing phase changes them.

## Homepage

- Examples: hero headline, search helper text, example search terms, category card labels, recall-board headings.
- Type: product UI with source-derived counts.
- Safe to translate later: mostly yes.
- Notes and risks: do not translate or alter source names, agency names, counts, or official coverage wording beyond approved product copy.

## Checker

- Examples: page title, search placeholder, filter labels, sort labels, date-window labels, search button, no-result guidance.
- Type: product UI.
- Safe to translate later: yes.
- Notes and risks: query parameters must stay stable: `q`, `source`, `category`, `sort`, and `date`. Source values must stay stable.

## Search Result Cards

- Examples: match badges, source/date row labels, detail link, generic verification disclaimer.
- Type: mixed product UI and source-derived recall fields.
- Safe to translate later: product UI only.
- Notes and risks: titles, hazards, remedies, brand names, product names, identifiers, and agency labels should remain source-traceable.

## Category Pages

- Examples: category headings, short descriptions, count labels, browse/search prompts.
- Type: product UI with source-derived notice counts.
- Safe to translate later: yes for UI labels and short product-owned copy.
- Notes and risks: category ids and conservative classification logic should not change as part of translation.

## Watchlist

- Examples: saved-search labels, saved-brand labels, demo-only alert text, remove/clear actions.
- Type: product UI.
- Safe to translate later: yes.
- Notes and risks: keep the browser storage key stable unless a migration plan is added. Do not imply server alerts or email delivery.

## Brand Pages

- Examples: page headings, related-recall section labels, raw/source-name helper copy.
- Type: mixed product UI and source-derived names.
- Safe to translate later: product UI only.
- Notes and risks: brand and company names should not be translated. Normalized display names should remain traceable to raw source names.

## Detail Pages

- Examples: report labels, summary field labels, what-to-check headings, related-recall headings, official source field labels.
- Type: mixed product UI and official source fields.
- Safe to translate later: labels and product-owned guidance only.
- Notes and risks: official title, hazard, remedy, reason, action, affected units, quantity, status, recall number, and identifiers must remain source-traceable.

## 404 Page

- Examples: page-not-found title, back/home links, search prompt.
- Type: product UI.
- Safe to translate later: yes.
- Notes and risks: no source-derived safety claims should be introduced.

## Footer and Disclaimer

- Examples: generic search disclaimer, official-notice verification guidance, coverage notes.
- Type: product UI and safety copy.
- Safe to translate later: yes, with careful review.
- Notes and risks: translated disclaimers must preserve the same safety meaning and must never imply complete coverage or safety confirmation.

## Buttons and Links

- Examples: view recall, browse recalls, search all notices, open watchlist, try example search.
- Type: product UI.
- Safe to translate later: yes.
- Notes and risks: link destinations and query parameters should remain unchanged.

## Empty States

- Examples: no clear match, no saved watchlist items, no related recalls.
- Type: product UI with safety implications.
- Safe to translate later: yes, with careful review.
- Notes and risks: no-result copy must still state that no clear match does not mean a product is safe or recall-free.

## Source Labels

- Examples: United States CPSC, United States FDA/openFDA, France RappelConso, Canada Recalls and Safety Alerts, European Union Safety Gate, United Kingdom FSA Food Alerts.
- Type: source display model.
- Safe to translate later: no by default.
- Notes and risks: source labels should stay centralized through `src/lib/recall-sources.ts`. If localized market labels are added later, agency names and source ids must remain stable.

## Category Labels

- Examples: Baby and kids, Batteries and electronics, Food and allergy, Household and appliance, Food, General.
- Type: product UI backed by internal category ids.
- Safe to translate later: yes.
- Notes and risks: translated labels must not alter classification behavior or search filter values.

## Audit and Launch Docs

- Examples: QA checklist, development handoff, launch checklist, source audit notes.
- Type: internal documentation, not consumer-facing UI.
- Safe to translate later: optional.
- Notes and risks: docs can remain English while UI localization evolves. Internal docs should keep exact script names, source ids, and command examples unchanged.
