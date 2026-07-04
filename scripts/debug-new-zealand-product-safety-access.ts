import { normalizeNewZealandText } from './normalize-new-zealand-product-safety.ts';

type CandidateResult = {
  candidateName: string;
  endpoint: string;
  accessType: 'html-listing' | 'json-candidate' | 'rss-candidate' | 'xml-candidate' | 'text-policy' | 'html-detail';
  httpStatus: number | null;
  contentType: string;
  responseSize: number;
  parsedJsonPossible: boolean;
  parsedXmlOrRssPossible: boolean;
  sampleKeys: string[];
  paginationEvidence: string[];
  detailUrlEvidence: string[];
  imageUrlEvidence: string[];
  requiresKeyOrAuth: boolean;
  suspectedFeasibility: 'feasible' | 'needs-api-key' | 'html-only' | 'blocked' | 'unknown';
  error?: string;
};

const officialListPage = 'https://www.productsafety.govt.nz/recalls';

const candidates: Array<Pick<CandidateResult, 'candidateName' | 'endpoint' | 'accessType'>> = [
  {
    candidateName: 'Product Safety New Zealand recalled products listing',
    endpoint: officialListPage,
    accessType: 'html-listing'
  },
  {
    candidateName: 'Product Safety New Zealand listing pagination',
    endpoint: `${officialListPage}?start=12`,
    accessType: 'html-listing'
  },
  {
    candidateName: 'Product Safety New Zealand JSON format probe',
    endpoint: `${officialListPage}?format=json`,
    accessType: 'json-candidate'
  },
  {
    candidateName: 'Product Safety New Zealand .json path probe',
    endpoint: `${officialListPage}.json`,
    accessType: 'json-candidate'
  },
  {
    candidateName: 'Product Safety New Zealand RSS path probe',
    endpoint: `${officialListPage}/rss`,
    accessType: 'rss-candidate'
  },
  {
    candidateName: 'Product Safety New Zealand feed path probe',
    endpoint: `${officialListPage}/feed`,
    accessType: 'rss-candidate'
  },
  {
    candidateName: 'Product Safety New Zealand sitemap',
    endpoint: 'https://www.productsafety.govt.nz/sitemap.xml',
    accessType: 'xml-candidate'
  },
  {
    candidateName: 'Product Safety New Zealand robots policy',
    endpoint: 'https://www.productsafety.govt.nz/robots.txt',
    accessType: 'text-policy'
  }
];

function sampleKeys(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    const first = payload.find((item) => item && typeof item === 'object');
    return first ? Object.keys(first as Record<string, unknown>).slice(0, 25) : [];
  }

  return payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>).slice(0, 25) : [];
}

function parseJson(text: string): { possible: boolean; keys: string[] } {
  try {
    const parsed = JSON.parse(text) as unknown;
    return { possible: true, keys: sampleKeys(parsed) };
  } catch {
    return { possible: false, keys: [] };
  }
}

function looksLikeXmlOrRss(text: string): boolean {
  return /<\?xml\b|<rss\b|<feed\b|<urlset\b|<sitemapindex\b/i.test(text);
}

function detailUrls(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/<a\b[^>]+href="(\/recalls\/[^"#?]+)"[^>]*>/gi)]
        .map((match) => new URL(match[1], officialListPage).toString())
        .filter((url) => !url.endsWith('/recalls'))
    )
  ].slice(0, 10);
}

function imageUrls(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/<img\b[^>]*(?:src|data-src)="([^"]+)"[^>]*>/gi)]
        .map((match) => new URL(normalizeNewZealandText(match[1]), officialListPage).toString())
        .filter((url) => /^https:\/\/www\.productsafety\.govt\.nz\/assets\/uploads\//i.test(url))
    )
  ].slice(0, 10);
}

function paginationEvidence(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/href="([^"]*\?start=\d+[^"]*)"/gi)].map((match) =>
        new URL(normalizeNewZealandText(match[1]), officialListPage).toString()
      )
    )
  ].slice(0, 10);
}

function feasibilityFor(candidate: (typeof candidates)[number], status: number, contentType: string, text: string): CandidateResult['suspectedFeasibility'] {
  if (status === 401 || status === 403) {
    return 'blocked';
  }

  if (/api[-_ ]?key|auth|token|subscription key/i.test(text)) {
    return 'needs-api-key';
  }

  if (candidate.accessType === 'html-listing' && status === 200 && /<article\b[^>]+class="recall"/i.test(text)) {
    return 'feasible';
  }

  if (candidate.accessType === 'html-detail' && status === 200 && /recall__info--hazard|Product Identifiers/i.test(text)) {
    return 'feasible';
  }

  if (/text\/html/i.test(contentType) && status === 200) {
    return 'html-only';
  }

  return 'unknown';
}

async function inspectCandidate(candidate: (typeof candidates)[number]): Promise<CandidateResult> {
  try {
    const response = await fetch(candidate.endpoint, {
      headers: {
        accept: 'application/json,application/xml,text/xml,application/rss+xml,text/html,*/*',
        'user-agent': 'Recall Radar local New Zealand Product Safety access diagnostic'
      }
    });
    const text = await response.text();
    const json = parseJson(text);
    const contentType = response.headers.get('content-type') ?? '';

    return {
      ...candidate,
      httpStatus: response.status,
      contentType,
      responseSize: text.length,
      parsedJsonPossible: json.possible,
      parsedXmlOrRssPossible: looksLikeXmlOrRss(text),
      sampleKeys: json.keys,
      paginationEvidence: paginationEvidence(text),
      detailUrlEvidence: detailUrls(text),
      imageUrlEvidence: imageUrls(text),
      requiresKeyOrAuth: /api[-_ ]?key|auth|token|subscription key/i.test(text),
      suspectedFeasibility: feasibilityFor(candidate, response.status, contentType, text)
    };
  } catch (error) {
    return {
      ...candidate,
      httpStatus: null,
      contentType: '',
      responseSize: 0,
      parsedJsonPossible: false,
      parsedXmlOrRssPossible: false,
      sampleKeys: [],
      paginationEvidence: [],
      detailUrlEvidence: [],
      imageUrlEvidence: [],
      requiresKeyOrAuth: false,
      suspectedFeasibility: 'unknown',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function run(): Promise<void> {
  const primaryResults = [];

  for (const candidate of candidates) {
    primaryResults.push(await inspectCandidate(candidate));
  }

  const firstDetailUrl = primaryResults.flatMap((result) => result.detailUrlEvidence)[0];
  const detailResult = firstDetailUrl
    ? await inspectCandidate({
        candidateName: 'Product Safety New Zealand official detail sample',
        endpoint: firstDetailUrl,
        accessType: 'html-detail'
      })
    : null;
  const results = detailResult ? [...primaryResults, detailResult] : primaryResults;
  const feasibleHtmlListing = results.some(
    (result) => result.accessType === 'html-listing' && result.httpStatus === 200 && result.detailUrlEvidence.length > 0
  );
  const detailFeasible = Boolean(detailResult && detailResult.httpStatus === 200 && detailResult.imageUrlEvidence.length > 0);
  const jsonOrRssFeasible = results.some(
    (result) =>
      result.httpStatus === 200 &&
      ((result.accessType === 'json-candidate' && result.parsedJsonPossible) ||
        (result.accessType === 'rss-candidate' && result.parsedXmlOrRssPossible))
  );

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCandidate: 'NZ_PRODUCT_SAFETY',
        officialSource: 'Product Safety New Zealand',
        officialListPage,
        summary: {
          feasible: feasibleHtmlListing && detailFeasible,
          accessMode: jsonOrRssFeasible ? 'structured-feed' : 'official-html-listing-and-detail-pages',
          jsonOrRssFeasible,
          htmlListingFeasible: feasibleHtmlListing,
          detailPageFeasible: detailFeasible,
          requiresKeyOrAuth: results.some((result) => result.requiresKeyOrAuth),
          endpointPolicy:
            'No official JSON/RSS recall feed was confirmed. The official HTML listing and detail pages are programmatically accessible and paginated by start parameter.'
        },
        candidates: results
      },
      null,
      2
    )
  );
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
