type CandidateResult = {
  candidateName: string;
  endpoint: string;
  accessType: 'xml' | 'html' | 'rss' | 'json' | 'unknown';
  httpStatus: number | null;
  contentType: string;
  responseSize: number;
  parsedJsonPossible: boolean;
  parsedXmlPossible: boolean;
  parsedRssPossible: boolean;
  sampleKeys: string[];
  paginationEvidence: string[];
  detailUrlEvidence: string[];
  imageUrlEvidence: string[];
  languageEvidence: string[];
  requiresKeyOrAuth: boolean;
  suspectedFeasibility: 'feasible' | 'needs-api-key' | 'html-only' | 'blocked' | 'unknown';
  error?: string;
};

const candidates: Array<{ candidateName: string; endpoint: string; accessType: CandidateResult['accessType'] }> = [
  {
    candidateName: 'CFS Food Alerts / Allergy Alerts listing',
    endpoint: 'https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/whatsnew_fa.html',
    accessType: 'html'
  },
  {
    candidateName: 'CFS English food alert DATA.GOV.HK XML',
    endpoint: 'https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.xml',
    accessType: 'xml'
  },
  {
    candidateName: 'CFS Traditional Chinese food alert XML candidate',
    endpoint: 'https://www.cfs.gov.hk/filemanager/foodalert/tc/foodalert_datagovhk.xml',
    accessType: 'xml'
  },
  {
    candidateName: 'CFS food alert RSS candidate',
    endpoint: 'https://www.cfs.gov.hk/english/rss/whatsnew_fa.xml',
    accessType: 'rss'
  },
  {
    candidateName: 'CFS JSON candidate',
    endpoint: 'https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.json',
    accessType: 'json'
  }
];

function normalizeText(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sampleXmlKeys(text: string): string[] {
  return [...new Set([...text.matchAll(/<([A-Za-z][A-Za-z0-9_-]*)\b[^>]*>/g)].map((match) => match[1]))].slice(0, 20);
}

function detailUrls(text: string, base: string): string[] {
  const urls = [
    ...text.matchAll(/href=["']([^"']*\/english\/whatsnew\/whatsnew_fa\/\d{4}_\d+\.html|\d{4}_\d+\.html)["']/gi),
    ...text.matchAll(/<link>([^<]*\/english\/whatsnew\/whatsnew_fa\/\d{4}_\d+\.html)<\/link>/gi)
  ].map((match) => {
    try {
      return new URL(match[1], base).toString().replace(/^http:/i, 'https:');
    } catch {
      return '';
    }
  });

  return [...new Set(urls.filter(Boolean))].slice(0, 10);
}

function imageUrls(text: string, base: string): string[] {
  return [...text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1], base).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .filter((url) => !/\b(?:logo|icon|sprite|favicon|header|footer|banner)\b/i.test(url))
    .slice(0, 10);
}

function archiveEvidence(text: string): string[] {
  return [...new Set([...text.matchAll(/whatsnew_fa_(\d{4})\.html/gi)].map((match) => match[1]))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 10);
}

function languageEvidence(text: string): string[] {
  const evidence = new Set<string>();
  if (/lang=["']en-us["']/i.test(text) || /Centre for Food Safety/i.test(text)) {
    evidence.add('English');
  }
  if (/[\u4e00-\u9fff]/.test(text)) {
    evidence.add('Chinese text present');
  }
  return [...evidence];
}

async function checkCandidate(candidate: (typeof candidates)[number]): Promise<CandidateResult> {
  try {
    const response = await fetch(candidate.endpoint, {
      headers: {
        accept: 'application/xml,text/html,application/json,*/*',
        'user-agent': 'Recall Radar local Hong Kong CFS access diagnostic'
      }
    });
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    const parsedJsonPossible = (() => {
      try {
        JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    })();
    const parsedXmlPossible = /<\?xml\b|<rss\b|<channel\b/i.test(text);
    const parsedRssPossible = /<rss\b[\s\S]*<item\b/i.test(text);
    const details = detailUrls(text, candidate.endpoint);
    const archives = archiveEvidence(text);
    const images = imageUrls(text, candidate.endpoint);
    const requiresKeyOrAuth = response.status === 401 || response.status === 403 || /api[-_ ]?key|authkey|access denied/i.test(text);
    const suspectedFeasibility: CandidateResult['suspectedFeasibility'] =
      response.status === 401 || response.status === 403
        ? requiresKeyOrAuth
          ? 'needs-api-key'
          : 'blocked'
        : response.ok && (parsedRssPossible || details.length > 0)
          ? 'feasible'
          : response.ok && candidate.accessType === 'html'
            ? 'html-only'
            : 'unknown';

    return {
      candidateName: candidate.candidateName,
      endpoint: candidate.endpoint,
      accessType: candidate.accessType,
      httpStatus: response.status,
      contentType,
      responseSize: text.length,
      parsedJsonPossible,
      parsedXmlPossible,
      parsedRssPossible,
      sampleKeys: sampleXmlKeys(text),
      paginationEvidence: archives,
      detailUrlEvidence: details,
      imageUrlEvidence: images,
      languageEvidence: languageEvidence(text),
      requiresKeyOrAuth,
      suspectedFeasibility
    };
  } catch (error) {
    return {
      candidateName: candidate.candidateName,
      endpoint: candidate.endpoint,
      accessType: candidate.accessType,
      httpStatus: null,
      contentType: '',
      responseSize: 0,
      parsedJsonPossible: false,
      parsedXmlPossible: false,
      parsedRssPossible: false,
      sampleKeys: [],
      paginationEvidence: [],
      detailUrlEvidence: [],
      imageUrlEvidence: [],
      languageEvidence: [],
      requiresKeyOrAuth: false,
      suspectedFeasibility: 'unknown',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function run(): Promise<void> {
  const results = await Promise.all(candidates.map(checkCandidate));
  const xml = results.find((result) => result.endpoint.endsWith('foodalert_datagovhk.xml') && result.httpStatus === 200);
  const listing = results.find((result) => result.endpoint.endsWith('whatsnew_fa.html') && result.httpStatus === 200);
  const feasible = Boolean(xml?.parsedRssPossible && listing?.detailUrlEvidence.length);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        sourceCandidate: 'HK_CFS',
        officialSource: 'Hong Kong Centre for Food Safety',
        proposedLabel: 'Hong Kong · Centre for Food Safety',
        feasible,
        recommendedAccessMode: feasible
          ? 'official DATA.GOV.HK XML for latest feed plus official CFS HTML archive/detail pages for bounded latest-100 records'
          : 'not confirmed',
        requiresKeyOrAuth: results.some((result) => result.requiresKeyOrAuth),
        recordsCanBeFetchedProgrammatically: feasible,
        mutation: 'none',
        candidates: results,
        summary: {
          xmlItems:
            xml && xml.parsedRssPossible
              ? ((await (await fetch(xml.endpoint)).text()).match(/<item>/g) ?? []).length
              : 0,
          archiveYears: listing?.paginationEvidence ?? [],
          detailSamples: listing?.detailUrlEvidence ?? []
        }
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
