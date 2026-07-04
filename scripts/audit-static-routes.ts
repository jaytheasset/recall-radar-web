// @ts-nocheck
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const distRoot = join(process.cwd(), 'dist');

const requiredRoutes = [
  '/',
  '/checker',
  '/watchlist',
  '/baby-product-recalls',
  '/battery-recalls',
  '/food-allergy-recalls',
  '/household-product-recalls',
  '/us-product-recalls',
  '/canada-product-recalls',
  '/eu-safety-gate-recalls',
  '/france-product-recalls',
  '/uk-food-recalls',
  '/australia-product-recalls',
  '/brands/aldi',
  '/404',
  '/robots.txt',
  '/recalls/17-stories-furniture-14-drawer-dressers-tip-over-and-entrapment-hazards-cpsc-26323',
  '/recalls/003020-sour-cream-and-onion-net-wt-10-lbs-jcb-flavors-1224-clark-st-fda-h-0887-2026',
  '/recalls/acps-oris-attelage-remorque-pour-citroen-berlingo-ou-peugeot-partner-fr-rappelconso-2026-06-0226',
  '/recalls/9227-8712-quebec-inc-brand-and-l-erabeille-brand-pure-maple-syrup-ca-recalls-82260',
  '/recalls/abirdon-teething-toy-safety-gate-alert-eu-safety-gate-10099469',
  '/recalls/3d-trading-m-and-m-s-pipoca-popcorn-because-of-undeclared-allergens-uk-fsa-fsa-aa-20-2026',
  '/recalls/12-lcd-writing-tablet-au-product-safety-12-lcd-writing-tablet'
];

function routeToDistPath(route: string): string {
  if (route === '/') {
    return join(distRoot, 'index.html');
  }

  if (route === '/404') {
    return join(distRoot, '404.html');
  }

  if (route.endsWith('.txt')) {
    return join(distRoot, route.slice(1));
  }

  return join(distRoot, route.slice(1), 'index.html');
}

const routeChecks = requiredRoutes.map((route) => {
  const distPath = routeToDistPath(route);

  return {
    route,
    distPath,
    exists: existsSync(distPath)
  };
});

const missingRoutes = routeChecks.filter((check) => !check.exists);

const result = {
  passed: missingRoutes.length === 0,
  checkedRoutes: routeChecks.length,
  missingRoutes: missingRoutes.map((check) => check.route),
  routes: routeChecks
};

console.log(JSON.stringify(result, null, 2));

if (!result.passed) {
  process.exit(1);
}
