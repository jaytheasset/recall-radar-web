# USDA FSIS Integration Deferred

USDA FSIS recall/public health alert integration was attempted locally during Phase 6.

The official USDA FSIS endpoint returned HTTP `403 Forbidden` / `Access Denied` from the local environment. No USDA raw data, USDA processed data, or canonical merged USDA records were written.

USDA integration is deferred for the local MVP.

## Likely cause

The FSIS Recall API exists and is publicly documented, but the documented endpoint previously returned HTTP `403 Forbidden` / `Access Denied` during local testing. This likely indicates FSIS-side access control, CDN/WAF filtering, User-Agent/header filtering, IP/range filtering, or temporary endpoint restrictions.

No USDA data was written, and no bypass attempt should be made.

## Future options

- Retry later from a normal browser/manual test.
- Contact FSIS/webmaster or look for official access guidance.
- Use FSIS RSS/public pages only if allowed and documented.
- Keep USDA FSIS out of the MVP and continue with the existing local CPSC and FDA/openFDA data sources.
- Add USDA only after stable official access is confirmed.
