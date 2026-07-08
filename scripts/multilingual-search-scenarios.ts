export type MultilingualScenarioGroup =
  | 'Korean'
  | 'Japanese'
  | 'Chinese'
  | 'Spanish'
  | 'German'
  | 'Portuguese'
  | 'English controls'
  | 'French/source terms'
  | 'mixed-language'
  | 'negative/noise';

export type MultilingualSearchScenario = {
  id: string;
  group: MultilingualScenarioGroup;
  query: string;
  minMatches?: number;
  maxMatches?: number;
  expectedAliases?: string[];
  expectedSources?: string[];
  rankingTerms?: string[];
};

export const MULTILINGUAL_SEARCH_SCENARIOS: MultilingualSearchScenario[] = [
  {
    id: 'ko-power-bank',
    group: 'Korean',
    query: '\uBCF4\uC870\uBC30\uD130\uB9AC',
    minMatches: 1,
    expectedAliases: ['power bank', 'portable charger'],
    rankingTerms: ['power bank', 'charger', 'battery']
  },
  {
    id: 'ko-charger',
    group: 'Korean',
    query: '\uCDA9\uC804\uAE30',
    minMatches: 1,
    expectedAliases: ['charger', 'adapter']
  },
  {
    id: 'ko-fire',
    group: 'Korean',
    query: '\uD654\uC7AC',
    minMatches: 1,
    expectedAliases: ['fire', 'fire hazard']
  },
  {
    id: 'ko-pistachio',
    group: 'Korean',
    query: '\uD53C\uC2A4\uD0C0\uCE58\uC624',
    minMatches: 1,
    expectedAliases: ['pistachio', 'pistache'],
    rankingTerms: ['pistachio']
  },
  {
    id: 'ko-allergen',
    group: 'Korean',
    query: '\uC54C\uB808\uB974\uAE30',
    minMatches: 1,
    expectedAliases: ['allergen', 'undeclared']
  },
  {
    id: 'ko-baby-sleeper',
    group: 'Korean',
    query: '\uC544\uAE30\uCE68\uB300',
    minMatches: 1,
    expectedAliases: ['crib', 'baby sleeper']
  },
  {
    id: 'ko-toy',
    group: 'Korean',
    query: '\uC7A5\uB09C\uAC10',
    minMatches: 1,
    expectedAliases: ['toy']
  },
  {
    id: 'ko-sleepwear',
    group: 'Korean',
    query: '\uC5B4\uB9B0\uC774 \uC7A0\uC637',
    minMatches: 1,
    expectedAliases: ['sleepwear', 'loungewear']
  },
  {
    id: 'ko-appliance',
    group: 'Korean',
    query: '\uAC00\uC804',
    minMatches: 1,
    expectedAliases: ['appliance', 'household appliance']
  },
  {
    id: 'ko-electric-shock',
    group: 'Korean',
    query: '\uAC10\uC804',
    minMatches: 1,
    expectedAliases: ['electric shock']
  },
  {
    id: 'ko-choking',
    group: 'Korean',
    query: '\uC9C8\uC2DD',
    minMatches: 1,
    expectedAliases: ['choking', 'suffocation']
  },
  {
    id: 'ja-power-bank',
    group: 'Japanese',
    query: '\u30E2\u30D0\u30A4\u30EB\u30D0\u30C3\u30C6\u30EA\u30FC',
    minMatches: 1,
    expectedAliases: ['power bank', 'portable charger']
  },
  {
    id: 'ja-charger',
    group: 'Japanese',
    query: '\u5145\u96FB\u5668',
    minMatches: 1,
    expectedAliases: ['charger', 'adapter']
  },
  {
    id: 'ja-fire',
    group: 'Japanese',
    query: '\u706B\u707D',
    minMatches: 1,
    expectedAliases: ['fire', 'fire hazard']
  },
  {
    id: 'ja-pistachio',
    group: 'Japanese',
    query: '\u30D4\u30B9\u30BF\u30C1\u30AA',
    minMatches: 1,
    expectedAliases: ['pistachio', 'pistache']
  },
  {
    id: 'ja-allergen',
    group: 'Japanese',
    query: '\u30A2\u30EC\u30EB\u30B2\u30F3',
    minMatches: 1,
    expectedAliases: ['allergen', 'undeclared']
  },
  {
    id: 'ja-baby-sleeper',
    group: 'Japanese',
    query: '\u30D9\u30D3\u30FC\u30D9\u30C3\u30C9',
    minMatches: 1,
    expectedAliases: ['crib', 'baby sleeper']
  },
  {
    id: 'ja-toy',
    group: 'Japanese',
    query: '\u304A\u3082\u3061\u3083',
    minMatches: 1,
    expectedAliases: ['toy']
  },
  {
    id: 'zh-power-bank',
    group: 'Chinese',
    query: '\u5145\u7535\u5B9D',
    minMatches: 1,
    expectedAliases: ['power bank', 'portable charger']
  },
  {
    id: 'zh-allergen',
    group: 'Chinese',
    query: '\u8FC7\u654F\u539F',
    minMatches: 1,
    expectedAliases: ['allergen', 'undeclared']
  },
  {
    id: 'zh-barcode',
    group: 'Chinese',
    query: '\u6761\u5F62\u7801',
    minMatches: 1,
    expectedAliases: ['barcode', 'upc']
  },
  {
    id: 'es-charger',
    group: 'Spanish',
    query: 'cargador',
    minMatches: 1,
    expectedAliases: ['charger', 'adapter']
  },
  {
    id: 'es-allergen',
    group: 'Spanish',
    query: 'alergeno',
    minMatches: 1,
    expectedAliases: ['allergen', 'undeclared']
  },
  {
    id: 'de-smoke-detector',
    group: 'German',
    query: 'rauchmelder',
    minMatches: 1,
    expectedAliases: ['smoke detector', 'smoke alarm'],
    rankingTerms: ['smoke detector', 'carbon monoxide']
  },
  {
    id: 'pt-power-bank',
    group: 'Portuguese',
    query: 'banco de energia',
    minMatches: 1,
    expectedAliases: ['power bank', 'portable charger'],
    rankingTerms: ['power bank', 'battery']
  },
  {
    id: 'pt-fire',
    group: 'Portuguese',
    query: 'incendio',
    minMatches: 1,
    expectedAliases: ['fire', 'fire hazard']
  },
  {
    id: 'pt-barcode',
    group: 'Portuguese',
    query: 'codigo de barras',
    minMatches: 1,
    expectedAliases: ['barcode', 'upc']
  },
  {
    id: 'pt-toy',
    group: 'Portuguese',
    query: 'brinquedo',
    minMatches: 1,
    expectedAliases: ['toy']
  },
  {
    id: 'pt-milk',
    group: 'Portuguese',
    query: 'leite',
    minMatches: 1,
    expectedAliases: ['milk', 'dairy']
  },
  {
    id: 'pt-baby-sleeper',
    group: 'Portuguese',
    query: 'berco',
    minMatches: 1,
    expectedAliases: ['crib', 'baby sleeper']
  },
  {
    id: 'pt-smoke-detector',
    group: 'Portuguese',
    query: 'detector de fumaca',
    minMatches: 1,
    expectedAliases: ['smoke detector', 'smoke alarm']
  },
  {
    id: 'en-power-bank',
    group: 'English controls',
    query: 'power bank',
    minMatches: 1,
    expectedAliases: ['portable charger'],
    rankingTerms: ['power bank', 'charger', 'battery']
  },
  {
    id: 'en-pistachio',
    group: 'English controls',
    query: 'pistachio',
    minMatches: 1,
    expectedAliases: ['pistache'],
    rankingTerms: ['pistachio']
  },
  {
    id: 'en-baby-sleeper',
    group: 'English controls',
    query: 'baby sleeper',
    minMatches: 1,
    expectedAliases: ['crib']
  },
  {
    id: 'en-smoke-detector',
    group: 'English controls',
    query: 'smoke detector',
    minMatches: 1,
    rankingTerms: ['smoke detector', 'carbon monoxide']
  },
  {
    id: 'en-charger',
    group: 'English controls',
    query: 'charger',
    minMatches: 1,
    expectedAliases: ['adapter']
  },
  {
    id: 'en-overheating',
    group: 'English controls',
    query: 'overheating',
    minMatches: 1,
    expectedAliases: ['fire hazard']
  },
  {
    id: 'fr-rappel',
    group: 'French/source terms',
    query: 'rappel',
    minMatches: 1,
    maxMatches: 850,
    expectedAliases: ['safety alert'],
    expectedSources: ['FR_RAPPELCONSO']
  },
  {
    id: 'fr-rappelconso',
    group: 'French/source terms',
    query: 'RappelConso',
    minMatches: 1,
    expectedSources: ['FR_RAPPELCONSO']
  },
  {
    id: 'fr-pistache',
    group: 'French/source terms',
    query: 'pistache',
    minMatches: 1,
    expectedAliases: ['pistachio']
  },
  {
    id: 'fr-allergene',
    group: 'French/source terms',
    query: 'allerg\u00E8ne',
    minMatches: 1,
    expectedAliases: ['allergen']
  },
  {
    id: 'fr-lait',
    group: 'French/source terms',
    query: 'lait',
    minMatches: 1,
    expectedAliases: ['milk']
  },
  {
    id: 'mixed-ko-allergen-milk',
    group: 'mixed-language',
    query: '\uC54C\uB808\uB974\uAE30 milk',
    minMatches: 1,
    expectedAliases: ['allergen', 'milk']
  },
  {
    id: 'mixed-ja-power-bank-fire',
    group: 'mixed-language',
    query: '\u30E2\u30D0\u30A4\u30EB\u30D0\u30C3\u30C6\u30EA\u30FC fire',
    minMatches: 1,
    expectedAliases: ['power bank', 'fire']
  },
  {
    id: 'mixed-fr-pistache-fda',
    group: 'mixed-language',
    query: 'pistache FDA',
    minMatches: 1,
    expectedAliases: ['pistachio'],
    expectedSources: ['FDA']
  },
  {
    id: 'negative-random',
    group: 'negative/noise',
    query: 'zzzz-not-real',
    maxMatches: 0
  },
  {
    id: 'negative-random-recall-word',
    group: 'negative/noise',
    query: 'qwerty-no-recall',
    maxMatches: 0
  },
  {
    id: 'negative-no-product',
    group: 'negative/noise',
    query: 'asdfghjkl barcode no product',
    maxMatches: 5
  }
];
