export {};

type CandidateResult = {
  candidateName: string;
  endpoint: string;
  accessType: string;
  httpStatus: number | string;
  contentType: string;
  responseSize: number;
  parsedJsonPossible: boolean;
  parsedXmlOrRssPossible: boolean;
  sampleKeys: string[];
  paginationEvidence: string[];
  detailUrlEvidence: string[];
  imageUrlEvidence: string[];
  languageEvidence: string[];
  requiresKeyOrAuth: boolean;
  suspectedFeasibility: 'feasible' | 'needs-api-key' | 'html-only' | 'blocked' | 'unknown';
  notes: string[];
};

const officialCandidates = [
  {
    candidateName: 'FSANZ recall alert listing',
    endpoint: 'https://www.foodstandards.gov.au/food-recalls/recall-alert',
    accessType: 'official HTML listing'
  },
  {
    candidateName: 'FSANZ recall alert listing page 2',
    endpoint: 'https://www.foodstandards.gov.au/food-recalls/recall-alert?page=1',
    accessType: 'official HTML listing pagination'
  },
  {
    candidateName: 'FSANZ food recalls RSS',
    endpoint: 'https://www.foodstandards.gov.au/food-recalls-rss.xml',
    accessType: 'official RSS feed'
  },
  {
    candidateName: 'FSANZ food recalls overview',
    endpoint: 'https://www.foodstandards.gov.au/food-recalls',
    accessType: 'official HTML overview'
  },
  {
    candidateName: 'FSANZ API root candidate',
    endpoint: 'https://www.foodstandards.gov.au/api',
    accessType: 'official API candidate'
  },
  {
    candidateName: 'FSANZ JSON root candidate',
    endpoint: 'https://www.foodstandards.gov.au/json',
    accessType: 'official JSON candidate'
  }
];

function normalizeText(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function probe(candidate: (typeof officialCandidates)[number]): Promise<CandidateResult> {
  try {
    const response = await fetch(candidate.endpoint, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml,application/json,*/*',
        'user-agent': 'Recall Radar FSANZ access diagnostic'
      }
    });
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    let parsedJsonPossible = false;
    let sampleKeys: string[] = [];

    if (/json/i.test(contentType) || /^[\s\r\n]*[{\[]/.test(text)) {
      try {
        const parsed = JSON.parse(text) as unknown;
        parsedJsonPossible = true;
        sampleKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 20) : [];
      } catch {
        parsedJsonPossible = false;
      }
    }

    const recallLinks = unique(
      [...text.matchAll(/href=["']([^"']*\/food-recalls\/recall-alert\/[^"']+)["']/gi)].map((match) =>
        new URL(match[1], candidate.endpoint).toString()
      )
    );
    const imageUrls = unique(
      [...text.matchAll(/(?:src|href)=["']([^"']*\/sites\/default\/files\/(?:styles\/[^/]+\/)?public\/[^"']+)["']/gi)].map(
        (match) => new URL(match[1], candidate.endpoint).toString()
      )
    ).filter((url) => !/\b(?:logo|icon|inline-images|path%20|facebook|linkedin|youtube)\b/i.test(url));
    const paginationEvidence = unique([
      ...[...text.matchAll(/href=["']([^"']*\?page=\d+[^"']*)["']/gi)].map((match) => match[1]),
      ...[...text.matchAll(/Search results\s+\d+-\d+\s+of\s+\d+/gi)].map((match) => match[0])
    ]);
    const languageEvidence = unique([
      text.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ?? '',
      ...[...text.matchAll(/<language>([\s\S]*?)<\/language>/gi)].map((match) => normalizeText(match[1])),
      text.includes('Food Standards Australia New Zealand') ? 'English official FSANZ content' : ''
    ]);
    const requiresKeyOrAuth = response.status === 401 || response.status === 403 || /\b(api[_-]?key|access[_-]?token|authorization)\b/i.test(text);
    const parsedXmlOrRssPossible = /xml|rss/i.test(contentType) || /<rss\b|<channel>|<item>|<\?xml/i.test(text);
    const notes = [
      recallLinks.length ? `${recallLinks.length} recall detail links detected.` : '',
      imageUrls.length ? `${imageUrls.length} official-looking image/media URLs detected.` : '',
      parsedXmlOrRssPossible ? 'XML/RSS-like response detected.' : '',
      parsedJsonPossible ? 'JSON response parsed.' : '',
      requiresKeyOrAuth ? 'Response indicates key/auth or blocked status.' : ''
    ].filter(Boolean);
    const suspectedFeasibility =
      response.status === 401 || response.status === 403
        ? 'blocked'
        : parsedJsonPossible || parsedXmlOrRssPossible
          ? 'feasible'
          : recallLinks.length && paginationEvidence.length
            ? 'html-only'
            : response.ok
              ? 'unknown'
              : 'blocked';

    return {
      candidateName: candidate.candidateName,
      endpoint: candidate.endpoint,
      accessType: candidate.accessType,
      httpStatus: response.status,
      contentType,
      responseSize: text.length,
      parsedJsonPossible,
      parsedXmlOrRssPossible,
      sampleKeys,
      paginationEvidence: paginationEvidence.slice(0, 8),
      detailUrlEvidence: recallLinks.slice(0, 8),
      imageUrlEvidence: imageUrls.slice(0, 8),
      languageEvidence,
      requiresKeyOrAuth,
      suspectedFeasibility,
      notes
    };
  } catch (error) {
    return {
      candidateName: candidate.candidateName,
      endpoint: candidate.endpoint,
      accessType: candidate.accessType,
      httpStatus: 'request-error',
      contentType: '',
      responseSize: 0,
      parsedJsonPossible: false,
      parsedXmlOrRssPossible: false,
      sampleKeys: [],
      paginationEvidence: [],
      detailUrlEvidence: [],
      imageUrlEvidence: [],
      languageEvidence: [],
      requiresKeyOrAuth: false,
      suspectedFeasibility: 'unknown',
      notes: [error instanceof Error ? error.message : String(error)]
    };
  }
}

async function run(): Promise<void> {
  const results = [];

  for (const candidate of officialCandidates) {
    results.push(await probe(candidate));
  }

  const listing = results.find((result) => result.endpoint.endsWith('/food-recalls/recall-alert'));
  const pageTwo = results.find((result) => result.endpoint.includes('page=1'));
  const rss = results.find((result) => result.endpoint.endsWith('food-recalls-rss.xml'));
  const feasible =
    Boolean(listing?.detailUrlEvidence.length && listing.paginationEvidence.length && pageTwo?.detailUrlEvidence.length) ||
    Boolean(rss?.parsedXmlOrRssPossible && rss.detailUrlEvidence.length);
  const accessStatus = feasible
    ? 'feasible'
    : results.some((result) => result.suspectedFeasibility === 'blocked' || result.suspectedFeasibility === 'needs-api-key')
      ? 'blocked-or-needs-api-key'
      : 'unknown';

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'FSANZ_FOOD_RECALLS',
        officialDomainOnly: true,
        mutatesData: false,
        accessStatus,
        feasibilityDecision: feasible
          ? 'Official FSANZ HTML listing pagination and official detail pages are programmatically accessible without credentials. RSS is available for latest metadata but is too small for a 100-record spike.'
          : 'Official FSANZ access was not stable enough to add a source spike.',
        results
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
