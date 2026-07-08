import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTED_LOCALES,
  localeOptions,
  messages,
  productFamilyI18nKeys,
  type MessageKey,
  type SupportedLocale
} from '../src/lib/i18n.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cssPath = resolve(projectRoot, 'src/styles/global.css');

const requiredUiKeys: MessageKey[] = [
  'nav.checker',
  'nav.productTypes',
  'nav.countries',
  'nav.watchlist',
  'home.hero.line1',
  'home.hero.line2',
  'home.searchButton',
  'home.trust',
  'directory.productTypesTitle',
  'directory.countriesTitle',
  ...Object.values(productFamilyI18nKeys)
];

const cjkLocales: SupportedLocale[] = ['ko', 'ja', 'zh'];
const disallowedVisibleFragments = ['</span', '<span', 'undefined', 'null', '\uFFFD'];

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function hasCjk(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(value);
}

const failures: string[] = [];
const warnings: string[] = [];

for (const locale of SUPPORTED_LOCALES) {
  const localeMessages = messages[locale];

  for (const key of requiredUiKeys) {
    const value = localeMessages[key]?.trim();

    if (!value) {
      failures.push(`${locale}.${key} is missing or empty.`);
      continue;
    }

    const badFragment = disallowedVisibleFragments.find((fragment) => value.includes(fragment));
    if (badFragment) {
      failures.push(`${locale}.${key} contains suspicious visible text: ${badFragment}`);
    }
  }
}

for (const locale of cjkLocales) {
  const title = messages[locale]['directory.productTypesTitle'];
  const countryTitle = messages[locale]['directory.countriesTitle'];
  const familyLabels = Object.values(productFamilyI18nKeys).map((key) => messages[locale][key]);

  if (!hasCjk(title)) {
    failures.push(`${locale}.directory.productTypesTitle does not contain CJK text.`);
  }

  if (!hasCjk(countryTitle)) {
    failures.push(`${locale}.directory.countriesTitle does not contain CJK text.`);
  }

  for (const label of familyLabels) {
    if (!hasCjk(label)) {
      warnings.push(`${locale} product family label remains non-CJK: ${label}`);
    }
  }
}

for (const option of localeOptions) {
  if (!option.label.trim()) {
    failures.push(`${option.value} language option label is empty.`);
  }

  const badFragment = disallowedVisibleFragments.find((fragment) => option.label.includes(fragment));
  if (badFragment) {
    failures.push(`${option.value} language option label contains suspicious visible text: ${badFragment}`);
  }
}

const css = await readFile(cssPath, 'utf8');

const requiredCssFragments = [
  'html:lang(ko)',
  'html:lang(ja)',
  'html:lang(zh)',
  'word-break: keep-all',
  'line-break: strict',
  '.directory-hero h1'
];

for (const fragment of requiredCssFragments) {
  if (!css.includes(fragment)) {
    failures.push(`global.css is missing multilingual layout rule fragment: ${fragment}`);
  }
}

if (/\.directory-hero h1\s*\{[^}]*max-width:\s*11ch/s.test(css)) {
  failures.push('directory hero heading is still constrained to 11ch.');
}

const summary = {
  passed: failures.length === 0,
  locales: SUPPORTED_LOCALES,
  auditedKeys: unique(requiredUiKeys).length,
  productFamilyLabels: Object.keys(productFamilyI18nKeys).length,
  warnings,
  failures
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
