# Cloudflare Pages Deployment

## Build Settings

| Setting | Value |
| --- | --- |
| Framework | Astro static site |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root |

The project does not declare a Node `engines` version. Local validation for this branch used Node `v24.15.0`. Select a Cloudflare-supported Node LTS version for the Pages project and verify the same build command succeeds there before pinning a version in the repository.

## Cloudflare Pages Setup

1. Create a Pages project from the Recall Radar repository and select the intended production branch.
2. Set the root directory to the repository root.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Leave build-time data refresh commands disabled. Deployment builds use the committed processed recall data.
6. Do not add `PUBLIC_ADSENSE_CLIENT` or `PUBLIC_ADSENSE_HOME_SLOT` before the AdSense approval step.
7. Do not add a real Gemini or other private API key for this static deployment.

## Post-Deploy URL Checklist

After Cloudflare Pages provides the public URL, verify:

- `/` loads and search links to `/checker`.
- `/checker` loads, accepts a query, and preserves filter parameters in the URL.
- `/about`, `/privacy`, and `/contact` return successful pages.
- One recall detail page and one country/source page load with their official source links.
- Footer links to About, Privacy, and Contact are present.
- The deployed HTML does not contain `pagead2`, `ca-pub-`, or `data-ad-client` before AdSense approval.
- No browser console errors, broken images, or horizontal overflow at a 390px viewport.

## Before Enabling Ads

Complete the approval preparation checklist in `docs/MONETIZATION_SETUP.md`, set a real `PUBLIC_CONTACT_EMAIL`, and complete consent-management work before enabling personalised advertising for applicable regions.
