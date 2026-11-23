# Monetization Setup

## Current behavior

Recall Radar has one manual AdSense placement on the homepage after the latest recall cards. It renders only when both of these public build variables are valid:

```text
PUBLIC_ADSENSE_CLIENT=ca-pub-...
PUBLIC_ADSENSE_HOME_SLOT=...
```

Without both values, the site emits no ad loader, ad markup, or empty ad container. Ownership verification uses the homepage `google-adsense-account` meta tag and `/ads.txt`. Both use the publisher confirmed for `recall-radar.app` or the same valid `PUBLIC_ADSENSE_CLIENT` override if the account changes.

Cloudflare Pages uses `npm run build` and publishes `dist`. Do not configure either AdSense environment variable before the approval step.

The current placement deliberately excludes recall detail pages and the recall checker. Do not put ads beside official notices, consumer-action instructions, or the `What to check` section.

## AdSense activation checklist

1. Get the site approved in AdSense.
2. Create a responsive display ad unit for the homepage.
3. Put the publisher client and home ad slot values in the deployment environment.
4. Confirm the deployed `ads.txt` matches the publisher record in the AdSense site dashboard.
5. Configure a Google-certified CMP before serving personalised ads to users in the EEA, United Kingdom, or Switzerland.
6. Verify the live page has one AdSense script and one configured ad unit, with no layout shift when an ad does not fill.

Google distinguishes the publisher-wide AdSense code from the code for each ad unit. See the [Google AdSense code guide](https://support.google.com/adsense/answer/9274019?hl=en-GB) and [consent requirements for publishers](https://support.google.com/adsense/answer/13554116?hl=en-GB).

## Approval prep checklist

1. Review `/about`, `/privacy`, and `/contact` on the production domain.
2. Confirm `/contact` shows the monitored `recall-radar@jtheasset.com` address and `/privacy` explains Google’s advertising data practices.
3. Keep the footer links to About, Privacy, and Contact visible on public pages.
4. Confirm public pages do not present development-only wording such as local demo, sample, mock, or test content.
5. Confirm Google can read `/ads.txt` or the homepage meta tag, then request review from the `recall-radar.app` entry. Leave ad serving off until approval.

## Amazon Associates

Do not place Amazon links directly beside a recall action or label an item as a safe replacement. Product suitability must not be inferred from a recall notice.

Amazon links should be introduced only on separate safety buying-guide pages with editorially selected products and a storefront-specific Associate tag. Each page that contains Amazon Program Content must visibly state:

> As an Amazon Associate I earn from qualifying purchases.

For a global product, configure Associate tags only for storefronts where Recall Radar is enrolled. The required disclosure and relationship limits are set out in the [Amazon Associates Operating Agreement](https://affiliate-program.amazon.com/help/operating/agreement/).

## Deferred

- Consent-management implementation until a certified CMP is selected.
- Amazon product cards and links until guides, product selection, and market-specific Associate tags are approved.
