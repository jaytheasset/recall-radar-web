import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAFETYKOREA_AUTH_HEADER_NAME,
  buildDomesticRecallDetailUrl,
  buildDomesticRecallListUrl,
  buildSafetyKoreaHeaders,
  getSafetyKoreaAuthKey,
  isOfficialSafetyKoreaImageUrl,
  mapSafetyKoreaDomesticRecallDraft,
  mapSafetyKoreaDraftCategory,
  normalizeSafetyKoreaDate,
  sanitizeSafetyKoreaText,
  splitSafetyKoreaImageUrls,
  type SafetyKoreaDomesticRecallRaw
} from './korea-safetykorea-api-contract.ts';

type FixtureFile = {
  domesticRecallListSample?: {
    resultCode?: unknown;
    resultMsg?: unknown;
    resultCount?: unknown;
    items?: unknown;
  };
  domesticRecallDetailSample?: {
    resultCode?: unknown;
    resultMsg?: unknown;
    item?: unknown;
  };
};

type AuditSummary = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  fixture: {
    listSampleCount: number;
    detailSampleImages: number;
    detailSampleOfficialImages: number;
  };
  requestBuilders: {
    listEndpoint: string;
    detailEndpoint: string;
    authHeaderName: string;
  };
  draft: {
    id: string;
    source: string;
    title: string;
    category: string;
    recallDate: string;
    productNames: string[];
    brandNames: string[];
    identifiers: string[];
    images: number;
    proposedSlug: string;
  };
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixturePath = resolve(projectRoot, 'data/samples/korea-safetykorea-domestic-recall-samples.json');

function assertCondition(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function visibleDraftText(draft: ReturnType<typeof mapSafetyKoreaDomesticRecallDraft>): string {
  return [
    draft.title,
    draft.category,
    draft.hazard,
    draft.remedy,
    draft.affectedUnits,
    draft.description,
    draft.recallNumber,
    ...draft.productNames,
    ...draft.brandNames,
    ...draft.identifiers,
    ...draft.images.map((image) => `${image.url} ${image.caption ?? ''} ${image.alt ?? ''}`)
  ].join(' ');
}

function hasRawHtmlLeakage(value: string): boolean {
  return /<script\b|<style\b|<\/?[a-z][^>]*>|&(?:lt|gt|nbsp|quot|#039|apos);/i.test(value);
}

function hasMojibake(value: string): boolean {
  return /�|ì|í|ë|ê|ã|Â|媛|猷|쨌/.test(value);
}

async function readFixture(): Promise<FixtureFile> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as FixtureFile;
}

async function runAudit(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  let fixture: FixtureFile | null = null;

  try {
    fixture = await readFixture();
  } catch (error) {
    blockers.push(`Fixture missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  const listItems = Array.isArray(fixture?.domesticRecallListSample?.items)
    ? (fixture.domesticRecallListSample.items as SafetyKoreaDomesticRecallRaw[])
    : [];
  const detailItem = asObject(fixture?.domesticRecallDetailSample?.item) as SafetyKoreaDomesticRecallRaw;
  const draft = mapSafetyKoreaDomesticRecallDraft(detailItem);
  const visibleText = visibleDraftText(draft);
  const listUrl = buildDomesticRecallListUrl({ conditionKey: 'all', conditionValue: '' });
  const detailUrl = buildDomesticRecallDetailUrl('SKR-SAMPLE-0001');
  const headersWithoutKey = buildSafetyKoreaHeaders(undefined);
  const headersWithKey = buildSafetyKoreaHeaders('sample-auth-key');
  const officialImages = draft.images.filter((image) => isOfficialSafetyKoreaImageUrl(image.url));

  assertCondition(Boolean(fixture), 'Fixture file could not be loaded.', blockers);
  assertCondition(listItems.length >= 2, 'Fixture list sample must include at least two records.', blockers);
  assertCondition(draft.recallUid === 'SKR-SAMPLE-0001', 'recallUid did not map from detail fixture.', blockers);
  assertCondition(draft.id === 'kr-safetykorea-skr-sample-0001', 'Draft id did not preserve stable recallUid mapping.', blockers);
  assertCondition(draft.source === 'KR_SAFETYKOREA', 'Draft source marker is wrong.', blockers);
  assertCondition(draft.recallDate === '2024-06-03', 'publishDate did not normalize to YYYY-MM-DD.', blockers);
  assertCondition(draft.category === 'baby-kids', 'Korean child-product category did not map to baby-kids.', blockers);
  assertCondition(draft.productNames.includes('어린이 전동완구'), 'Korean product name was not preserved.', blockers);
  assertCondition(draft.brandNames.includes('샘플브랜드'), 'Korean brand name was not preserved.', blockers);
  assertCondition(/[가-힣]/.test(visibleText), 'Draft visible fields do not contain preserved Korean text.', blockers);
  assertCondition(!hasMojibake(visibleText), 'Draft visible fields contain mojibake-like text.', blockers);
  assertCondition(!hasRawHtmlLeakage(visibleText), 'Draft visible fields contain raw HTML leakage.', blockers);
  assertCondition(draft.images.length === 2, 'recallFiles image extraction did not produce the expected two product images.', blockers);
  assertCondition(officialImages.length === draft.images.length, 'Draft image output includes a non-official SafetyKorea image host.', blockers);
  assertCondition(!draft.images.some((image) => /logo|icon|banner/i.test(image.url)), 'Logo/icon/banner image was not filtered.', blockers);
  assertCondition(draft.images.every((image) => image.caption && !/\.(?:png|jpe?g)$/i.test(image.caption)), 'Image caption filtering failed.', blockers);
  assertCondition(
    listUrl.toString() ===
      'http://www.safetykorea.kr/openapi/api/recall/recallList.json?conditionKey=all&conditionValue=',
    'Domestic recall list URL builder output is wrong.',
    blockers
  );
  assertCondition(
    detailUrl.toString() ===
      'http://www.safetykorea.kr/openapi/api/recall/recallDetail.json?recallUid=SKR-SAMPLE-0001',
    'Domestic recall detail URL builder output is wrong.',
    blockers
  );
  assertCondition(SAFETYKOREA_AUTH_HEADER_NAME === 'AuthKey', 'AuthKey header name changed.', blockers);
  assertCondition(!(SAFETYKOREA_AUTH_HEADER_NAME in headersWithoutKey), 'AuthKey header should be omitted when no key is present.', blockers);
  assertCondition(headersWithKey[SAFETYKOREA_AUTH_HEADER_NAME] === 'sample-auth-key', 'AuthKey header was not set correctly.', blockers);
  assertCondition(getSafetyKoreaAuthKey({}) === undefined, 'Missing SAFETYKOREA_API_KEY should not fail helper usage.', blockers);
  assertCondition(normalizeSafetyKoreaDate('2024.06.04') === '2024-06-04', 'Dot-separated date parsing failed.', blockers);
  assertCondition(normalizeSafetyKoreaDate('20240605') === '2024-06-05', 'Compact date parsing failed.', blockers);
  assertCondition(sanitizeSafetyKoreaText('<b>어린이제품</b>&nbsp;') === '어린이제품', 'Sanitizer did not preserve Korean text while removing HTML.', blockers);
  assertCondition(
    splitSafetyKoreaImageUrls('https://www.safetykorea.kr/a.jpg;https://office.safetykorea.kr/b.png').length === 2,
    'Image URL splitter failed on semicolon-separated URLs.',
    blockers
  );

  const electricCategory = mapSafetyKoreaDraftCategory({
    categoryName: '전기용품',
    productItemName: '생활가전',
    recallProductName: '가정용 전기찜기'
  });
  const householdCategory = mapSafetyKoreaDraftCategory({
    categoryName: '생활용품',
    productItemName: '주방용품',
    recallProductName: '가정용 조리도구'
  });
  const foodCategory = mapSafetyKoreaDraftCategory({
    categoryName: '식품',
    productItemName: '가공식품',
    recallProductName: '샘플 식품'
  });

  assertCondition(electricCategory.category === 'battery-electronics', 'Electrical category draft mapping failed.', blockers);
  assertCondition(householdCategory.category === 'household-appliance', 'Household category draft mapping failed.', blockers);
  assertCondition(foodCategory.category === 'general-consumer-product', 'Food-like SafetyKorea draft mapping should stay conservative.', blockers);
  assertCondition(foodCategory.notes.length > 0, 'Food-like SafetyKorea draft mapping should include a warning note.', blockers);

  if (!getSafetyKoreaAuthKey()) {
    warnings.push('SAFETYKOREA_API_KEY is not set; live Korea probe remains disabled by design.');
  }

  const summary: AuditSummary = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    fixture: {
      listSampleCount: listItems.length,
      detailSampleImages: draft.images.length,
      detailSampleOfficialImages: officialImages.length
    },
    requestBuilders: {
      listEndpoint: listUrl.toString(),
      detailEndpoint: detailUrl.toString(),
      authHeaderName: SAFETYKOREA_AUTH_HEADER_NAME
    },
    draft: {
      id: draft.id,
      source: draft.source,
      title: draft.title,
      category: draft.category,
      recallDate: draft.recallDate,
      productNames: draft.productNames,
      brandNames: draft.brandNames,
      identifiers: draft.identifiers,
      images: draft.images.length,
      proposedSlug: draft.proposedSlug
    }
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
