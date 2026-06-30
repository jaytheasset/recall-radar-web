# USDA FSIS Integration Deferred

USDA FSIS recall/public health alert integration was attempted locally during Phase 6.

The official USDA FSIS endpoint returned HTTP `403 Forbidden` / `Access Denied` from the local environment. No USDA raw data, USDA processed data, or canonical merged USDA records were written.

USDA integration is deferred for the local MVP.

Future options:

- Retry the official USDA FSIS endpoint later.
- Use an officially documented access method if USDA FSIS provides one.
- Keep USDA FSIS out of the MVP and continue with the existing local CPSC and FDA/openFDA data sources.
