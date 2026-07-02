# I18n Foundation

Phase 15 creates the planning foundation for future multilingual UI support. It does not change the current launch UI, routes, search behavior, source records, slugs, filters, or build output.

## A. Current State

- The current launch UI is English-only.
- Recall notices are indexed from official source feeds and displayed with source attribution.
- Source text can include English, French, and other official source-language fields depending on the agency feed.
- The app does not have locale routes, locale-specific search indexes, browser language detection, IP redirects, translated slugs, or translated source records.
- The app does not run translation, summarization, or LLM rewriting against official notice fields.

## B. Core Policy

Recall Radar can translate product UI later, but it must not present translated or generated text as official recall source truth.

Future translated UI should be treated as interface assistance only. Users should still verify affected models, lots, dates, distribution, and remedies with the official notice.

## C. What Can Translate Later

These product-owned UI strings can be translated in future phases:

- Navigation labels.
- Homepage hero copy and search prompts.
- Checker form labels, filter labels, sort labels, and empty-state helper copy.
- Generic button labels such as `View recall`, `Browse recalls`, and `Search all notices`.
- Category display names and short category descriptions.
- Watchlist demo labels.
- Error page copy.
- Generic safety disclaimers written by Recall Radar.

These translations should live in a typed message layer and should not change source ids, URL slugs, query parameters, or record matching behavior.

## D. What Must Not Be Automatically Translated As Source Truth

The following fields must not be automatically translated or rewritten as if they were official source text:

- Official recall title.
- Official hazard, risk, reason, remedy, action, distribution, quantity, and status fields.
- Official product, brand, model, GTIN, UPC, lot, batch, serial, date-code, recall-number, and alert-reference fields.
- Raw source payload fields.
- Official source agency names and official notice links.
- Any text quoted or closely paraphrased from an official notice.

If future translation assistance is added, it must be clearly labeled as non-official assistance and must keep the original source field available nearby.

## E. Future Locale Strategy

Potential future UI locales:

- `en` English.
- `ko` Korean.
- `ja` Japanese.
- `fr` French.
- `de` German.
- `es` Spanish.

For now, only `en` is supported in code. Additional locale values should not be added until the routing, SEO, QA, and translation workflow are ready.

## F. Future Routing Strategy

Recommended future approach: path-prefix locale routes such as `/en`, `/ko`, `/ja`, `/fr`, `/de`, and `/es`.

Do not implement locale routes in this phase. Future routing should preserve stable recall detail paths, source ids, source filters, and query parameter semantics. If localized routes are introduced later, redirects and canonical rules need an explicit SEO plan before launch.

## G. SEO Policy

SEO internationalization is deferred.

Future work should define:

- Canonical URL behavior for each locale.
- `hreflang` mappings.
- Sitemap generation by locale.
- Default-locale handling.
- Whether source-language pages and translated UI pages share the same detail URL or use locale-prefixed paths.

No canonical, sitemap, or `hreflang` implementation is part of Phase 15.

## H. Source Language Display Policy

Official source fields should remain in the language and wording supplied by the agency feed unless a future phase adds a clearly labeled translation layer.

If an official notice is in French, English, or another language, Recall Radar should preserve the original source-language field and link to the official notice. Product-owned UI around that field may be translated later, but the source field itself should remain auditable.

## I. Future LLM Translation Policy

LLM translation and summary features are deferred.

Before using an LLM for translation or summaries, define:

- Clear labels distinguishing official source text from generated assistance.
- A way to view the original source field.
- A review strategy for safety-critical wording.
- A refusal/uncertainty policy for incomplete or ambiguous source fields.
- A no-invention rule for model numbers, UPC/barcode values, lots, dates, remedies, and affected markets.

LLM output must never be treated as the official notice.

## J. Deferred Items

- Korean, Japanese, French, German, and Spanish UI.
- Locale routes.
- Browser language detection.
- IP-based redirects.
- `hreflang`.
- Localized sitemap generation.
- Translated slugs or URLs.
- Translation of source records.
- LLM translation or summarization.
- Locale-specific search indexes.
- New source feeds, backend services, databases, email, push notifications, or PWA behavior.
