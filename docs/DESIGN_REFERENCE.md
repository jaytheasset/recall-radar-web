# Homepage Design Reference

Phase 12A is a planning-only reference for the next homepage UI pass. It uses general template layout patterns only. Do not copy exact templates, assets, names, screenshots, code, or proprietary design from any builder or marketplace.

## 1. Current Homepage Problems

### Why the Current Homepage Feels Weak

- The page is short, but it still reads like stacked generated blocks rather than a polished consumer product site.
- The hero search is boxed like a utility form instead of behaving like the primary product interaction.
- The recall grid has useful content, but the cards feel cramped because source, date, title, hazard, and button all compete in a small vertical space.
- Product images are present, but the layout does not yet make them feel like the main browsing surface.
- The page rhythm is too even: hero, grid, categories, CTA all have similar visual weight, so there is no strong template-like hierarchy.
- Card styling is generic: border, shadow, radius, and spacing feel like default app cards rather than editorial/product catalog modules.
- The current visual system uses neutral colors, but the blue/orange badge treatment still creates a cheap dashboard feel in places.
- The CTA at the bottom is acceptable, but it should feel like a small footer module rather than another major page section.

### What Must Be Removed

- Any duplicate latest/recall sections.
- Any brand list section on the homepage.
- Long explanations, how-to blocks, trust rows, dashboard stat cards, or repeated data coverage badges.
- Paragraph descriptions inside homepage recall cards.
- Product, brand, remedy, or source details beyond the required card fields.
- Radar, scanner, signal, dashboard, or government-data-table language.
- Beige, amber-heavy, teal, cyan, or decorative gradient motifs.

### What Must Be Kept

- Header navigation.
- H1: "Check recalled products before they stay in your home"
- Short subheadline: "Search local CPSC and FDA/openFDA recall records by product, brand, model, UPC, lot code, or keyword."
- One muted count line: "801 indexed recall notices from 6 official source feeds"
- Strong search path to `/checker`.
- CPSC/FDA source labels where recall cards appear.
- Real CPSC product images where available.
- Exactly four category entry cards.
- Compact browser-based watchlist CTA.
- No claim that a product is safe.

## 2. Template Pattern Research Summary

### Ecommerce/Product Template Patterns

- Lead with a strong search or product discovery control, not explanatory text.
- Use image-first product cards with consistent image ratios and minimal text.
- Keep product grids visually calm: white cards, clear hover state, tight metadata, strong product title.
- Use one featured product module to anchor the page before showing a grid.
- Keep category cards compact and scannable with short labels and counts.

Relevant pattern to adapt: a product catalog home page where search and product images are the primary interaction.

### Magazine/Media Template Patterns

- Establish hierarchy with one featured story/card and a smaller grid below.
- Use editorial spacing: fewer sections, stronger section headers, and visible whitespace between modules.
- Avoid making every card equal; the featured item should create the first visual hook.
- Clamp titles and summaries so cards stay aligned.

Relevant pattern to adapt: one lead story plus a latest-stories grid, but applied to recall records.

### Business Landing Template Patterns

- Use confident, restrained type and a focused hero.
- Keep the primary call to action obvious and above the fold.
- Use proof/data as one quiet line, not as cards.
- Keep bottom CTA small and direct.
- Use premium neutral surfaces: white, near-white, black/navy text, subtle borders, and a single serious accent.

Relevant pattern to adapt: a trustworthy consumer landing page, not a dashboard.

## 3. Final Homepage Wireframe

### Section 1: Header

- Sticky or simple top header.
- Left: Recall Radar wordmark.
- Right: existing nav links.
- Keep header slim; it should not dominate the first viewport.

### Section 2: Hero Search

- Two-column desktop layout, one-column mobile.
- Left column:
  - H1.
  - Short subheadline.
  - One muted count line.
- Right column:
  - Search module that looks like a large product search bar.
  - The input and primary button should sit inside a single strong white surface.
  - Example searches may remain, but they must be small text links or chips under the search.
- No image grid, stats cards, trust badge row, or decorative motifs in the hero.

### Section 3: Featured Recall Row

- One featured recall only.
- Use the most recent recall with a usable product image when possible.
- Desktop layout:
  - Large image on one side.
  - Title, source/date, one-line hazard, and View recall button on the other.
- Mobile layout:
  - Image above text.
- This section should make the site feel image-led before the standard grid.

### Section 4: Latest Recall Grid

- Show exactly 6 latest recall cards.
- If the featured recall is also one of the latest records, either exclude it from the six-card grid or keep the grid to the next six records. Do not show duplicate cards in immediate sequence.
- Three columns on desktop, two on tablet, one on mobile.
- Cards must be short, aligned, image-first, and consistent.

### Section 5: Category Entry Cards

- Four compact cards only:
  - Baby & Kids
  - Batteries & Electronics
  - Food & Allergy
  - Household Products
- Each card shows title, one-line description, count, and Browse link.
- No product examples inside category cards.
- This section should feel like navigation, not content marketing.

### Section 6: Watchlist CTA

- Small white or soft-gray panel.
- Text:
  - "Monitor saved searches in this browser"
  - "No account or email alerts are enabled yet."
- Buttons:
  - Open watchlist
  - Try pistachio
- Keep it compact; do not use a huge black block.

## 4. Homepage Rules

- No duplicate latest sections.
- No paragraph descriptions in homepage cards.
- Max 6 latest recall cards.
- No featured recall section on the current homepage baseline.
- Search must be visually dominant.
- Product imagery must be visually important.
- Category section must be compact.
- Footer/CTA must be minimal.
- No dashboard stat cards.
- No radar, scan, signal, map, monitor-room, or government-table metaphor.
- No beige, amber-heavy, teal, or cyan palette.
- Do not change checker, watchlist, detail, brand, category, data, or fetch behavior in the next UI pass.

## 5. Visual Style Guide

### Color Tokens

- Background: `#F7F8FA`
- Surface: `#FFFFFF`
- Surface soft: `#F3F5F7`
- Text: `#111827`
- Muted text: `#667085`
- Accent: `#0F172A`
- Accent hover: `#020617`
- Danger: `#D92D20`
- Danger soft: `#FEE4E2`
- Source chip background: `#F2F4F7`
- Border: `#E5E7EB`

### Layout

- Page width: `min(1180px, calc(100% - 2rem))`
- Hero vertical padding desktop: `56px` top, `36px` bottom.
- Hero vertical padding mobile: `28px` top, `20px` bottom.
- Section vertical padding: `28px` desktop, `20px` mobile.
- Grid gap: `18px` desktop, `14px` mobile.

### Cards

- Card radius: `20px` for featured/search surfaces.
- Product card radius: `18px`.
- Category card radius: `16px`.
- Card border: `1px solid #E5E7EB`.
- Card shadow: `0 18px 45px rgba(17, 24, 39, 0.08)`.
- Hover shadow: `0 24px 60px rgba(17, 24, 39, 0.12)`.
- Do not use nested cards.

### Images

- Featured recall image aspect ratio: `16 / 10`.
- Latest recall card image aspect ratio: `4 / 3`.
- Use `object-fit: contain` for official CPSC product images.
- Image background: `#F8FAFC`.
- FDA records without images should use a quiet placeholder, not a large decorative block.

### Buttons

- Primary button background: `#0F172A`.
- Primary button hover: `#020617`.
- Primary button text: `#FFFFFF`.
- Radius: `12px`.
- Height: `44px` minimum, `48px` in hero search.
- Use danger red only for small recall/hazard emphasis, not large CTA backgrounds.

### Typography

- Font stack: existing system sans stack.
- H1 desktop: `clamp(2.4rem, 5vw, 4.6rem)`.
- H1 mobile: `clamp(2.1rem, 11vw, 3rem)`.
- Hero lead: `1.05rem` to `1.2rem`.
- Section heading: `1.45rem` to `2rem`.
- Card title: `0.98rem`, line-height `1.2`, max 2 lines.
- Card metadata: `0.74rem` to `0.78rem`.
- Hazard line: `0.84rem`, max 1 line.

## 6. Recall Card Spec

Homepage recall cards must show only:

- Product image.
- Source/date row.
- Title, max 2 lines.
- Hazard, max 1 line.
- View recall button.

Homepage recall cards must not show:

- Description paragraph.
- Remedy.
- Affected units.
- Product list.
- Brand/company paragraph.
- Official source link.
- More than two metadata chips.

## 7. Search Module Spec

- The search module should look like a product search bar, not a small form box.
- The input and button should appear as one unified search surface.
- The input should be visually wider than the button.
- The button should be strong black/navy.
- Label text should be minimal; placeholder text can carry examples.
- Example searches should sit below the search surface as small secondary links.
- Search should be the dominant interaction in the hero.

## 8. Implementation Checklist for Next Phase

Edit only:

- `src/pages/index.astro`
- `src/styles/global.css`

Do not edit:

- `src/pages/checker.astro`
- `src/pages/watchlist.astro`
- `src/pages/recalls/[slug].astro`
- `src/pages/brands/[brand].astro`
- category pages
- `data/processed/recalls.json`
- fetch scripts
- package files

Next implementation steps:

- Add one featured recall module before the six-card latest grid.
- Keep latest grid to six cards and avoid duplicating the featured item.
- Rework hero search markup so it reads as a single large search surface.
- Add homepage-scoped CSS classes instead of changing shared page behavior.
- Replace orange/amber date treatment on homepage with neutral source/date chips.
- Tighten vertical spacing across homepage sections.
- Keep watchlist CTA compact.
- Run `npm run check` and `npm run build`.
