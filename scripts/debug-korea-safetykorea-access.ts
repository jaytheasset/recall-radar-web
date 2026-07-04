type CandidateAccessType = 'official-api-page' | 'official-recall-board' | 'official-open-data-metadata';
type Feasibility = 'feasible' | 'needs-api-key' | 'html-only' | 'blocked' | 'unknown';

type Candidate = {
  name: string;
  endpoint: string;
  accessType: CandidateAccessType;
};

type CandidateResult = {
  candidateName: string;
  endpoint: string;
  accessType: CandidateAccessType;
  httpStatus: number | null;
  responseContentType: string;
  responseSize: number;
  parsedJsonPossible: boolean;
  parsedXmlPossible: boolean;
  parsedRssPossible: boolean;
  sampleKeys: string[];
  paginationEvidence: string[];
  detailUrlEvidence: string[];
  requiresKeyOrAuth: boolean;
  hasSafetyKoreaRecallTerms: boolean;
  hasRecordLikeRows: boolean;
  error: string | null;
  suspectedFeasibility: Feasibility;
  notes: string[];
};

const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};
const timeoutMs = 15000;

const candidates: Candidate[] = [
  {
    name: 'SafetyKorea Open API landing page',
    endpoint: 'https://www.safetykorea.kr/release/openapi',
    accessType: 'official-api-page'
  },
  {
    name: 'SafetyKorea recall board',
    endpoint: 'https://www.safetykorea.kr/recall/recallBoard',
    accessType: 'official-recall-board'
  },
  {
    name: 'data.go.kr SafetyKorea open API metadata',
    endpoint: 'https://www.data.go.kr/data/15116894/openapi.do',
    accessType: 'official-open-data-metadata'
  },
  {
    name: 'data.go.kr SafetyKorea schema.org metadata',
    endpoint: 'https://www.data.go.kr/catalog/15116894/openapi.json',
    accessType: 'official-open-data-metadata'
  },
  {
    name: 'data.go.kr SafetyKorea DCAT metadata',
    endpoint: 'https://www.data.go.kr/dcat/metadata/15116894',
    accessType: 'official-open-data-metadata'
  }
];

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sampleKeysFromJson(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    const firstObject = value.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
    return firstObject ? Object.keys(firstObject).slice(0, 20) : [];
  }

  return Object.keys(value as Record<string, unknown>).slice(0, 30);
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function evidence(text: string, patterns: RegExp[]): string[] {
  return patterns
    .flatMap((pattern) => [...text.matchAll(pattern)].map((match) => compactWhitespace(match[0]).slice(0, 160)))
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 12);
}

function parseStructured(text: string, contentType: string): {
  parsedJsonPossible: boolean;
  parsedXmlPossible: boolean;
  parsedRssPossible: boolean;
  sampleKeys: string[];
} {
  const trimmed = text.trim();
  const looksJson = contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  const looksXml = contentType.includes('xml') || trimmed.startsWith('<?xml') || /^<[a-z]/i.test(trimmed);

  let parsedJsonPossible = false;
  let sampleKeys: string[] = [];
  if (looksJson) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      parsedJsonPossible = true;
      sampleKeys = sampleKeysFromJson(json);
    } catch {
      parsedJsonPossible = false;
    }
  }

  return {
    parsedJsonPossible,
    parsedXmlPossible: looksXml,
    parsedRssPossible: /<rss\b|<feed\b|<item\b|<entry\b/i.test(trimmed),
    sampleKeys
  };
}

function classifyFeasibility(args: {
  candidate: Candidate;
  status: number | null;
  contentType: string;
  text: string;
  error: string | null;
  parsedJsonPossible: boolean;
  parsedXmlPossible: boolean;
  parsedRssPossible: boolean;
  hasRecordLikeRows: boolean;
  requiresKeyOrAuth: boolean;
}): { suspectedFeasibility: Feasibility; notes: string[] } {
  const notes: string[] = [];

  if (args.error || args.status === null || args.status >= 500 || args.status === 403 || args.status === 429) {
    notes.push('Official endpoint did not return stable successful access from this environment.');
    return { suspectedFeasibility: 'blocked', notes };
  }

  if (args.requiresKeyOrAuth) {
    notes.push('Official metadata/page indicates application, login, service key, or API-key flow.');
    return { suspectedFeasibility: 'needs-api-key', notes };
  }

  if (args.candidate.accessType === 'official-open-data-metadata') {
    notes.push('Reachable structured response is metadata only, not a recall-record payload endpoint.');
    return { suspectedFeasibility: 'unknown', notes };
  }

  if (args.parsedJsonPossible || args.parsedRssPossible || (args.parsedXmlPossible && !args.contentType.includes('html'))) {
    notes.push('Structured response was reachable without a private key.');
    return { suspectedFeasibility: 'feasible', notes };
  }

  if (args.candidate.accessType === 'official-recall-board' && args.hasRecordLikeRows) {
    notes.push('Official HTML board appears to expose record-like content, but no stable structured feed was confirmed.');
    return { suspectedFeasibility: 'html-only', notes };
  }

  if (args.contentType.includes('html')) {
    notes.push('Reachable response is HTML, with no confirmed machine-readable recall payload.');
    return { suspectedFeasibility: 'html-only', notes };
  }

  notes.push('No recall record payload or documented callable endpoint was confirmed.');
  return { suspectedFeasibility: 'unknown', notes };
}

async function fetchCandidate(candidate: Candidate): Promise<CandidateResult> {
  let status: number | null = null;
  let contentType = '';
  let text = '';
  let error: string | null = null;

  try {
    const response = await fetch(candidate.endpoint, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'text/html,application/xhtml+xml,application/json,application/xml,text/xml,*/*',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'user-agent': 'Recall Radar Korea SafetyKorea access diagnostic'
      }
    });

    status = response.status;
    contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    text = await response.text();
  } catch (fetchError) {
    error =
      fetchError instanceof Error
        ? `${fetchError.name}: ${fetchError.message}`
        : `Unknown fetch error: ${String(fetchError)}`;
  }

  const normalizedText = compactWhitespace(text);
  const lower = text.toLowerCase();
  const structured = parseStructured(text, contentType);
  const paginationEvidence = evidence(text, [
    /(?:page|pageNo|pageIndex|currentPage|paging|pagination|다음|페이지)[^"'<>]{0,80}/gi,
    /href=["'][^"']*(?:page|recallBoard|recall)[^"']*["']/gi
  ]);
  const detailUrlEvidence = evidence(text, [
    /https?:\/\/www\.safetykorea\.kr\/[^"'<> ]*(?:recall|cert|release|product)[^"'<> ]*/gi,
    /(?:href|action)=["'][^"']*(?:recall|cert|release|product)[^"']*["']/gi,
    /(?:recall|cert|product)[A-Za-z0-9_/-]{0,80}(?:Seq|No|Id|Detail|View)[A-Za-z0-9_/-]{0,80}/gi
  ]);
  const requiresKeyOrAuth =
    Boolean(runtimeEnv.SAFETYKOREA_API_KEY) === false &&
    includesAny(text, [
      'serviceKey',
      '서비스키',
      '인증키',
      '활용신청',
      'apiRequestForm',
      '로그인',
      '신청가능 트래픽',
      '발급'
    ]);
  const hasSafetyKoreaRecallTerms = includesAny(text, [
    '제품 안전인증 및 리콜 정보',
    '국내리콜',
    '해외리콜',
    '리콜',
    '제품안전정보센터',
    'SafetyKorea',
    'recall'
  ]);
  const hasRecordLikeRows =
    /<tr\b[\s\S]{0,300}(?:리콜|제품명|모델명|사업자|공표일|recall)[\s\S]{0,300}<\/tr>/i.test(text) ||
    /class=["'][^"']*(?:recall|board|list|product)[^"']*["']/i.test(text);

  const feasibility = classifyFeasibility({
    candidate,
    status,
    contentType,
    text: normalizedText,
    error,
    ...structured,
    hasRecordLikeRows,
    requiresKeyOrAuth
  });

  return {
    candidateName: candidate.name,
    endpoint: candidate.endpoint,
    accessType: candidate.accessType,
    httpStatus: status,
    responseContentType: contentType,
    responseSize: text.length,
    parsedJsonPossible: structured.parsedJsonPossible,
    parsedXmlPossible: structured.parsedXmlPossible,
    parsedRssPossible: structured.parsedRssPossible,
    sampleKeys: structured.sampleKeys,
    paginationEvidence,
    detailUrlEvidence,
    requiresKeyOrAuth,
    hasSafetyKoreaRecallTerms,
    hasRecordLikeRows,
    error,
    suspectedFeasibility: feasibility.suspectedFeasibility,
    notes: feasibility.notes
  };
}

function overallFeasibility(results: CandidateResult[]): {
  liveSourceFeasible: boolean;
  accessStatus: Feasibility;
  reason: string;
  nextRequirement: string;
} {
  const directStructured = results.find(
    (result) =>
      result.accessType !== 'official-open-data-metadata' &&
      result.suspectedFeasibility === 'feasible' &&
      result.hasSafetyKoreaRecallTerms &&
      (result.parsedJsonPossible || result.parsedRssPossible || result.parsedXmlPossible)
  );

  if (directStructured) {
    return {
      liveSourceFeasible: true,
      accessStatus: 'feasible',
      reason: `${directStructured.candidateName} returned a structured official response.`,
      nextRequirement: 'Implement bounded fetch/normalize/audit using the confirmed official endpoint.'
    };
  }

  const needsKey = results.find((result) => result.suspectedFeasibility === 'needs-api-key');
  if (needsKey) {
    return {
      liveSourceFeasible: false,
      accessStatus: 'needs-api-key',
      reason: `${needsKey.candidateName} indicates an application/login/service-key flow and no callable recall API endpoint was confirmed without credentials.`,
      nextRequirement: 'Obtain official SafetyKorea/data.go.kr API access details or service key documentation before ingestion.'
    };
  }

  const blocked = results.find((result) => result.suspectedFeasibility === 'blocked');
  if (blocked) {
    return {
      liveSourceFeasible: false,
      accessStatus: 'blocked',
      reason: `${blocked.candidateName} did not provide stable successful access from this environment.`,
      nextRequirement: 'Retry official access later or verify from an approved network/API access path.'
    };
  }

  const htmlOnly = results.find((result) => result.suspectedFeasibility === 'html-only');
  return {
    liveSourceFeasible: false,
    accessStatus: htmlOnly ? 'html-only' : 'unknown',
    reason: htmlOnly
      ? 'Only HTML access was observed, without a stable official machine-readable recall payload.'
      : 'No official callable recall record endpoint was confirmed.',
    nextRequirement: 'Confirm a stable official API/feed/export or explicitly accept a bounded official HTML scraper after selector validation.'
  };
}

async function runDiagnostic(): Promise<void> {
  const results: CandidateResult[] = [];

  for (const candidate of candidates) {
    results.push(await fetchCandidate(candidate));
  }

  const conclusion = overallFeasibility(results);

  console.log(
    JSON.stringify(
      {
        source: 'KR_SAFETYKOREA',
        checkedAt: new Date().toISOString(),
        safetyKoreaApiKeyProvided: Boolean(runtimeEnv.SAFETYKOREA_API_KEY),
        conclusion,
        candidates: results
      },
      null,
      2
    )
  );
}

runDiagnostic().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
