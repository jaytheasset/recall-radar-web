export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = ['en', 'ko', 'ja', 'zh', 'fr', 'es', 'de', 'pt'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const UI_LANGUAGE_STORAGE_KEY = 'recall-radar-ui-language-v1';

export const localeOptions: Array<{ value: SupportedLocale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' }
];

const enMessages = {
  'app.name': 'Recall Radar',
  'language.label': 'Language',
  'nav.checker': 'Product Recalls',
  'nav.productTypes': 'Product Types',
  'nav.countries': 'Countries',
  'nav.watchlist': 'Watchlist',
  'common.viewRecall': 'View recall',
  'common.viewRecalls': 'View recalls',
  'common.viewAllProductTypes': 'View all product types',
  'common.showFewerProductTypes': 'Show fewer product types',
  'common.viewAllSources': 'View all sources',
  'common.viewAllRecalls': 'View all recalls',
  'common.browseRecalls': 'Browse recalls',
  'common.searchAllNotices': 'Search all notices',
  'common.officialNotice': 'Official notice',
  'common.verifyOfficialNotice': 'Verify with the official notice',
  'common.try': 'Try:',
  'common.examples': 'Examples:',
  'common.recallsCount': '{count} recalls',
  'home.hero.line1': 'Stay informed.',
  'home.hero.line2': 'Shop and live with confidence.',
  'home.lead': 'Search official recall notices from trusted sources around the world.',
  'home.searchLabel': 'Brand, product, model, barcode, lot, date, or recall number',
  'home.searchPlaceholder': 'Search by brand, product, model, barcode, lot code, or recall number',
  'home.searchButton': 'Search recalls',
  'home.trust': 'Official recalls. Trusted sources. Global coverage.',
  'home.countLine': '{total} recalls from {sources} official sources.',
  'home.productTypesHeading': 'Explore by product type',
  'home.sourcesHeading': 'Browse by source',
  'home.latestHeading': 'Latest recalls',
  'home.watchlistHeading': 'Keep an eye on products you care about',
  'home.watchlistCopy': 'Save searches in this browser only. No account, email, or alerts yet.',
  'home.openSavedSearches': 'Open saved searches',
  'footer.disclaimer':
    'Recall Radar helps you find possible recalls. Search results are not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.',
  'checker.title': 'Search recalls',
  'checker.lead': 'Search by product, brand, model, barcode, lot, date, ingredient, or recall number.',
  'checker.countLine': 'Search {total} recalls from {sources} official sources.',
  'checker.searchTitle': 'Recall search',
  'checker.searchTerm': 'Search term',
  'checker.searchPlaceholder': 'Enter a product, brand, model, barcode, lot, or recall number',
  'checker.searchButton': 'Search',
  'checker.moreFilters': 'More filters',
  'checker.countrySource': 'Country or source',
  'checker.productType': 'Product type',
  'checker.issueHazard': 'Issue or hazard',
  'checker.date': 'Date',
  'checker.sort': 'Sort',
  'checker.warning': 'Results are possible matches. Always check the official notice.',
  'checker.browseInstead': 'Browse instead:',
  'checker.noClearMatch': 'No clear match found',
  'checker.noResultSafety':
    'We did not find a clear match in the recall notices. This does not mean the product is safe or recall-free. Try searching by brand name, model number, UPC/barcode, lot code, ingredient, allergen, or product type.',
  'disclaimer.possibleMatches':
    'Search results are possible matches, not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.',
  'directory.productTypesEyebrow': 'Product types',
  'directory.productTypesTitle': 'Find recalls by product type',
  'directory.productTypesLead': 'Explore official recall notices by the kind of product involved.',
  'directory.countriesEyebrow': 'Countries',
  'directory.countriesTitle': 'Browse recalls by country or source',
  'directory.countriesLead': 'Choose a country or source to review official recall notices searchable in Recall Radar.',
  'watchlist.savedInBrowser': 'Saved in this browser',
  'detail.howToVerify': 'How to verify',
  'detail.viewOfficialNotice': 'View official notice',
  'category.indexedNotices': 'Recall notices',
  'error.pageNotFound': 'Page not found'
} as const;

export type MessageKey = keyof typeof enMessages;

export const messages: Record<SupportedLocale, Record<MessageKey, string>> = {
  en: enMessages,
  ko: {
    ...enMessages,
    'language.label': '언어',
    'nav.checker': '제품 리콜 검색',
    'nav.productTypes': '제품 유형',
    'nav.countries': '국가',
    'nav.watchlist': '관심 검색',
    'common.viewRecall': '리콜 보기',
    'common.viewRecalls': '리콜 보기',
    'common.viewAllProductTypes': '모든 제품 유형 보기',
    'common.showFewerProductTypes': '제품 유형 줄이기',
    'common.viewAllSources': '모든 출처 보기',
    'common.viewAllRecalls': '모든 리콜 보기',
    'common.try': '예시:',
    'common.examples': '예시:',
    'common.recallsCount': '{count}건 리콜',
    'home.hero.line1': '정보를 놓치지 마세요.',
    'home.hero.line2': '더 안심하고 쇼핑하고 생활하세요.',
    'home.lead': '전 세계 신뢰할 수 있는 공식 출처의 리콜 공지를 검색하세요.',
    'home.searchLabel': '브랜드, 제품, 모델, 바코드, 로트, 날짜 또는 리콜 번호',
    'home.searchPlaceholder': '브랜드, 제품, 모델, 바코드, 로트 코드 또는 리콜 번호로 검색',
    'home.searchButton': '리콜 검색',
    'home.trust': '공식 리콜. 신뢰할 수 있는 출처. 글로벌 커버리지.',
    'home.countLine': '{sources}개 공식 출처의 리콜 {total}건.',
    'home.productTypesHeading': '제품 유형별로 보기',
    'home.sourcesHeading': '출처별로 보기',
    'home.latestHeading': '최근 리콜',
    'home.watchlistHeading': '관심 제품을 계속 확인하세요',
    'home.watchlistCopy': '검색은 이 브라우저에만 저장됩니다. 계정, 이메일, 알림은 아직 없습니다.',
    'home.openSavedSearches': '저장한 검색 열기',
    'footer.disclaimer':
      'Recall Radar는 가능한 리콜 공지를 찾는 데 도움을 줍니다. 검색 결과는 안전 확인이 아닙니다. 대상 모델, 로트, 날짜, 유통 정보, 조치 사항은 항상 공식 공지로 확인하세요.',
    'checker.title': '리콜 검색',
    'checker.lead': '제품, 브랜드, 모델, 바코드, 로트, 날짜, 성분 또는 리콜 번호로 검색하세요.',
    'checker.countLine': '{sources}개 공식 출처의 리콜 {total}건을 검색합니다.',
    'checker.searchTitle': '리콜 검색',
    'checker.searchTerm': '검색어',
    'checker.searchPlaceholder': '제품, 브랜드, 모델, 바코드, 로트 또는 리콜 번호 입력',
    'checker.searchButton': '검색',
    'checker.moreFilters': '필터 더 보기',
    'checker.countrySource': '국가 또는 출처',
    'checker.productType': '제품 유형',
    'checker.issueHazard': '문제 또는 위험',
    'checker.date': '날짜',
    'checker.sort': '정렬',
    'checker.warning': '검색 결과는 가능한 일치 항목입니다. 항상 공식 공지를 확인하세요.',
    'checker.browseInstead': '둘러보기:',
    'checker.noClearMatch': '명확한 일치 항목 없음',
    'checker.noResultSafety':
      '리콜 공지에서 명확한 일치 항목을 찾지 못했습니다. 제품이 안전하거나 리콜이 없다는 뜻은 아닙니다. 브랜드명, 모델 번호, UPC/바코드, 로트 코드, 성분, 알레르기 유발 물질 또는 제품 유형으로 검색해 보세요.',
    'directory.productTypesEyebrow': '제품 유형',
    'directory.productTypesTitle': '제품 유형별 리콜 찾기',
    'directory.productTypesLead': '관련 제품 종류별로 공식 리콜 공지를 살펴보세요.',
    'directory.countriesEyebrow': '국가',
    'directory.countriesTitle': '국가 또는 출처별 리콜 보기',
    'directory.countriesLead': 'Recall Radar에서 검색 가능한 공식 리콜 공지를 국가 또는 출처별로 확인하세요.',
    'error.pageNotFound': '페이지를 찾을 수 없습니다'
  },
  ja: {
    ...enMessages,
    'language.label': '言語',
    'nav.checker': '製品リコール検索',
    'nav.productTypes': '製品タイプ',
    'nav.countries': '国',
    'nav.watchlist': '保存した検索',
    'common.viewRecall': 'リコールを見る',
    'common.viewRecalls': 'リコールを見る',
    'common.viewAllProductTypes': 'すべての製品タイプを見る',
    'common.showFewerProductTypes': '製品タイプを減らす',
    'common.viewAllSources': 'すべての情報源を見る',
    'common.viewAllRecalls': 'すべてのリコールを見る',
    'common.try': '例:',
    'common.examples': '例:',
    'common.recallsCount': '{count}件のリコール',
    'home.hero.line1': '情報を把握しましょう。',
    'home.hero.line2': '安心して買い物し、暮らしましょう。',
    'home.lead': '世界中の信頼できる公式情報源からリコール通知を検索できます。',
    'home.searchLabel': 'ブランド、製品、モデル、バーコード、ロット、日付、リコール番号',
    'home.searchPlaceholder': 'ブランド、製品、モデル、バーコード、ロットコード、リコール番号で検索',
    'home.searchButton': 'リコール検索',
    'home.trust': '公式リコール。信頼できる情報源。グローバル対応。',
    'home.countLine': '{sources}件の公式情報源から{total}件のリコール。',
    'home.productTypesHeading': '製品タイプから探す',
    'home.sourcesHeading': '情報源から探す',
    'home.latestHeading': '最新のリコール',
    'home.watchlistHeading': '気になる製品を確認し続ける',
    'home.watchlistCopy': '検索はこのブラウザにのみ保存されます。アカウント、メール、通知はまだありません。',
    'home.openSavedSearches': '保存した検索を開く',
    'footer.disclaimer':
      'Recall Radarは該当する可能性のあるリコール通知を探すためのサービスです。検索結果は安全確認ではありません。対象モデル、ロット、日付、流通、対応内容は必ず公式通知で確認してください。',
    'checker.title': 'リコール検索',
    'checker.lead': '製品、ブランド、モデル、バーコード、ロット、日付、成分、リコール番号で検索できます。',
    'checker.countLine': '{sources}件の公式情報源から{total}件のリコールを検索します。',
    'checker.searchPlaceholder': '製品、ブランド、モデル、バーコード、ロット、リコール番号を入力',
    'checker.searchButton': '検索',
    'checker.moreFilters': 'フィルターを表示',
    'checker.countrySource': '国または情報源',
    'checker.productType': '製品タイプ',
    'checker.issueHazard': '問題または危険',
    'checker.date': '日付',
    'checker.sort': '並び替え',
    'checker.warning': '検索結果は可能性のある一致です。必ず公式通知を確認してください。',
    'checker.browseInstead': '別の探し方:',
    'checker.noClearMatch': '明確な一致はありません',
    'directory.productTypesEyebrow': '製品タイプ',
    'directory.productTypesTitle': '製品タイプ別にリコールを探す',
    'directory.productTypesLead': '製品の種類別に公式リコール通知を確認できます。',
    'directory.countriesEyebrow': '国',
    'directory.countriesTitle': '国または情報源別にリコールを見る',
    'directory.countriesLead': 'Recall Radarで検索できる公式リコール通知を国または情報源別に確認できます。',
    'error.pageNotFound': 'ページが見つかりません'
  },
  zh: {
    ...enMessages,
    'language.label': '语言',
    'nav.checker': '产品召回搜索',
    'nav.productTypes': '产品类型',
    'nav.countries': '国家',
    'nav.watchlist': '已保存搜索',
    'common.viewRecall': '查看召回',
    'common.viewRecalls': '查看召回',
    'common.viewAllProductTypes': '查看全部产品类型',
    'common.showFewerProductTypes': '收起产品类型',
    'common.viewAllSources': '查看全部来源',
    'common.viewAllRecalls': '查看全部召回',
    'common.try': '示例:',
    'common.examples': '示例:',
    'common.recallsCount': '{count} 条召回',
    'home.hero.line1': '及时了解召回信息。',
    'home.hero.line2': '更安心地购物和生活。',
    'home.lead': '搜索来自全球可信官方来源的召回通知。',
    'home.searchLabel': '品牌、产品、型号、条码、批号、日期或召回编号',
    'home.searchPlaceholder': '按品牌、产品、型号、条码、批号或召回编号搜索',
    'home.searchButton': '搜索召回',
    'home.trust': '官方召回。可信来源。全球覆盖。',
    'home.countLine': '来自 {sources} 个官方来源的 {total} 条召回。',
    'home.productTypesHeading': '按产品类型浏览',
    'home.sourcesHeading': '按来源浏览',
    'home.latestHeading': '最新召回',
    'home.watchlistHeading': '关注你在意的产品',
    'home.watchlistCopy': '搜索仅保存在此浏览器中。暂不支持账号、邮件或提醒。',
    'home.openSavedSearches': '打开已保存搜索',
    'footer.disclaimer':
      'Recall Radar 可帮助查找可能相关的召回通知。搜索结果不是安全确认。请始终通过官方通知核实受影响型号、批次、日期、销售范围和处理方式。',
    'checker.title': '搜索召回',
    'checker.lead': '按产品、品牌、型号、条码、批号、日期、成分或召回编号搜索。',
    'checker.countLine': '搜索来自 {sources} 个官方来源的 {total} 条召回。',
    'checker.searchPlaceholder': '输入产品、品牌、型号、条码、批号或召回编号',
    'checker.searchButton': '搜索',
    'checker.moreFilters': '更多筛选',
    'checker.countrySource': '国家或来源',
    'checker.productType': '产品类型',
    'checker.issueHazard': '问题或风险',
    'checker.date': '日期',
    'checker.sort': '排序',
    'checker.warning': '搜索结果只是可能匹配项。请始终查看官方通知。',
    'checker.browseInstead': '也可以浏览:',
    'checker.noClearMatch': '未找到明确匹配',
    'directory.productTypesEyebrow': '产品类型',
    'directory.productTypesTitle': '按产品类型查找召回',
    'directory.productTypesLead': '按涉及的产品类型浏览官方召回通知。',
    'directory.countriesEyebrow': '国家',
    'directory.countriesTitle': '按国家或来源浏览召回',
    'directory.countriesLead': '按国家或来源查看 Recall Radar 中可搜索的官方召回通知。',
    'error.pageNotFound': '找不到页面'
  },
  fr: {
    ...enMessages,
    'language.label': 'Langue',
    'nav.checker': 'Rappels de produits',
    'nav.productTypes': 'Types de produits',
    'nav.countries': 'Pays',
    'nav.watchlist': 'Recherches suivies',
    'common.viewRecall': 'Voir le rappel',
    'common.viewRecalls': 'Voir les rappels',
    'common.viewAllProductTypes': 'Voir tous les types de produits',
    'common.showFewerProductTypes': 'Afficher moins de types',
    'common.viewAllSources': 'Voir toutes les sources',
    'common.viewAllRecalls': 'Voir tous les rappels',
    'common.try': 'Exemples :',
    'common.examples': 'Exemples :',
    'common.recallsCount': '{count} rappels',
    'home.hero.line1': 'Restez informé.',
    'home.hero.line2': 'Achetez et vivez avec confiance.',
    'home.lead': 'Recherchez des avis de rappel officiels provenant de sources fiables dans le monde entier.',
    'home.searchLabel': 'Marque, produit, modèle, code-barres, lot, date ou numéro de rappel',
    'home.searchPlaceholder': 'Rechercher par marque, produit, modèle, code-barres, lot ou numéro de rappel',
    'home.searchButton': 'Rechercher',
    'home.trust': 'Rappels officiels. Sources fiables. Couverture mondiale.',
    'home.countLine': '{total} rappels provenant de {sources} sources officielles.',
    'home.productTypesHeading': 'Explorer par type de produit',
    'home.sourcesHeading': 'Explorer par source',
    'home.latestHeading': 'Derniers rappels',
    'home.watchlistHeading': 'Suivez les produits importants pour vous',
    'home.watchlistCopy': "Les recherches sont enregistrées uniquement dans ce navigateur. Aucun compte, e-mail ou alerte n'est encore activé.",
    'home.openSavedSearches': 'Ouvrir les recherches enregistrées',
    'footer.disclaimer':
      "Recall Radar aide à trouver des avis de rappel possibles. Les résultats ne confirment pas la sécurité d'un produit. Vérifiez toujours les modèles, lots, dates, distribution et mesures avec l'avis officiel.",
    'checker.title': 'Rechercher des rappels',
    'checker.lead': 'Recherchez par produit, marque, modèle, code-barres, lot, date, ingrédient ou numéro de rappel.',
    'checker.countLine': 'Rechercher {total} rappels provenant de {sources} sources officielles.',
    'checker.searchPlaceholder': 'Saisir un produit, une marque, un modèle, un code-barres, un lot ou un numéro de rappel',
    'checker.searchButton': 'Rechercher',
    'checker.moreFilters': 'Plus de filtres',
    'checker.countrySource': 'Pays ou source',
    'checker.productType': 'Type de produit',
    'checker.issueHazard': 'Problème ou risque',
    'checker.date': 'Date',
    'checker.sort': 'Tri',
    'checker.warning': "Les résultats sont des correspondances possibles. Vérifiez toujours l'avis officiel.",
    'checker.browseInstead': 'Parcourir plutôt :',
    'checker.noClearMatch': 'Aucune correspondance claire',
    'directory.productTypesEyebrow': 'Types de produits',
    'directory.productTypesTitle': 'Trouver des rappels par type de produit',
    'directory.productTypesLead': 'Explorez les avis de rappel officiels selon le type de produit concerné.',
    'directory.countriesEyebrow': 'Pays',
    'directory.countriesTitle': 'Parcourir les rappels par pays ou source',
    'directory.countriesLead': 'Choisissez un pays ou une source pour consulter les avis de rappel officiels disponibles dans Recall Radar.',
    'error.pageNotFound': 'Page introuvable'
  },
  es: {
    ...enMessages,
    'language.label': 'Idioma',
    'nav.checker': 'Retiros de productos',
    'nav.productTypes': 'Tipos de producto',
    'nav.countries': 'Países',
    'nav.watchlist': 'Búsquedas guardadas',
    'common.viewRecall': 'Ver retiro',
    'common.viewRecalls': 'Ver retiros',
    'common.viewAllProductTypes': 'Ver todos los tipos',
    'common.showFewerProductTypes': 'Mostrar menos tipos',
    'common.viewAllSources': 'Ver todas las fuentes',
    'common.viewAllRecalls': 'Ver todos los retiros',
    'common.try': 'Prueba:',
    'common.examples': 'Ejemplos:',
    'common.recallsCount': '{count} retiros',
    'home.hero.line1': 'Mantente informado.',
    'home.hero.line2': 'Compra y vive con confianza.',
    'home.lead': 'Busca avisos oficiales de retiro de fuentes confiables de todo el mundo.',
    'home.searchLabel': 'Marca, producto, modelo, código de barras, lote, fecha o número de retiro',
    'home.searchPlaceholder': 'Busca por marca, producto, modelo, código de barras, lote o número de retiro',
    'home.searchButton': 'Buscar retiros',
    'home.trust': 'Retiros oficiales. Fuentes confiables. Cobertura global.',
    'home.countLine': '{total} retiros de {sources} fuentes oficiales.',
    'home.productTypesHeading': 'Explorar por tipo de producto',
    'home.sourcesHeading': 'Explorar por fuente',
    'home.latestHeading': 'Retiros recientes',
    'home.watchlistHeading': 'Sigue los productos que te importan',
    'home.watchlistCopy': 'Las búsquedas se guardan solo en este navegador. Aún no hay cuenta, correo ni alertas.',
    'home.openSavedSearches': 'Abrir búsquedas guardadas',
    'footer.disclaimer':
      'Recall Radar ayuda a encontrar posibles avisos de retiro. Los resultados no confirman la seguridad. Verifica siempre modelos, lotes, fechas, distribución y soluciones con el aviso oficial.',
    'checker.title': 'Buscar retiros',
    'checker.lead': 'Busca por producto, marca, modelo, código de barras, lote, fecha, ingrediente o número de retiro.',
    'checker.countLine': 'Busca {total} retiros de {sources} fuentes oficiales.',
    'checker.searchPlaceholder': 'Ingresa producto, marca, modelo, código de barras, lote o número de retiro',
    'checker.searchButton': 'Buscar',
    'checker.moreFilters': 'Más filtros',
    'checker.countrySource': 'País o fuente',
    'checker.productType': 'Tipo de producto',
    'checker.issueHazard': 'Problema o riesgo',
    'checker.date': 'Fecha',
    'checker.sort': 'Ordenar',
    'checker.warning': 'Los resultados son coincidencias posibles. Revisa siempre el aviso oficial.',
    'checker.browseInstead': 'También puedes explorar:',
    'checker.noClearMatch': 'No se encontró una coincidencia clara',
    'directory.productTypesEyebrow': 'Tipos de producto',
    'directory.productTypesTitle': 'Buscar retiros por tipo de producto',
    'directory.productTypesLead': 'Explora avisos oficiales de retiro por el tipo de producto involucrado.',
    'directory.countriesEyebrow': 'Países',
    'directory.countriesTitle': 'Explorar retiros por país o fuente',
    'directory.countriesLead': 'Elige un país o fuente para revisar avisos oficiales de retiro disponibles en Recall Radar.',
    'error.pageNotFound': 'Página no encontrada'
  },
  de: {
    ...enMessages,
    'language.label': 'Sprache',
    'nav.checker': 'Produktrückrufe',
    'nav.productTypes': 'Produkttypen',
    'nav.countries': 'Länder',
    'nav.watchlist': 'Gespeicherte Suchen',
    'common.viewRecall': 'Rückruf ansehen',
    'common.viewRecalls': 'Rückrufe ansehen',
    'common.viewAllProductTypes': 'Alle Produkttypen anzeigen',
    'common.showFewerProductTypes': 'Weniger Produkttypen anzeigen',
    'common.viewAllSources': 'Alle Quellen anzeigen',
    'common.viewAllRecalls': 'Alle Rückrufe anzeigen',
    'common.try': 'Beispiele:',
    'common.examples': 'Beispiele:',
    'common.recallsCount': '{count} Rückrufe',
    'home.hero.line1': 'Bleiben Sie informiert.',
    'home.hero.line2': 'Kaufen und leben Sie mit Vertrauen.',
    'home.lead': 'Durchsuchen Sie offizielle Rückrufhinweise aus vertrauenswürdigen Quellen weltweit.',
    'home.searchLabel': 'Marke, Produkt, Modell, Barcode, Charge, Datum oder Rückrufnummer',
    'home.searchPlaceholder': 'Nach Marke, Produkt, Modell, Barcode, Charge oder Rückrufnummer suchen',
    'home.searchButton': 'Rückrufe suchen',
    'home.trust': 'Offizielle Rückrufe. Vertrauenswürdige Quellen. Globale Abdeckung.',
    'home.countLine': '{total} Rückrufe aus {sources} offiziellen Quellen.',
    'home.productTypesHeading': 'Nach Produkttyp suchen',
    'home.sourcesHeading': 'Nach Quelle suchen',
    'home.latestHeading': 'Neueste Rückrufe',
    'home.watchlistHeading': 'Behalten Sie wichtige Produkte im Blick',
    'home.watchlistCopy': 'Suchen werden nur in diesem Browser gespeichert. Noch kein Konto, keine E-Mail und keine Benachrichtigungen.',
    'home.openSavedSearches': 'Gespeicherte Suchen öffnen',
    'footer.disclaimer':
      'Recall Radar hilft, mögliche Rückrufhinweise zu finden. Suchergebnisse sind keine Sicherheitsbestätigung. Prüfen Sie Modelle, Chargen, Daten, Vertrieb und Abhilfen immer anhand des offiziellen Hinweises.',
    'checker.title': 'Rückrufe suchen',
    'checker.lead': 'Suchen Sie nach Produkt, Marke, Modell, Barcode, Charge, Datum, Zutat oder Rückrufnummer.',
    'checker.countLine': '{total} Rückrufe aus {sources} offiziellen Quellen durchsuchen.',
    'checker.searchPlaceholder': 'Produkt, Marke, Modell, Barcode, Charge oder Rückrufnummer eingeben',
    'checker.searchButton': 'Suchen',
    'checker.moreFilters': 'Weitere Filter',
    'checker.countrySource': 'Land oder Quelle',
    'checker.productType': 'Produkttyp',
    'checker.issueHazard': 'Problem oder Risiko',
    'checker.date': 'Datum',
    'checker.sort': 'Sortieren',
    'checker.warning': 'Ergebnisse sind mögliche Treffer. Prüfen Sie immer den offiziellen Hinweis.',
    'checker.browseInstead': 'Stattdessen durchsuchen:',
    'checker.noClearMatch': 'Kein eindeutiger Treffer',
    'directory.productTypesEyebrow': 'Produkttypen',
    'directory.productTypesTitle': 'Rückrufe nach Produkttyp finden',
    'directory.productTypesLead': 'Offizielle Rückrufhinweise nach betroffener Produktart durchsuchen.',
    'directory.countriesEyebrow': 'Länder',
    'directory.countriesTitle': 'Rückrufe nach Land oder Quelle durchsuchen',
    'directory.countriesLead': 'Wählen Sie ein Land oder eine Quelle, um offizielle Rückrufhinweise in Recall Radar zu prüfen.',
    'error.pageNotFound': 'Seite nicht gefunden'
  },
  pt: {
    ...enMessages,
    'language.label': 'Idioma',
    'nav.checker': 'Recalls de produtos',
    'nav.productTypes': 'Tipos de produto',
    'nav.countries': 'Países',
    'nav.watchlist': 'Buscas salvas',
    'common.viewRecall': 'Ver recall',
    'common.viewRecalls': 'Ver recalls',
    'common.viewAllProductTypes': 'Ver todos os tipos',
    'common.showFewerProductTypes': 'Mostrar menos tipos',
    'common.viewAllSources': 'Ver todas as fontes',
    'common.viewAllRecalls': 'Ver todos os recalls',
    'common.try': 'Teste:',
    'common.examples': 'Exemplos:',
    'common.recallsCount': '{count} recalls',
    'home.hero.line1': 'Fique informado.',
    'home.hero.line2': 'Compre e viva com confiança.',
    'home.lead': 'Pesquise avisos oficiais de recall de fontes confiáveis ao redor do mundo.',
    'home.searchLabel': 'Marca, produto, modelo, código de barras, lote, data ou número do recall',
    'home.searchPlaceholder': 'Pesquise por marca, produto, modelo, código de barras, lote ou número do recall',
    'home.searchButton': 'Pesquisar recalls',
    'home.trust': 'Recalls oficiais. Fontes confiáveis. Cobertura global.',
    'home.countLine': '{total} recalls de {sources} fontes oficiais.',
    'home.productTypesHeading': 'Explorar por tipo de produto',
    'home.sourcesHeading': 'Explorar por fonte',
    'home.latestHeading': 'Recalls recentes',
    'home.watchlistHeading': 'Acompanhe produtos importantes para você',
    'home.watchlistCopy': 'As buscas ficam salvas apenas neste navegador. Ainda não há conta, e-mail ou alertas.',
    'home.openSavedSearches': 'Abrir buscas salvas',
    'footer.disclaimer':
      'Recall Radar ajuda a encontrar possíveis avisos de recall. Resultados de busca não confirmam segurança. Verifique sempre modelos, lotes, datas, distribuição e ações no aviso oficial.',
    'checker.title': 'Pesquisar recalls',
    'checker.lead': 'Pesquise por produto, marca, modelo, código de barras, lote, data, ingrediente ou número do recall.',
    'checker.countLine': 'Pesquise {total} recalls de {sources} fontes oficiais.',
    'checker.searchPlaceholder': 'Digite produto, marca, modelo, código de barras, lote ou número do recall',
    'checker.searchButton': 'Pesquisar',
    'checker.moreFilters': 'Mais filtros',
    'checker.countrySource': 'País ou fonte',
    'checker.productType': 'Tipo de produto',
    'checker.issueHazard': 'Problema ou risco',
    'checker.date': 'Data',
    'checker.sort': 'Ordenar',
    'checker.warning': 'Os resultados são possíveis correspondências. Verifique sempre o aviso oficial.',
    'checker.browseInstead': 'Ou explore:',
    'checker.noClearMatch': 'Nenhuma correspondência clara',
    'directory.productTypesEyebrow': 'Tipos de produto',
    'directory.productTypesTitle': 'Encontrar recalls por tipo de produto',
    'directory.productTypesLead': 'Explore avisos oficiais de recall pelo tipo de produto envolvido.',
    'directory.countriesEyebrow': 'Países',
    'directory.countriesTitle': 'Explorar recalls por país ou fonte',
    'directory.countriesLead': 'Escolha um país ou fonte para revisar avisos oficiais de recall disponíveis no Recall Radar.',
    'error.pageNotFound': 'Página não encontrada'
  }
};

export function getMessage(key: MessageKey, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return messages[locale]?.[key] ?? messages[DEFAULT_LOCALE][key];
}

function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return Boolean(value && (SUPPORTED_LOCALES as readonly string[]).includes(value));
}

function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const storedLocale = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  const browserLocale = window.navigator.language.split('-')[0];
  return isSupportedLocale(browserLocale) ? browserLocale : DEFAULT_LOCALE;
}

function formatMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => values[key] ?? '');
}

function readTemplateValues(element: HTMLElement): Record<string, string> {
  const raw = element.dataset.i18nValues;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]))
      : {};
  } catch {
    return {};
  }
}

export function applyUiLanguage(locale: SupportedLocale): void {
  document.documentElement.lang = locale;

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n as MessageKey | undefined;
    if (key) {
      element.textContent = getMessage(key, locale);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-template]').forEach((element) => {
    const key = element.dataset.i18nTemplate as MessageKey | undefined;
    if (key) {
      element.textContent = formatMessage(getMessage(key, locale), readTemplateValues(element));
    }
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder as MessageKey | undefined;
    if (key) {
      element.placeholder = getMessage(key, locale);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel as MessageKey | undefined;
    if (key) {
      element.setAttribute('aria-label', getMessage(key, locale));
    }
  });

  document.querySelectorAll<HTMLSelectElement>('[data-ui-language-select]').forEach((select) => {
    select.value = locale;
  });
}

export function initUiLanguageSwitcher(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const initialLocale = getInitialLocale();
  applyUiLanguage(initialLocale);

  document.querySelectorAll<HTMLSelectElement>('[data-ui-language-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const locale = isSupportedLocale(select.value) ? select.value : DEFAULT_LOCALE;
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, locale);
      applyUiLanguage(locale);
    });
  });
}
