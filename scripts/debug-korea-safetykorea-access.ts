import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAFETYKOREA_AUTH_HEADER_NAME,
  buildDomesticRecallDetailUrl,
  buildDomesticRecallListUrl,
  buildSafetyKoreaHeaders,
  getSafetyKoreaAuthKey,
  mapSafetyKoreaDomesticRecallDraft,
  type SafetyKoreaDomesticRecallRaw
} from './korea-safetykorea-api-contract.ts';

type SafetyKoreaFixtureFile = {
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

type LiveProbe = {
  endpoint: string;
  httpStatus: number | null;
  contentType: string;
  parsedOk: boolean;
  resultCode: string;
  resultMsg: string;
  resultCount: number | null;
  sampleKeys: string[];
  error?: string;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixturePath = resolve(projectRoot, 'data/samples/korea-safetykorea-domestic-recall-samples.json');

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function asNumber(value: unknown): number | null {
  const parsed = Number.parseInt(asString(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sampleKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    const first = value.find((item) => item && typeof item === 'object');
    return first ? Object.keys(first as Record<string, unknown>).slice(0, 25) : [];
  }

  return value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>).slice(0, 25) : [];
}

function maskAuthKey(value: string): string {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function readFixture(): Promise<SafetyKoreaFixtureFile> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as SafetyKoreaFixtureFile;
}

function fixtureMappingFor(fixture: SafetyKoreaFixtureFile): {
  listSampleCount: number;
  detailSampleImages: number;
  draftRecordPreview: {
    id: string;
    source: string;
    title: string;
    category: string;
    recallDate: string;
    productNames: string[];
    brandNames: string[];
    images: number;
    proposedSlug: string;
  };
  KoreanTextPreserved: boolean;
} {
  const listItems = Array.isArray(fixture.domesticRecallListSample?.items)
    ? (fixture.domesticRecallListSample.items as SafetyKoreaDomesticRecallRaw[])
    : [];
  const detailItem = asObject(fixture.domesticRecallDetailSample?.item) as SafetyKoreaDomesticRecallRaw;
  const draft = mapSafetyKoreaDomesticRecallDraft(detailItem);
  const koreanText = [draft.title, draft.description, ...draft.productNames, ...draft.brandNames].join(' ');

  return {
    listSampleCount: listItems.length,
    detailSampleImages: draft.images.length,
    draftRecordPreview: {
      id: draft.id,
      source: draft.source,
      title: draft.title,
      category: draft.category,
      recallDate: draft.recallDate,
      productNames: draft.productNames,
      brandNames: draft.brandNames,
      images: draft.images.length,
      proposedSlug: draft.proposedSlug
    },
    KoreanTextPreserved: /[가-힣]/.test(koreanText)
  };
}

async function runLiveProbe(authKey: string): Promise<LiveProbe> {
  const endpoint = buildDomesticRecallListUrl({ conditionKey: 'all', conditionValue: '' }).toString();
  let httpStatus: number | null = null;
  let contentType = '';
  let text = '';

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15000),
      headers: buildSafetyKoreaHeaders(authKey)
    });
    httpStatus = response.status;
    contentType = response.headers.get('content-type') ?? '';
    text = await response.text();
  } catch (error) {
    return {
      endpoint,
      httpStatus,
      contentType,
      parsedOk: false,
      resultCode: '',
      resultMsg: '',
      resultCount: null,
      sampleKeys: [],
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    };
  }

  try {
    const payload = JSON.parse(text) as unknown;
    const objectPayload = asObject(payload);
    const items = Array.isArray(objectPayload.items) ? objectPayload.items : objectPayload.items ? [objectPayload.items] : [];

    return {
      endpoint,
      httpStatus,
      contentType,
      parsedOk: true,
      resultCode: asString(objectPayload.resultCode),
      resultMsg: asString(objectPayload.resultMsg),
      resultCount: asNumber(objectPayload.resultCount) ?? items.length,
      sampleKeys: sampleKeys(items.length ? items : payload)
    };
  } catch (error) {
    return {
      endpoint,
      httpStatus,
      contentType,
      parsedOk: false,
      resultCode: '',
      resultMsg: '',
      resultCount: null,
      sampleKeys: [],
      error: error instanceof Error ? `JSON parse failed: ${error.message}` : String(error)
    };
  }
}

async function runDiagnostic(): Promise<void> {
  const authKey = getSafetyKoreaAuthKey();
  const fixture = await readFixture();
  const fixtureMapping = fixtureMappingFor(fixture);
  const listEndpoint = buildDomesticRecallListUrl({ conditionKey: 'all', conditionValue: '' }).toString();
  const detailEndpointExample = buildDomesticRecallDetailUrl('SKR-SAMPLE-0001').toString();
  const liveProbe = authKey ? await runLiveProbe(authKey) : undefined;
  const feasibility = authKey
    ? liveProbe?.parsedOk && liveProbe.httpStatus && liveProbe.httpStatus < 400
      ? 'ready-for-live-activation-with-key'
      : 'failed-live-probe'
    : 'missing-auth-key';

  console.log(
    JSON.stringify(
      {
        source: 'KR_SAFETYKOREA',
        generatedAt: new Date().toISOString(),
        hasAuthKey: Boolean(authKey),
        authHeaderName: SAFETYKOREA_AUTH_HEADER_NAME,
        ...(authKey ? { maskedAuthKey: maskAuthKey(authKey) } : {}),
        listEndpoint,
        detailEndpointExample,
        requestMode: authKey ? 'live-with-auth' : 'missing-auth',
        fixtureMapping,
        ...(liveProbe ? { liveProbe } : {}),
        feasibility
      },
      null,
      2
    )
  );

  if (authKey && feasibility === 'failed-live-probe') {
    process.exitCode = 1;
  }
}

runDiagnostic().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
