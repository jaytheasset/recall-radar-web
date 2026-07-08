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
  'common.clear': 'Clear',
  'common.remove': 'Remove',
  'common.countrySource': 'Country / source',
  'common.productFamily': 'Product family',
  'common.product': 'Product',
  'common.brandCompany': 'Brand/company',
  'common.classification': 'Classification',
  'common.matchReason': 'Match reason',
  'common.allCategories': 'All categories',
  'common.allMarkets': 'All markets',
  'common.general': 'General',
  'common.recallNotices': 'Recall notices',
  'common.searchThisSource': 'Search this source',
  'common.searchThisFamily': 'Search this family',
  'common.checkAnotherProduct': 'Check another product',
  'common.noRecallNotices': 'No recall notices are currently available.',
  'common.try': 'Try:',
  'common.examples': 'Examples:',
  'common.recallsCount': '{count} recalls',
  'common.recallNoticesCount': '{count} recall notices',
  'common.savedItemsCount': '{count} saved items',
  'common.viewRecallFor': 'View recall for {title}',
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
  'checker.narrowResults': 'Narrow results',
  'checker.productBrand': 'Product / brand',
  'checker.whyShown': 'Why shown',
  'checker.notListedInNotice': 'Not listed in the recall notice.',
  'checker.groupStrongMatches': 'Strong matches',
  'checker.groupPossibleMatches': 'Possible matches',
  'checker.groupRelatedNotices': 'Related notices',
  'checker.groupMatchingRecallNotices': 'Matching recall notices',
  'checker.groupSortedRecallResults': 'Sorted recall results',
  'checker.filteredNotices': 'Filtered notices',
  'checker.allCountriesSources': 'All countries and sources',
  'checker.allIssues': 'all issues',
  'checker.allTime': 'all time',
  'checker.lastDays': 'last {days} days',
  'checker.bestMatch': 'best match',
  'checker.newestFirst': 'newest first',
  'checker.oldestFirst': 'oldest first',
  'checker.showingFor': 'Showing recall notices for {filters}.',
  'checker.possibleMatchesFor': 'Possible recall matches for "{query}".',
  'checker.saveSearchMissing': 'Enter a search term before saving it in this browser.',
  'checker.saveSearchSaved': 'Saved "{query}" in this browser.',
  'checker.noClearMatch': 'No clear match found',
  'checker.noResultSafety':
    'We did not find a clear match in the recall notices. This does not mean the product is safe or recall-free. Try searching by brand name, model number, UPC/barcode, lot code, ingredient, allergen, or product type.',
  'checker.suggestionBrand': 'Brand or company name',
  'checker.suggestionModel': 'Model number or item number',
  'checker.suggestionBarcode': 'Barcode, UPC, GTIN, or EAN when listed',
  'checker.suggestionLot': 'Lot, batch, or date mark',
  'checker.suggestionPack': 'Pack size, certification number, or recall number',
  'checker.suggestionIngredient': 'Ingredient or allergen',
  'checker.suggestionProductType': 'Product type or family',
  'search.matchStrong': 'Strong match',
  'search.matchPossible': 'Possible match',
  'search.matchRelated': 'Related notice',
  'search.matchNone': 'No clear match',
  'search.matchedByBrand': 'Matched by brand/company',
  'disclaimer.possibleMatches':
    'Search results are possible matches, not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.',
  'directory.productTypesEyebrow': 'Product types',
  'directory.productTypesTitle': 'Find recalls by product type',
  'directory.productTypesLead': 'Explore official recall notices by the kind of product involved.',
  'directory.countriesEyebrow': 'Countries',
  'directory.countriesTitle': 'Browse recalls by country or source',
  'directory.countriesLead': 'Choose a country or source to review official recall notices searchable in Recall Radar.',
  'watchlist.savedInBrowser': 'Saved in this browser',
  'watchlist.eyebrow': 'Browser watchlist',
  'watchlist.lead': 'Save searches and brands in this browser, then preview matching recall notices from official sources.',
  'watchlist.emailPreviewTitle': 'Email preview only',
  'watchlist.emailPreviewCopy': 'This non-submitting form previews a future preference. It does not send, store, or transmit an email address.',
  'watchlist.emailPreviewLabel': 'Email preview',
  'watchlist.previewPreference': 'Preview preference',
  'watchlist.savedItems': 'Saved items',
  'watchlist.savedItemsCopy': 'Saved searches stay on this device. No account or email alerts are enabled yet.',
  'watchlist.clearAll': 'Clear all',
  'watchlist.savedPreviewEyebrow': 'Saved recall previews',
  'watchlist.savedPreviewTitle': 'Saved recall previews',
  'watchlist.savedPreviewCopy': 'Cards are matched in this browser from recall notices.',
  'watchlist.saveAnotherSearch': 'Save another search',
  'watchlist.empty': 'No saved searches or brands yet. Use Product Recalls or a brand page to add saved items.',
  'watchlist.brandPagePath': 'Brand page: {path}',
  'watchlist.noEmailStored': 'No email is sent or stored. The value stays only in this browser field.',
  'detail.howToVerify': 'How to verify',
  'detail.recallNotice': 'Recall notice',
  'detail.productImages': 'Product images',
  'detail.quickCheck': 'Quick check',
  'detail.brandNotListed': 'Brand or company not listed',
  'detail.categoryNeedsReview': 'Category needs review',
  'detail.riskIssue': 'Risk / issue',
  'detail.whatToDo': 'What to do',
  'detail.whatToCheck': 'What to check',
  'detail.checkProductDetails': 'Check these product details',
  'detail.checkProductDetailsCopy': 'Match these details against the product label, packaging, receipt, seller information, and official notice.',
  'detail.noticeDetails': 'Notice details',
  'detail.contactCompanyDetails': 'Contact, seller, and company details',
  'detail.officialSource': 'Official source',
  'detail.verifySourceNotice': 'Verify against the source notice',
  'detail.viewOfficialNotice': 'View official notice',
  'detail.officialSourceFields': 'Official source fields',
  'detail.brandHistory': 'Brand history',
  'detail.otherBrandRecalls': 'Other recalls from this brand or company',
  'detail.noBrandRecalls': 'No other recalls from this brand or company were found.',
  'detail.relatedRecalls': 'Related recalls',
  'detail.similarRecalls': 'Similar recalls',
  'detail.relatedRecallsCopy': 'Based on product type and issue labels.',
  'detail.noSimilarRecalls': 'No similar recalls were found.',
  'detail.viewBrandPage': 'View this brand page',
  'category.indexedNotices': 'Recall notices',
  'category.filterByProductFamily': 'Filter by product family',
  'category.filterSourceCopy': 'Narrow this source group without leaving the page.',
  'category.resultsShown': '{shown} of {total} recall notices shown',
  'category.sourceGroupCopy': 'Shown from this official source group.',
  'category.productFamilyCopy': 'Recall notices related to this product type and issue area.',
  'category.noSourceGroupNotices': 'No recall notices are currently available for this source group.',
  'category.noProductTypeNotices': 'No recall notices are currently listed for this product type.',
  'brand.eyebrow': 'Brand page',
  'brand.titlePrefix': 'Recalls linked to',
  'brand.lead': 'Recall notices linked to this brand, company, importer, recalling firm, or related product name.',
  'brand.saveBrand': 'Save this brand in this browser',
  'brand.viewWatchlist': 'View watchlist',
  'brand.officialSourceNames': 'Official source names',
  'brand.officialSourceNamesCopy': 'Official notices may list a brand, importer, recalling firm, or legal company name differently.',
  'brand.noticesEyebrow': 'Brand notices',
  'brand.noticesTitle': 'Recall notices linked to this brand/company',
  'brand.noticesCopy': 'Cards are based on recall notices connected to this brand/company page.',
  'error.pageNotFoundEyebrow': 'Page not found',
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
    'watchlist.savedInBrowser': '이 브라우저에 저장됨',
    'watchlist.eyebrow': '브라우저 관심 목록',
    'watchlist.lead': '검색어와 브랜드를 이 브라우저에 저장하고, 공식 출처의 관련 리콜 공지를 미리 확인하세요.',
    'watchlist.emailPreviewTitle': '이메일 미리보기 전용',
    'watchlist.emailPreviewCopy': '이 양식은 향후 알림 설정을 미리 보여주기 위한 것입니다. 이메일을 보내거나 저장하거나 전송하지 않습니다.',
    'watchlist.emailPreviewLabel': '이메일 미리보기',
    'watchlist.previewPreference': '설정 미리보기',
    'watchlist.savedItems': '저장된 항목',
    'watchlist.savedItemsCopy': '저장된 검색은 이 기기에만 남습니다. 아직 계정이나 이메일 알림은 없습니다.',
    'watchlist.clearAll': '모두 지우기',
    'watchlist.savedPreviewEyebrow': '저장된 리콜 미리보기',
    'watchlist.savedPreviewTitle': '저장된 리콜 미리보기',
    'watchlist.savedPreviewCopy': '카드는 이 브라우저에서 리콜 공지와 대조해 표시됩니다.',
    'watchlist.saveAnotherSearch': '다른 검색 저장하기',
    'watchlist.empty': '아직 저장된 검색어나 브랜드가 없습니다. 제품 리콜 검색 또는 브랜드 페이지에서 항목을 추가하세요.',
    'watchlist.brandPagePath': '브랜드 페이지: {path}',
    'watchlist.noEmailStored': '이메일은 전송되거나 저장되지 않습니다. 입력값은 이 브라우저 필드 안에만 남습니다.',
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
    'watchlist.savedInBrowser': 'このブラウザに保存済み',
    'watchlist.eyebrow': 'ブラウザのウォッチリスト',
    'watchlist.lead': '検索語句やブランドをこのブラウザに保存し、公式情報源の関連リコール通知を確認できます。',
    'watchlist.emailPreviewTitle': 'メールプレビューのみ',
    'watchlist.emailPreviewCopy': 'このフォームは将来の通知設定を確認するためのものです。メールの送信、保存、転送は行いません。',
    'watchlist.emailPreviewLabel': 'メールプレビュー',
    'watchlist.previewPreference': '設定をプレビュー',
    'watchlist.savedItems': '保存済み項目',
    'watchlist.savedItemsCopy': '保存した検索はこの端末にのみ残ります。アカウントやメール通知はまだ有効ではありません。',
    'watchlist.clearAll': 'すべて削除',
    'watchlist.savedPreviewEyebrow': '保存済みリコールのプレビュー',
    'watchlist.savedPreviewTitle': '保存済みリコールのプレビュー',
    'watchlist.savedPreviewCopy': 'カードはこのブラウザ内でリコール通知と照合して表示されます。',
    'watchlist.saveAnotherSearch': '別の検索を保存',
    'watchlist.empty': '保存された検索やブランドはまだありません。製品リコール検索またはブランドページから追加できます。',
    'watchlist.brandPagePath': 'ブランドページ: {path}',
    'watchlist.noEmailStored': 'メールは送信または保存されません。入力値はこのブラウザのフィールド内だけに残ります。',
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
    'watchlist.savedInBrowser': '已保存在此浏览器',
    'watchlist.eyebrow': '浏览器关注列表',
    'watchlist.lead': '在此浏览器保存搜索词和品牌，并预览来自官方来源的相关召回通知。',
    'watchlist.emailPreviewTitle': '仅邮件预览',
    'watchlist.emailPreviewCopy': '此表单仅用于预览未来偏好设置，不会发送、保存或传输电子邮件地址。',
    'watchlist.emailPreviewLabel': '邮件预览',
    'watchlist.previewPreference': '预览偏好',
    'watchlist.savedItems': '已保存项目',
    'watchlist.savedItemsCopy': '保存的搜索只保留在此设备上。当前没有账户或邮件提醒。',
    'watchlist.clearAll': '全部清除',
    'watchlist.savedPreviewEyebrow': '已保存召回预览',
    'watchlist.savedPreviewTitle': '已保存召回预览',
    'watchlist.savedPreviewCopy': '卡片会在此浏览器中根据召回通知匹配显示。',
    'watchlist.saveAnotherSearch': '保存另一次搜索',
    'watchlist.empty': '还没有保存的搜索或品牌。可在产品召回搜索或品牌页面添加。',
    'watchlist.brandPagePath': '品牌页面：{path}',
    'watchlist.noEmailStored': '电子邮件不会被发送或保存。输入内容只停留在此浏览器字段中。',
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
    'watchlist.savedInBrowser': 'Enregistré dans ce navigateur',
    'watchlist.eyebrow': 'Liste suivie du navigateur',
    'watchlist.lead': 'Enregistrez des recherches et des marques dans ce navigateur, puis prévisualisez les avis de rappel correspondants.',
    'watchlist.emailPreviewTitle': 'Aperçu e-mail uniquement',
    'watchlist.emailPreviewCopy': "Ce formulaire prévisualise une future préférence. Il n'envoie, ne stocke ni ne transmet aucune adresse e-mail.",
    'watchlist.emailPreviewLabel': 'Aperçu e-mail',
    'watchlist.previewPreference': 'Prévisualiser la préférence',
    'watchlist.savedItems': 'Éléments enregistrés',
    'watchlist.savedItemsCopy': "Les recherches enregistrées restent sur cet appareil. Aucun compte ni alerte e-mail n'est encore activé.",
    'watchlist.clearAll': 'Tout effacer',
    'watchlist.savedPreviewEyebrow': 'Aperçus de rappels enregistrés',
    'watchlist.savedPreviewTitle': 'Aperçus de rappels enregistrés',
    'watchlist.savedPreviewCopy': 'Les cartes sont mises en correspondance dans ce navigateur à partir des avis de rappel.',
    'watchlist.saveAnotherSearch': 'Enregistrer une autre recherche',
    'watchlist.empty': 'Aucune recherche ou marque enregistrée pour le moment. Ajoutez-en depuis Product Recalls ou une page de marque.',
    'watchlist.brandPagePath': 'Page de marque : {path}',
    'watchlist.noEmailStored': "Aucun e-mail n'est envoyé ou stocké. La valeur reste seulement dans ce champ du navigateur.",
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
    'watchlist.savedInBrowser': 'Guardado en este navegador',
    'watchlist.eyebrow': 'Lista guardada del navegador',
    'watchlist.lead': 'Guarda búsquedas y marcas en este navegador y previsualiza avisos de retiro relacionados de fuentes oficiales.',
    'watchlist.emailPreviewTitle': 'Solo vista previa de email',
    'watchlist.emailPreviewCopy': 'Este formulario solo muestra una preferencia futura. No envía, guarda ni transmite ninguna dirección de email.',
    'watchlist.emailPreviewLabel': 'Vista previa de email',
    'watchlist.previewPreference': 'Previsualizar preferencia',
    'watchlist.savedItems': 'Elementos guardados',
    'watchlist.savedItemsCopy': 'Las búsquedas guardadas permanecen en este dispositivo. Todavía no hay cuenta ni alertas por email.',
    'watchlist.clearAll': 'Borrar todo',
    'watchlist.savedPreviewEyebrow': 'Vistas previas de retiros guardados',
    'watchlist.savedPreviewTitle': 'Vistas previas de retiros guardados',
    'watchlist.savedPreviewCopy': 'Las tarjetas se comparan en este navegador con avisos de retiro.',
    'watchlist.saveAnotherSearch': 'Guardar otra búsqueda',
    'watchlist.empty': 'Aún no hay búsquedas ni marcas guardadas. Añade elementos desde Product Recalls o desde una página de marca.',
    'watchlist.brandPagePath': 'Página de marca: {path}',
    'watchlist.noEmailStored': 'El email no se envía ni se guarda. El valor permanece solo en este campo del navegador.',
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
    'watchlist.savedInBrowser': 'In diesem Browser gespeichert',
    'watchlist.eyebrow': 'Browser-Watchlist',
    'watchlist.lead': 'Speichern Sie Suchen und Marken in diesem Browser und prüfen Sie passende Rückrufhinweise aus offiziellen Quellen.',
    'watchlist.emailPreviewTitle': 'Nur E-Mail-Vorschau',
    'watchlist.emailPreviewCopy': 'Dieses Formular zeigt nur eine zukünftige Einstellung. Es sendet, speichert oder überträgt keine E-Mail-Adresse.',
    'watchlist.emailPreviewLabel': 'E-Mail-Vorschau',
    'watchlist.previewPreference': 'Einstellung anzeigen',
    'watchlist.savedItems': 'Gespeicherte Einträge',
    'watchlist.savedItemsCopy': 'Gespeicherte Suchen bleiben auf diesem Gerät. Es gibt noch kein Konto und keine E-Mail-Benachrichtigungen.',
    'watchlist.clearAll': 'Alles löschen',
    'watchlist.savedPreviewEyebrow': 'Gespeicherte Rückrufvorschauen',
    'watchlist.savedPreviewTitle': 'Gespeicherte Rückrufvorschauen',
    'watchlist.savedPreviewCopy': 'Karten werden in diesem Browser anhand von Rückrufhinweisen abgeglichen.',
    'watchlist.saveAnotherSearch': 'Weitere Suche speichern',
    'watchlist.empty': 'Noch keine gespeicherten Suchen oder Marken. Fügen Sie Einträge über Product Recalls oder eine Markenseite hinzu.',
    'watchlist.brandPagePath': 'Markenseite: {path}',
    'watchlist.noEmailStored': 'Es wird keine E-Mail gesendet oder gespeichert. Der Wert bleibt nur in diesem Browserfeld.',
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
    'watchlist.savedInBrowser': 'Salvo neste navegador',
    'watchlist.eyebrow': 'Lista salva do navegador',
    'watchlist.lead': 'Salve buscas e marcas neste navegador e veja prévias de avisos de recall correspondentes.',
    'watchlist.emailPreviewTitle': 'Apenas prévia de e-mail',
    'watchlist.emailPreviewCopy': 'Este formulário apenas mostra uma preferência futura. Ele não envia, salva nem transmite endereço de e-mail.',
    'watchlist.emailPreviewLabel': 'Prévia de e-mail',
    'watchlist.previewPreference': 'Pré-visualizar preferência',
    'watchlist.savedItems': 'Itens salvos',
    'watchlist.savedItemsCopy': 'As buscas salvas ficam neste dispositivo. Ainda não há conta nem alertas por e-mail.',
    'watchlist.clearAll': 'Limpar tudo',
    'watchlist.savedPreviewEyebrow': 'Prévias de recalls salvos',
    'watchlist.savedPreviewTitle': 'Prévias de recalls salvos',
    'watchlist.savedPreviewCopy': 'Os cards são comparados neste navegador com avisos de recall.',
    'watchlist.saveAnotherSearch': 'Salvar outra busca',
    'watchlist.empty': 'Ainda não há buscas ou marcas salvas. Adicione itens em Product Recalls ou em uma página de marca.',
    'watchlist.brandPagePath': 'Página da marca: {path}',
    'watchlist.noEmailStored': 'Nenhum e-mail é enviado ou salvo. O valor fica apenas neste campo do navegador.',
    'error.pageNotFound': 'Página não encontrada'
  }
};

export function getMessage(key: MessageKey, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return messages[locale]?.[key] ?? messages[DEFAULT_LOCALE][key];
}

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
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

export function getCurrentUiLanguage(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const storedLocale = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  const documentLocale = document.documentElement.lang.split('-')[0];
  if (isSupportedLocale(documentLocale)) {
    return documentLocale;
  }

  const browserLocale = window.navigator.language.split('-')[0];
  return isSupportedLocale(browserLocale) ? browserLocale : DEFAULT_LOCALE;
}

export function formatUiMessage(
  key: MessageKey,
  values: Record<string, string | number>,
  locale: SupportedLocale = getCurrentUiLanguage()
): string {
  return formatMessage(
    getMessage(key, locale),
    Object.fromEntries(Object.entries(values).map(([valueKey, value]) => [valueKey, String(value)]))
  );
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
