/* =============================================================
   東宣版 導線オーケストレーション（tosen-cta）

   診断エンジン（seven-cta.js）には一切干渉しない。
   成績表DOMの出現を MutationObserver で検知して読み取り、
   処方箋ブリッジ・追従CTA・Exit Intent・流入出し分けを担う。

   - 処方箋ブリッジ : ×カテゴリ → 王道メディア処方＋実数（出典明記）
   - 追従CTA       : スクロール75%で出現（SSOT確定値）・状態別文言
   - Exit Intent   : 3分岐（診断前／PDF未保存／未相談）
   - 流入出し分け  : ?from=column|price&t={ローマ数字}
   - 計測          : 相談クリックの placement 付きイベント
============================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     処方箋データ（カテゴリ＝ローマ数字キー。診断定義には不干渉）
     実数は SSOT の「引用可」データのみ使用。社名は掲載許諾の
     確定後に実名へ差し替える（現状は業種表記・ダミー数値は不使用）。
  ----------------------------------------------------------- */
  var RX = {
    'I': {
      hole: '検索で見つけてもらえていない可能性があります',
      rx: '検索やWeb広告に頼らず商圏へ直接届く、新聞折込・地域TV・ラジオで「検索しない層」からの認知をつくる打ち手が有効です。',
      media: [
        { label: '新聞折込', icon: 'i-doc-lines', url: '/service/insert/' },
        { label: '地域TV', icon: 'i-tv', url: '/service/tv/' },
        { label: 'ラジオ', icon: 'i-radio', url: '/service/radio/' }
      ],
      cta: { label: '折込チラシで商圏に直接届ける方法を見る', url: '/service/insert/' },
      ev: '紙・交通広告を起点にしたキャンペーンで、LP流入 <strong>14,000件超</strong> の実績があります。',
      src: '出典：東宣 実施実績（がん啓発キャンペーン／流入＝LPセッション数）'
    },
    'II': {
      hole: 'サイトの強みが伝わる前に離脱されている可能性があります',
      rx: '新聞・住宅情報誌・折込のクリエイティブで「伝わる訴求」を設計し、サイトへ還流させる導線が有効です（制作はグループ会社TACと一気通貫）。',
      media: [
        { label: '新聞広告', icon: 'i-doc-lines', url: '/service/newspaper/' },
        { label: '雑誌・専門誌', icon: 'i-doc-lines', url: '/service/magazine/' }
      ],
      cta: { label: '新聞広告で"伝わる訴求"をつくる方法を見る', url: '/service/newspaper/' },
      ev: '関東・関西の住宅会社で、ブランディングTVCMからメディアプラン・バイイングまでの一括運用実績があります。',
      src: '※社名・数値は掲載許諾の確定後に表示します'
    },
    'III': {
      hole: '会社を信頼してもらう根拠が不足している可能性があります',
      rx: '第三者公査（日本ABC協会）の部数データを持つ新聞や地域TVへの掲載は、それ自体が「マス媒体に載っている会社」という信用補完になります。',
      media: [
        { label: '新聞広告', icon: 'i-doc-lines', url: '/service/newspaper/' },
        { label: '地域TV', icon: 'i-tv', url: '/service/tv/' }
      ],
      cta: { label: '新聞広告で会社の信用を補強する方法を見る', url: '/service/newspaper/' },
      ev: '東宣は官公庁・公的機関（国税局・警察・自治体 等）の広告実績を多数持つ、創業1948年の広告会社です。',
      src: '出典：東宣 業務実績（公的機関案件）'
    },
    'IV': {
      hole: '訪問者がサイト内で迷い、行動にたどり着けていない可能性があります',
      rx: '折込チラシ＋QRコードなら「電話・来店・LP直行」の一直線導線を紙側に設計でき、サイト内の迷子を回避できます。',
      media: [
        { label: '新聞折込', icon: 'i-doc-lines', url: '/service/insert/' },
        { label: '交通・OOH', icon: 'i-train', url: '/service/ooh/' }
      ],
      cta: { label: '折込＋QRで"一直線の導線"をつくる方法を見る', url: '/service/insert/' },
      ev: '紙・交通広告を起点にしたLP直行導線で、流入 <strong>14,000件超</strong> の実績があります。',
      src: '出典：東宣 実施実績（がん啓発キャンペーン／流入＝LPセッション数）'
    },
    'V': {
      hole: '安心して集客・出稿できる状態ではない可能性があります',
      rx: 'まずWeb側の改善が先決です。無料相談で対処の方針をご案内します。並行して、紙媒体はサイトの状態に左右されず商圏へ届く手段として使えます。',
      media: [
        { label: 'まずWeb改善', icon: 'i-wrench', url: null }
      ],
      cta: { label: 'Web改善の進め方を無料相談で聞く', url: '/contact/', consult: true },
      ev: null,
      src: null
    },
    'VI': {
      hole: '表示の遅さ・見づらさで、せっかくの訪問者が離脱している可能性があります',
      rx: 'まず受け皿（サイト）の改善が先決です。無料相談で対処の方針をご案内します。紙媒体は表示速度に依存しない到達手段として並走できます。',
      media: [
        { label: 'まずWeb改善', icon: 'i-wrench', url: null },
        { label: '新聞折込', icon: 'i-doc-lines', url: '/service/insert/' }
      ],
      cta: { label: 'Web改善の進め方を無料相談で聞く', url: '/contact/', consult: true },
      ev: null,
      src: null
    },
    'VII': {
      hole: '効果が測れておらず、販促の良し悪しを判断できない可能性があります',
      rx: 'クーポン・QRコード付きの折込は、反響が「回収枚数」でそのまま数えられる、計測できるマス媒体です。数字で判断する販促に切り替えられます。',
      media: [
        { label: '新聞折込', icon: 'i-doc-lines', url: '/service/insert/' },
        { label: '新聞広告', icon: 'i-doc-lines', url: '/service/newspaper/' }
      ],
      cta: { label: '反響を"枚数"で数える折込の使い方を見る', url: '/service/insert/' },
      ev: '媒体接触の実測例として、総接触 <strong>6,024,186人</strong> を記録した企画があります。',
      src: '出典：東宣 実施実績（渋沢栄一関連企画／総接触＝各媒体接触人数の合算）'
    }
  };

  /* アンケート「いちばん近いお悩み」→ お困り事カード（マッピングC）
     ※「何から手をつけるべきか」は個別ページがないため /solution/ 一覧へ */
  var SOLUTION_CARDS = {
    '折込・チラシの反応が落ちた': {
      url: '/solution/insert-response/', card: 'solution_insert',
      ttl: '折込・チラシの反応が落ちた方へ', tag: 'お困り事別ガイド',
      text: '「紙が効かなくなった」のではなく「効かせ方が変わった」。原因と立て直し方をまとめました。',
      link: '対策を見る'
    },
    'Web広告に手応えがない': {
      url: '/solution/web-ads/', card: 'solution_webads',
      ttl: 'Web広告に手応えがない方へ', tag: 'お困り事別ガイド',
      text: 'クリック単価の高騰、刺さらない訴求。Web広告の限界と補い方を整理しました。',
      link: '対策を見る'
    },
    '何から手をつけるべきか知りたい': {
      url: '/solution/', card: 'solution_top',
      ttl: 'お困り事から探す', tag: 'お困り事別ガイド',
      text: '「反応が落ちた」「手応えがない」——よくあるお困り事別に、原因と打ち手をまとめています。',
      link: '一覧を見る'
    }
  };

  var state = {
    from: null,        // column | price | null
    focusCat: null,    // ?t= で指定されたローマ数字
    reportDone: false,
    surveyTrigger: null,  // アンケート「いちばん近いお悩み」の回答
    surveyIndustry: null, // アンケート「業種」の回答（PDF業界表示用）
    pdfSaved: false,
    exitShown: false,
    stickyClosed: false
  };

  function $(id) { return document.getElementById(id); }

  /* GA4イベント（タグ未設置の環境では何もしない） */
  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function iconSvg(id) {
    return '<svg class="-w-icon" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  /* -----------------------------------------------------------
     1. 流入出し分け（収束導線A/B/Cの受け）
  ----------------------------------------------------------- */
  function initEntryParams() {
    var params = new URLSearchParams(location.search);
    state.from = params.get('from');
    var t = (params.get('t') || '').toUpperCase();
    if (RX[t]) state.focusCat = t;

    var lead = $('entry-lead');
    if (!lead) return;

    if (state.from === 'column') {
      // 導線A：コラム記事から
      lead.innerHTML = '記事でご覧いただいた"効きにくさ"の原因は、<br class="-w-sp">サイト側の穴かもしれません。21項目で確かめてください。';
    } else if (state.from === 'price') {
      // 導線B：費用・料金ページから
      lead.innerHTML = '料金を比べる前に、まず「どこにいくら掛けるべきか」を<br class="-w-sp">無料診断で確かめてください。';
    }
    track('page_view_diag', { tsn_from: state.from || 'direct', tsn_t: state.focusCat || '' });
  }

  /* -----------------------------------------------------------
     2. 成績表の読み取り → 処方箋ブリッジ生成
        （エンジン非干渉：出力DOMを読むだけ）
  ----------------------------------------------------------- */
  function parseReport(container) {
    var rows = container.querySelectorAll('.-w-report-row');
    var results = [];
    rows.forEach(function (row) {
      var romanEl = row.querySelector('.-w-report-row-roman');
      var nameEl = row.querySelector('.-w-report-row-name');
      var judgeEl = row.querySelector('.-w-report-row-judge');
      if (!romanEl || !judgeEl) return;
      var judge = judgeEl.classList.contains('-w-judge-fail') ? 'fail'
        : judgeEl.classList.contains('-w-judge-warn') ? 'warn' : 'pass';
      results.push({
        roman: romanEl.textContent.trim(),
        name: nameEl ? nameEl.textContent.trim() : '',
        judge: judge
      });
    });
    return results;
  }

  function buildBridgeCard(result) {
    var rx = RX[result.roman];
    if (!rx) return '';
    // 媒体チップ：サービスページがあるものはリンク（1×1の原則：処方→その媒体の売り場へ）
    var media = rx.media.map(function (m) {
      if (m.url) {
        return '<a href="' + m.url + '" data-tsn-card data-card="bridge_media" data-category="' + result.roman + '">' +
          iconSvg(m.icon) + m.label + '</a>';
      }
      return '<span>' + iconSvg(m.icon) + m.label + '</span>';
    }).join('');
    var ev = rx.ev
      ? '<div class="-w-bridge-ev">' + rx.ev +
        (rx.src ? '<span class="-w-bridge-src">' + rx.src + '</span>' : '') + '</div>'
      : '';
    // カテゴリ別CTA：解決策ページへ直行（V/VIはWeb改善＝無料相談へ）
    var ctaAttr = rx.cta.consult
      ? 'data-tsn-consult data-placement="bridge_web"'
      : 'data-tsn-card data-card="bridge_service" data-category="' + result.roman + '"';
    return '<div class="-w-bridge-card" data-category="' + result.roman + '">' +
      '<div class="-w-bridge-card-top">' +
        '<span class="-w-bridge-x">' + iconSvg('i-close') + '×判定</span>' +
        '<span class="-w-bridge-hole">' + result.roman + '. ' + result.name + '：' + rx.hole + '</span>' +
      '</div>' +
      '<p class="-w-bridge-rx">' + rx.rx + '</p>' +
      '<div class="-w-bridge-media">' + media + '</div>' +
      ev +
      '<a class="-w-bridge-cta" href="' + rx.cta.url + '" ' + ctaAttr + '>' + rx.cta.label +
        iconSvg('i-arrow-right') + '</a>' +
    '</div>';
  }

  function renderBridge(results) {
    var bridge = $('tosen-bridge');
    if (!bridge) return;

    // ×カテゴリを優先（?t= 指定カテゴリは先頭固定）。×ゼロなら△、それもゼロなら全○分岐
    var fails = results.filter(function (r) { return r.judge === 'fail'; });
    var warns = results.filter(function (r) { return r.judge === 'warn'; });
    var targets = fails.length ? fails : warns;
    if (state.focusCat) {
      targets = targets.slice().sort(function (a, b) {
        return (b.roman === state.focusCat) - (a.roman === state.focusCat);
      });
    }
    targets = targets.slice(0, 3);

    var html = '<h2 class="-w-bridge-title">×が付いた項目には、<em>"処方箋"</em>があります。</h2>' +
      '<p class="-w-bridge-lead">見つけて終わりの診断にはしません。×の原因ごとに、Web施策だけでなく' +
      '新聞折込・地域TV・ラジオ・交通広告などの"王道メディア"まで含めた打ち手を処方します。</p>';

    if (targets.length) {
      var label = fails.length ? '' :
        '<p class="-w-bridge-lead">大きな×はありませんでした。惜しい「△」への処方をご案内します。</p>';
      html += label + '<div class="-w-bridge-cards">' +
        targets.map(buildBridgeCard).join('') + '</div>';
    } else {
      html += '<div class="-w-bridge-allpass">' +
        iconSvg('i-megaphone') +
        '<p class="-w-bridge-allpass-ttl">守りは合格。次は攻めの認知です。</p>' +
        '<p class="-w-bridge-allpass-text">サイトの受け皿は整っています。王道メディアで商圏の認知シェアを取りにいく打ち手をご提案できます。</p>' +
        '<div class="-w-bridge-allpass-links">' +
          '<a class="-w-bridge-cta" href="/usp/full-media/" data-tsn-card data-card="usp_fullmedia">王道メディアの使い方を見る' + iconSvg('i-arrow-right') + '</a>' +
          '<a class="-w-bridge-cta" href="/case/" data-tsn-card data-card="case">同業の事例を見る' + iconSvg('i-arrow-right') + '</a>' +
        '</div>' +
      '</div>';
    }

    // 締めCTA：総合リスクで出し分け（重症度ルーティング）
    var closeLead;
    var closeSub = '';
    if (fails.length >= 2) {
      // リスク大・特大：人への接続を最優先
      closeLead = '×が' + fails.length + 'カテゴリあります。どこから直すか、順番の整理からお手伝いします。';
    } else if (fails.length === 1 || warns.length) {
      // リスク中：相談＋自習系（選び方ガイド）を併記
      closeLead = 'あなたの結果に、どの処方が合うか。答え合わせは無料です。';
      closeSub = '<a class="-w-bridge-close-sub" href="/column/" data-tsn-card data-card="column">先に関連コラムを読んでみる</a>';
    } else {
      // リスク小（全○）：攻めの一手の相談
      closeLead = '攻めの一手のご相談も無料です。御社の商圏に合う媒体からご提案します。';
    }

    html += '<div class="-w-bridge-close">' +
      '<p class="-w-bridge-close-lead">' + closeLead + '</p>' +
      '<a class="-w-consult-btn -w-button-click" href="/contact/" data-tsn-consult data-placement="bridge">' +
        iconSvg('i-headset') + '<span>自社に合う処方を無料で聞く</span></a>' +
      closeSub +
    '</div>' +
    '<p class="-w-bridge-note">※掲載の数値は各案件の実績であり、同様の効果をお約束するものではありません。</p>';

    bridge.innerHTML = html;
    bridge.hidden = false;

    track('bridge_view', {
      ng_count: fails.length,
      ng_categories: fails.map(function (r) { return r.roman; }).join(',')
    });
  }

  /* -----------------------------------------------------------
     2b. 印刷専用レポート生成（PDF発行＝window.print 時のみ表示）
         構成: 承認済みサンプルPDF「七つの取りこぼし診断
         Webサイト品質診断レポート」（12ページ）に準拠
         表紙 / 成績表 / カテゴリ詳細×7 / 制作会社 納品品質 /
         ×の埋め方（東宣提案） / 付録
         ※判定（○△×）はエンジン出力を変更せず使用。
           得点・偏差値・順位は表示層の導出値、平均・母数は
           承認サンプル準拠の参考値（本番API接続時に実数へ差し替え）
  ----------------------------------------------------------- */
  var PP_EN = 'WEB PRESENCE QUALITY CHECK REPORT';
  var PP_PAGES = 12;
  var PP_POP_ALL = 76075;   // 全体母数（承認サンプル準拠）
  var PP_POP_IND = 7903;    // 業界内母数（承認サンプル準拠）
  var PP_SIGMA = 15.8;      // 偏差値の標準偏差（付録の計算式と同一）
  var PP_MU_TOTAL = 72;     // 総合平均（付録の計算式と同一）
  var PP_MU_IND = 70.2;     // 業界平均（承認サンプル準拠）

  var PP_CATS = {
    'I':   { no: 1, name: '集客基礎力', latin: 'Superbia', sin: '傲慢',
      sub: '見つけてもらう努力を怠る取りこぼし', avg: 83.05,
      brief: '集客力は、「インデックス設定」「構造化データ」「サイトマップ」の3点セットで作られます。検索エンジンに正しく認識してもらうための基礎設定です。' },
    'II':  { no: 2, name: '接客力', latin: 'Avaritia', sin: '強欲',
      sub: '与えずして奪おうとする取りこぼし', avg: 79.95,
      brief: '接客力は、「USP」「採用情報」「ファーストビュー」の3点セットで作られます。訪問者に「選ぶ理由」を届けるためのコンテンツ力です。' },
    'III': { no: 3, name: '会社信用力', latin: 'Invidia', sin: '嫉妬',
      sub: '他社が持つ信用を羨みながら、自らは信用構築を怠る取りこぼし', avg: 55.23,
      brief: '信用力は、「会社名明記」「ポリシー」「最新情報」の3点セットで作られます。訪問者が「この会社は信頼できる」と判断するための材料です。' },
    'IV':  { no: 4, name: '顧客誘導力', latin: 'Acedia', sin: '怠惰',
      sub: '顧客を導く努力を放棄する取りこぼし', avg: 74.7,
      brief: '誘導力は、「グロナビ」「リンク視認性」「文字サイズ」の3点セットで作られます。訪問者を迷わせず目的地へ導くための道案内です。' },
    'V':   { no: 5, name: '防御力', latin: 'Gula', sin: '暴食',
      sub: '利便性を貪り、セキュリティを犠牲にする取りこぼし', avg: 93.93,
      brief: '防御力は、「WPID対策」「TLS証明書」「Mixed Content」の3点セットで作られます。Webサイトの防犯システム。攻撃者から守るための基本装備です。' },
    'VI':  { no: 6, name: '基礎力', latin: 'Ira', sin: '憤怒',
      sub: '遅さに苛立つユーザーの怒りを招く取りこぼし', avg: 52.58,
      brief: '基礎力は、「スマホ対応」「Core Web Vitals」「画像最適化」の3点セットで作られます。サイトの「基礎工事」。ユーザー体験の土台となる技術品質です。' },
    'VII': { no: 7, name: 'PDCA改善力', latin: 'Luxuria', sin: '色欲',
      sub: '表面の美しさに溺れ、数値による改善を放棄する取りこぼし', avg: 52.03,
      brief: 'PDCA力は、「GA4タグ」「GTM」「計測阻害チェック」の3点セットで作られます。サイトの「体温計」。計測なくして改善なしです。' }
  };

  /* 項目定義（承認サンプルの表記・重要度に準拠。順序はエンジンの項目順と同一）
     w: 表示層スコアの重み（必須=2/推奨=1）
     ok/ng: 検出結果行（デモは定性表現。実測値は本番APIが出力）
     resp: 責任区分 agency=制作会社 / shared=共同 / client=運営者 */
  var PP_ITEMS = {
    'I': [
      { n: 'インデックス拒否設定', imp: '必須', w: 2, resp: 'agency',
        desc: '検索エンジンへの登録（インデックス）を拒否する設定の有無を確認',
        ok: '診断対象ページのindexを阻害する誤設定はありませんでした',
        ng: '診断対象ページのindexを阻害する設定の可能性を検出しました',
        owlOk: '玄関のドアがちゃんと開いている状態です。検索エンジンを歓迎できていますね。合格です。',
        owlNg: '玄関のドアに鍵がかかったままの状態です。検索エンジンがサイトに入れず、検索結果に載れません。最優先で解除しましょう。',
        top3: '検索結果に載らなければ、存在しないのと同じです。',
        fix: 'noindex等の誤設定を確認し解除。設定箇所の修正のみで、即日対応が可能です。' },
      { n: '構造化データの実装', imp: '推奨', w: 1, resp: 'agency',
        desc: '検索エンジンにサイトの意味を伝える「構造化データ」の有無を確認',
        ok: 'JSON-LD構造化データの実装を検知できました',
        ng: '有効な構造化データを検知できませんでした',
        owlOk: 'Googleに「うちはこういう会社です」と名刺を渡せている状態ですね。検索結果で目立てるチャンスがあります。',
        owlNg: 'Googleに名刺を渡せていない状態です。会社情報や事業内容を構造化データで伝えると、検索結果で目立てるようになります。',
        top3: '検索結果での見え方で、同業に差をつけられています。',
        fix: 'JSON-LD形式で構造化データを実装。テンプレート適用で数日で対応できます。' },
      { n: 'XMLサイトマップ取得', imp: '必須', w: 2, resp: 'agency',
        desc: '検索エンジン向けのサイトマップファイル（sitemap.xml）の設置を確認',
        ok: 'sitemap.xml の設置を確認できました',
        ng: 'sitemap.xml を取得できませんでした',
        owlOk: '会社の「フロアマップ」をGoogleに渡せていますね。全部屋を見つけてもらえます。合格です。',
        owlNg: 'Googleに「フロアマップ」を渡せていない状態です。奥のページまで見つけてもらえず、せっかくのコンテンツが検索に載りません。',
        top3: 'サイトの奥のページが検索エンジンに届いていません。',
        fix: 'sitemap.xmlを生成・設置し、Search Consoleへ登録。数日で対応できます。' }
    ],
    'II': [
      { n: 'USP（強み）の明文化', imp: '必須', w: 2, resp: 'shared',
        desc: 'ファーストビュー等における独自の強み（USP）の記載有無を確認',
        ok: 'USPを訴求する見出し・コンテンツを検知できました',
        ng: 'USPを訴求する見出し・コンテンツを検知できませんでした',
        owlOk: '「なぜうちを選ぶべきか」がしっかり言語化されていますね。来店したお客さんを迷わせない接客ができています。',
        owlNg: '「なぜうちを選ぶべきか」が伝わっていない状態です。価格や立地だけで比較され、選ばれる理由を作れていません。',
        top3: '選ばれる理由が言葉になっておらず、比較で負けやすい状態です。',
        fix: '「選ばれる理由」を見出し化してファーストビューへ。既存の強みの言語化から始めましょう。' },
      { n: '採用情報ページ', imp: '推奨', w: 1, resp: 'client',
        desc: '採用情報またはリクルートページの存在を確認',
        ok: '人材採用情報用のページ・リンクを検知できました',
        ng: '人材採用情報用のページ・リンクを検知できませんでした',
        owlOk: '「人が集まる会社」という活力をアピールできていますね。取引先から見ても好印象です。',
        owlNg: '採用情報が見当たりません。「人が集まっている会社か」は、お客様や取引先が信頼を判断する材料のひとつです。',
        top3: '会社の活気が伝わる材料が不足しています。',
        fix: '採用・スタッフ紹介ページを用意。募集がない時期も「働く人の顔」が見えるだけで印象が変わります。' },
      { n: 'ファーストビュー', imp: '推奨', w: 1, resp: 'shared',
        desc: 'ファーストビューで「何のサイトか」がMETA情報と合致しているかを確認',
        ok: 'ファーストビューの訴求とMETA情報の合致を確認できました',
        ng: 'ファーストビューの訴求とMETA情報の合致度が低い可能性があります',
        owlOk: 'パッと見て「何屋さんか」がすぐわかります。3秒ルールに勝てていますね！',
        owlNg: 'パッと見て「何屋さんか」が伝わりにくい状態です。訪問者は3秒で読むか離れるかを決めてしまいます。',
        top3: '最初の3秒で「何のサイトか」が伝わっていません。',
        fix: 'ファーストビューの見出し・画像を「何屋か＋強み」が3秒で伝わる構成に再設計します。' }
    ],
    'III': [
      { n: '会社名明記', imp: '必須', w: 2, resp: 'client',
        desc: '特定商取引法に基づく表記や会社概要など、運営元の明記を確認',
        ok: '運営元の会社情報の明記を確認できました',
        ng: '運営元の会社情報を確認できませんでした',
        owlOk: 'ちゃんと名札をつけている状態ですね。「誰がやっているサイトか」が一目でわかります。合格です。',
        owlNg: '名札のないサイトになっています。「誰がやっているか」が見えないサイトは、それだけで問い合わせをためらわせます。',
        top3: '運営元が見えず、信頼の入口でつまずいています。',
        fix: '会社概要ページに社名・所在地・連絡先を明記。1ページの整備で即日対応できます。' },
      { n: 'プライバシーポリシー', imp: '必須', w: 2, resp: 'shared',
        desc: '個人情報保護方針ページの設置有無を確認',
        ok: 'プライバシーポリシーページの存在を確認できました',
        ng: 'プライバシーポリシーページを確認できませんでした',
        owlOk: '個人情報の扱いをきちんと約束できていますね。法的にも安心です。このまま維持しましょう。',
        owlNg: '個人情報の扱いが約束されていません。フォーム入力をためらわせるうえ、法令面でもリスクがあります。',
        top3: '個人情報の約束がなく、問い合わせをためらわせています。',
        fix: 'プライバシーポリシーページを設置し、フォームからリンク。数日で対応できます。' },
      { n: '最新情報の更新頻度', imp: '推奨', w: 1, resp: 'client',
        desc: 'お知らせやブログの最終更新日が直近であるかを確認',
        ok: 'お知らせ・ブログの直近の更新を確認できました',
        ng: '直近の更新情報を確認できませんでした',
        owlOk: '「動いている会社」であることが伝わっていますね。更新の習慣は信頼の積み立てです。',
        owlNg: 'お店の看板は出ているけど、電気が消えている状態です。「まだやってるの？」と思われてしまいます。月1回の更新だけでも印象はガラリと変わりますよ。',
        top3: '更新停止は「まだやってるの？」の不安を生みます。',
        fix: 'お知らせの月1回更新を運用ルール化。更新担当と型を決めれば数日で改善できます。' }
    ],
    'IV': [
      { n: 'グロナビ常設', imp: '必須', w: 2, resp: 'agency',
        desc: '全ページ共通のグローバルナビゲーションの設置を確認',
        ok: 'ヘッダーリンク・グローバルナビを検知できました',
        ng: '共通のグローバルナビを検知できませんでした',
        owlOk: '全ページに案内板が設置されていますね。百貨店でいう「フロアガイド」がちゃんとあります。合格です。',
        owlNg: 'サイト内に案内板がない状態です。訪問者は目的のページへたどり着けず、途中で帰ってしまいます。',
        top3: '案内板がなく、訪問者が目的地に着く前に離脱しています。',
        fix: '全ページ共通のグローバルナビを設置。主要5〜7項目に絞った設計が効果的です。' },
      { n: 'リンク視認性', imp: '推奨', w: 1, resp: 'agency',
        desc: 'テキストリンクが周囲の文字と区別可能かを確認',
        ok: 'リンクと本文の区別性を確認できました',
        ng: 'リンク色と背景色のコントラストがWCAG AA基準（4.5:1）に届いていない可能性があります',
        owlOk: 'リンクが「押せる場所」だと一目でわかりますね。迷わせない誘導ができています。',
        owlNg: 'リンク色と背景色のコントラスト比がWCAG AA基準（4.5:1）に届いていません。弱視・色覚特性のある方や明るい屋外画面では「文字が見えない」状態となり、せっかくのリンクがクリックされません。',
        top3: 'リンクが見えず、クリックの機会を逃しています。',
        fix: 'リンク色をWCAG AA基準（コントラスト比4.5:1以上）に修正。CSSの変更のみで即日対応可能です。' },
      { n: '文字が小さすぎない', imp: '推奨', w: 1, resp: 'agency',
        desc: '本文のフォントサイズが読みやすい大きさ（推奨16px以上）かを確認',
        ok: '本文フォントサイズが推奨基準を満たしていることを確認できました',
        ng: '本文フォントサイズが推奨基準を下回っている可能性があります',
        owlOk: '読みやすい文字サイズですね。スマホでもストレスなく情報を届けられています。',
        owlNg: '文字が小さく、スマホでは拡大しないと読めない状態です。読みにくさは、そのまま離脱につながります。',
        top3: '小さい文字がスマホ閲覧者の離脱を招いています。',
        fix: '本文フォントサイズを16px以上に統一。CSSの変更のみで即日対応可能です。' }
    ],
    'V': [
      { n: 'WPIDチェック', imp: '推奨', w: 1, resp: 'shared',
        desc: 'WordPressのユーザーIDや管理画面URLが露見していないか確認',
        ok: '管理画面ログインIDの露出を検出しませんでした',
        ng: '管理画面ログインID等が露出している可能性を検出しました',
        owlOk: '管理画面の場所と鍵穴を上手に隠せていますね。泥棒が下見しても手がかりを掴めません。合格です。',
        owlNg: '管理画面の鍵穴が外から見えている状態です。攻撃の足がかりになる前に、露出を塞ぎましょう。',
        top3: '管理情報の露出が攻撃の足がかりになりかねません。',
        fix: 'ユーザーID露出の停止・ログインURL変更などの基本対策を実施。数日で対応できます。' },
      { n: 'TLS証明書有効', imp: '必須', w: 2, resp: 'agency',
        desc: 'SSL/TLSサーバー証明書が有効で、HTTPS通信が行われているか確認',
        ok: '証明書が有効で、HTTPS通信を確認できました',
        ng: '有効なTLS証明書によるHTTPS通信を確認できませんでした',
        owlOk: '通信の暗号化がバッチリです。お客さんとの会話が盗み聞きされる心配はありません。',
        owlNg: '通信が暗号化されておらず、ブラウザに「保護されていない通信」と警告されます。それだけで訪問者は引き返します。',
        top3: '「保護されていない通信」警告が訪問者を追い返しています。',
        fix: 'TLS証明書を導入しHTTPS化。サーバー会社のオプションで数日で対応できます。' },
      { n: 'Mixed Contentなし', imp: '必須', w: 2, resp: 'shared',
        desc: 'HTTPSページ内にHTTP（非暗号化）リソースが混在していないか確認',
        ok: 'Mixed Contentは検出されませんでした',
        ng: 'HTTPS内にHTTP読み込み（Mixed Content）の可能性を検出しました',
        owlOk: 'すべての荷物が安全な経路で届いていますね。セキュリティに穴がありません。合格です。',
        owlNg: '安全な経路に、鍵のかかっていない荷物が混ざっています。警告表示や表示崩れの原因になります。',
        top3: '混在コンテンツが警告と表示崩れを招いています。',
        fix: '画像・スクリプトの読み込みURLをhttpsへ統一。置換作業のみで数日で対応できます。' }
    ],
    'VI': [
      { n: 'スマホ対応', imp: '必須', w: 2, resp: 'shared',
        desc: 'モバイルフレンドリーテスト相当の表示確認',
        ok: 'viewport設定・横スクロールなしを確認できました',
        ng: 'モバイル表示に問題がある可能性を検出しました',
        owlOk: 'スマホでもきれいに表示されていますね。お客さんの7割以上はスマホから来ます。しっかり対応できています。',
        owlNg: 'スマホで見づらい状態です。お客さんの7割以上はスマホから来ます。ここが崩れていると大半を逃します。',
        top3: '訪問者の7割が使うスマホで、見づらさが発生しています。',
        fix: 'レスポンシブ対応でスマホ表示を最適化。テンプレート改修から始めましょう。' },
      { n: 'Core Web Vitals合格', imp: '必須', w: 2, resp: 'agency',
        desc: 'LCP, CLS, INPなどのWeb Vitals指標が基準値内か確認',
        ok: 'Core Web Vitalsの合格基準を満たしていることを確認できました',
        ng: 'Core Web Vitalsの合格基準を満たしていない可能性を検出しました',
        owlOk: '表示がサクサクですね。待たせないサイトは、それだけでおもてなしになっています。',
        owlNg: 'レジで延々と待たされるお店と同じ状態です。ページが遅いだけで半数以上のお客さんが「もういいや」と帰ってしまいます。',
        top3: '不合格はCV低下とSEO検索順位低下の二重苦を招きます。',
        fix: '画像のWebP化・圧縮とLCP改善で表示速度を回復。離脱による取りこぼしを止めます。' },
      { n: '画像最適化', imp: '推奨', w: 1, resp: 'shared',
        desc: '画像のサイズ圧縮や次世代フォーマット（WebP等）の使用状況を確認',
        ok: '画像の圧縮・次世代フォーマット利用を確認できました',
        ng: '未圧縮・旧形式の画像が多い可能性を検出しました',
        owlOk: '画像がきちんとダイエットできていますね。速さと画質のバランスが取れています。',
        owlNg: '巨大な荷物を狭い通路で運んでいるようなものです。画像が重すぎてページの表示を遅くしています。ダイエットしましょう。',
        top3: '巨大な画像の乱用は表示速度を直撃し、ユーザーの怒りを加速させ離脱率を上昇させます。',
        fix: '画像をWebP等へ変換・圧縮。一括変換ツールで数日で対応できます。' }
    ],
    'VII': [
      { n: 'GA4タグ存在', imp: '必須', w: 2, resp: 'agency',
        desc: 'Google Analytics 4 (GA4) の計測タグ設置を確認',
        ok: 'GA4計測タグの設置を確認できました',
        ng: 'GA4計測タグを検出できませんでした',
        owlOk: 'サイトの体温計がきちんと動いていますね。データに基づく改善ができる状態です。',
        owlNg: '体温計のない病院と同じ状態です。サイトの健康状態がまったくわからず、「何を直せばいいか」の手がかりがゼロです。まずここから。',
        top3: 'GA4未設置は「計器のない飛行機」と同じです。改善の起点となるデータがなければPDCAは永遠に回りません。',
        fix: 'GA4を設置し「診断→出稿→流入・問い合わせ」を計測できる状態に。以後の全施策の判断基盤になります。' },
      { n: 'GTM存在', imp: '推奨', w: 1, resp: 'agency',
        desc: 'Google Tag Manager (GTM) の導入有無を確認',
        ok: 'Tag Managerの導入を確認できました',
        ng: 'Tag Managerを検出できませんでした',
        owlOk: 'タグの管理ツールが入っていますね。マーケティング施策をスピーディーに展開できる体制です。',
        owlNg: 'タグを直書きで管理している状態です。GTMを入れると、計測や広告タグの追加が安全・迅速になります。',
        top3: 'タグ管理が整わず、施策のスピードが落ちています。',
        fix: 'GTMを導入しタグを一元管理。GA4と合わせての導入が効率的です。' },
      { n: '致命的な計測阻害なし', imp: '必須', w: 2, resp: 'agency',
        desc: 'CSP設定やJSエラーによる計測タグのブロックがないか確認',
        ok: '重大なConsoleエラーは検知されませんでした',
        ng: '計測を阻害しうる重大なエラーの可能性を検知しました',
        owlOk: '計測の邪魔をするものがありませんね。データが正しく届いています。安心です。',
        owlNg: '計測タグの動作を妨げるエラーの疑いがあります。数字が欠けたまま判断すると、改善の方向を誤ります。',
        top3: '計測エラーがデータの欠落を招いています。',
        fix: 'Consoleエラーの原因スクリプトを特定・修正。計測の土台を先に固めます。' }
    ]
  };

  /* ×の埋め方（P11）: カテゴリ→マス媒体で塞ぐ打ち手（承認サンプル準拠＋RXと整合） */
  var PP_GAP = {
    'I':   { text: '検索やWeb広告に頼らず商圏へ直接届く媒体で「検索しない層」からの認知を確保。サイト改善と並行して、反響の母数をつくります。',
      tags: '#商圏配布 #検索しない層', media: '折込チラシ∕地域TV∕ラジオ' },
    'II':  { text: '紙面の一覧性を活かし、強み・事例を1枚で「伝わる形」に編集して商圏へ届けます（制作はグループ会社TACと一気通貫）。',
      tags: '#伝わる訴求 #紙の一覧性', media: '新聞広告∕雑誌・専門誌' },
    'III': { text: '更新が止まっていた期間の「認知の空白」は、商圏への折込・地域メディアで再アプローチ。「まだやってるの？」を「よく見るね」に変えます。',
      tags: '#商圏配布 #エリア認知', media: '折込チラシ∕交通・OOH' },
    'IV':  { text: 'サイト改善と同時に、紙面・音声など「見え方に左右されない媒体」を併用し、シニア層への到達を確保します。',
      tags: '#シニア層 #ABC公査部数', media: '新聞広告∕ラジオ' },
    'V':   { text: '防御の改善が完了するまでの集客は、サイトの状態に左右されない紙媒体で継続。安心して直せる時間をつくります。',
      tags: '#並走集客 #商圏配布', media: '折込チラシ∕ラジオ' },
    'VI':  { text: '受け皿の改善が完了するまでの集客は、電話・来店を直接促せる折込・ラジオで補完。改善後にWeb広告を再開する段取りが無駄がありません。',
      tags: '#反応率改善 #ながら聴取', media: '折込チラシ∕ラジオ' },
    'VII': { text: '計測が整えば、マス出稿の効果（放送・配布期間中の指名検索や問い合わせの変化）も数字で確認可能に。「効いたか分からない広告」から卒業します。',
      tags: '#成果の実数 #実数提案', media: '効果測定つきマス出稿（全媒体）' }
  };

  var PP_GRADE_WORD = { A: '優秀', B: '良好', C: '要改善', D: '要対策' };
  var PP_JUDGE_WORD = { pass: '合格', warn: '要改善', fail: '不合格' };
  var PP_OWL_TOTAL = {
    A: '総合評価はA。守りは万全です。次は"攻めの認知"で商圏シェアを取りにいきましょう。',
    B: '総合評価はB。改善ポイントは明確です。一つずつ直していきましょう。',
    C: '総合評価はC。取りこぼしが複数見つかりました。優先度の高い×から着手しましょう。',
    D: '総合評価はD。複数の経路でお客様を逃している可能性があります。まず対処の順番を整理しましょう。'
  };

  function ppScore(row) {
    var defs = PP_ITEMS[row.roman] || [];
    var tw = 0, ts = 0;
    row.items.forEach(function (it, i) {
      var w = (defs[i] && defs[i].w) || 1;
      tw += w; if (it.pass) ts += w;
    });
    return tw ? Math.round(ts / tw * 100) : 0;
  }
  function ppGrade(score) { return score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'; }
  function ppDevi(score, mu) { return Math.round((50 + 10 * (score - mu) / PP_SIGMA) * 10) / 10; }
  function ppTopPct(t) {  // 偏差値→上位%（正規分布のロジスティック近似）
    var p = 1 / (1 + Math.exp(-1.702 * (t - 50) / 10));
    return Math.max(0.1, Math.min(99.9, Math.round((100 - p * 100) * 10) / 10));
  }
  function ppRank(t, n) { return Math.max(1, Math.round(n * ppTopPct(t) / 100)); }
  function ppNum(n) { return Number(n).toLocaleString('ja-JP'); }

  /* 成績表DOMから素材回収＋表示層スコアリング（エンジン非干渉・純関数）
     ページ内成績表（buildScoreboard）と印刷レポート（buildPrintReport）で共用 */
  function ppCompute(container) {
    var metaEl = container.querySelector('.-w-report-meta');
    var metaText = metaEl ? metaEl.textContent : '';
    var urlMatch = metaText.match(/診断URL：(.+?)診断日時：/);
    var dateMatch = metaText.match(/診断日時：([0-9\/]+ [0-9:]+)/);
    var diagUrl = urlMatch ? urlMatch[1].trim() : '';
    var diagDate = dateMatch ? dateMatch[1].trim().split(' ')[0] : '';
    var host = diagUrl;
    try { host = new URL(diagUrl).hostname; } catch (e) { /* 続行 */ }

    var rows = [];
    container.querySelectorAll('.-w-report-row').forEach(function (row) {
      var roman = row.querySelector('.-w-report-row-roman');
      var name = row.querySelector('.-w-report-row-name');
      var judge = row.querySelector('.-w-report-row-judge');
      var items = [];
      row.querySelectorAll('.-w-report-item').forEach(function (item) {
        items.push({ pass: item.classList.contains('-w-item-pass') });
      });
      if (roman && judge) {
        rows.push({
          roman: roman.textContent.trim(),
          name: name ? name.textContent.trim() : '',
          judgeCls: judge.classList.contains('-w-judge-fail') ? 'fail' : (judge.classList.contains('-w-judge-warn') ? 'warn' : 'pass'),
          items: items
        });
      }
    });

    rows.forEach(function (row) {
      var cat = PP_CATS[row.roman] || {};
      row.cat = cat;
      row.score = ppScore(row);
      row.grade = ppGrade(row.score);
      row.devi = ppDevi(row.score, cat.avg || PP_MU_TOTAL);
      row.rank = ppRank(row.devi, PP_POP_ALL);
      row.passCount = row.items.filter(function (it) { return it.pass; }).length;
    });
    var passTotal = rows.reduce(function (s, r) { return s + r.passCount; }, 0);
    var allW = 0, gotW = 0;
    rows.forEach(function (row) {
      (PP_ITEMS[row.roman] || []).forEach(function (d, i) {
        allW += d.w; if (row.items[i] && row.items[i].pass) gotW += d.w;
      });
    });
    var totScore = allW ? Math.round(gotW / allW * 100) : 0;

    /* 不合格項目（承認サンプル準拠＝掲載順） */
    var failItems = [];
    rows.forEach(function (row) {
      row.items.forEach(function (it, i) {
        if (!it.pass) failItems.push({ row: row, def: PP_ITEMS[row.roman][i] });
      });
    });

    var totDevi = ppDevi(totScore, PP_MU_TOTAL);
    var indDevi = ppDevi(totScore, PP_MU_IND);
    return {
      diagUrl: diagUrl, diagDate: diagDate, host: host,
      rows: rows, passTotal: passTotal, failItems: failItems,
      totScore: totScore, totGrade: ppGrade(totScore),
      totDevi: totDevi, indDevi: indDevi,
      rankAll: ppRank(totDevi, PP_POP_ALL), rankInd: ppRank(indDevi, PP_POP_IND),
      industry: state.surveyIndustry || null
    };
  }

  function buildPrintReport(container, results) {
    var root = $('tosen-print');
    if (!root) return;

    var __d = ppCompute(container);
    var diagUrl = __d.diagUrl, diagDate = __d.diagDate, host = __d.host,
      rows = __d.rows, passTotal = __d.passTotal, failItems = __d.failItems,
      totScore = __d.totScore, totGrade = __d.totGrade,
      totDevi = __d.totDevi, indDevi = __d.indDevi,
      rankAll = __d.rankAll, rankInd = __d.rankInd,
      industry = __d.industry || '建設業';

    /* --- 共通部品 --- */
    var pageNo = 0;
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function head(kicker, sub) {
      pageNo++;
      return '<div class="-w-pp-head">' +
        '<img class="-w-pp-logo" src="assets/logo-tosen.jpg" alt="株式会社東宣（TOSEN）">' +
        '<div class="-w-pp-head-mid">' +
          '<span class="-w-pp-kicker">' + kicker + '</span>' +
          '<span class="-w-pp-kicker-sub">' + sub + '</span>' +
        '</div>' +
        '<div class="-w-pp-head-meta">診断対象　' + diagUrl + '<br>診断日　' + diagDate + '</div>' +
        '<span class="-w-pp-num">' + pad2(pageNo) + '</span>' +
      '</div>';
    }
    function foot() {
      return '<div class="-w-pp-foot">' +
        '<span>PROVIDED BY ｜ 診断エンジン提供：株式会社ガーディアン（OWLet）　七つの取りこぼし診断 Webサイト品質診断</span>' +
        '<span>Page ' + pad2(pageNo) + ' / ' + PP_PAGES + '</span>' +
      '</div>';
    }
    function sec(no, jp, en) {
      return '<h2 class="-w-pp-sec">§ ' + pad2(no) + '　' + jp + ' <span>' + en + '</span></h2>';
    }
    function gradeBadge(tag, letter, word, small) {
      return '<div class="-w-ppg -w-ppg-' + letter.toLowerCase() + (small ? ' -w-ppg-sm' : '') + '">' +
        '<span class="-w-ppg-tag">' + tag + '</span>' +
        '<span class="-w-ppg-letter">' + letter + '</span>' +
        '<span class="-w-ppg-word">' + word + '</span>' +
      '</div>';
    }
    function owlBox(text, sig) {
      return '<div class="-w-pp-owl"><span class="-w-pp-owl-tag">OWLet</span>' + text +
        (sig ? '<span class="-w-pp-owl-sig">―― OWLet先生の一言</span>' : '') + '</div>';
    }

    /* --- レーダー（あなた vs 平均・表示層で生成） --- */
    function printRadar() {
      var cx = 128, cy = 100, R = 62, N = rows.length || 7;
      function pt(i, ratio) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / N;
        return (cx + R * ratio * Math.cos(a)).toFixed(1) + ',' + (cy + R * ratio * Math.sin(a)).toFixed(1);
      }
      var svg = '<svg viewBox="0 0 256 200" role="img" aria-label="7科目レーダーチャート">';
      [1 / 3, 2 / 3, 1].forEach(function (g) {
        var ps = []; for (var i = 0; i < N; i++) ps.push(pt(i, g));
        svg += '<polygon points="' + ps.join(' ') + '" fill="none" stroke="#e3e6ea"/>';
      });
      for (var i = 0; i < N; i++) svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(i, 1).split(',')[0] + '" y2="' + pt(i, 1).split(',')[1] + '" stroke="#e3e6ea"/>';
      var avgPs = [], youPs = [];
      rows.forEach(function (row, i) {
        avgPs.push(pt(i, (row.cat.avg || 0) / 100));
        youPs.push(pt(i, row.score / 100));
      });
      svg += '<polygon points="' + avgPs.join(' ') + '" fill="rgba(91,102,114,0.15)" stroke="#5b6672" stroke-width="1.2"/>';
      svg += '<polygon points="' + youPs.join(' ') + '" fill="rgba(200,22,29,0.18)" stroke="#c8161d" stroke-width="1.8"/>';
      rows.forEach(function (row, i) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / N;
        var lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 14) * Math.sin(a);
        var anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="' + anchor + '" font-size="9" font-weight="700" fill="#1f2933">' + row.cat.name + '</text>';
      });
      svg += '</svg>';
      return '<div class="-w-pp-radar">' + svg +
        '<div class="-w-pp-radar-legend"><span><i style="background:#c8161d"></i>あなた</span><span><i style="background:#5b6672"></i>平均</span></div></div>';
    }

    /* ---- Page 1: 表紙 ---- */
    var p1 = '<section class="-w-pp -w-pp-cover">' + head(PP_EN, '七つの取りこぼし診断 ∕ Webサイト品質診断レポート') +
      '<div class="-w-pp-cover-main">' +
        '<img class="-w-pp-cover-logo" src="assets/logo-tosen.jpg" alt="株式会社東宣（TOSEN）">' +
        '<p class="-w-pp-cover-en">' + PP_EN + '</p>' +
        '<h1 class="-w-pp-cover-title">七つの取りこぼし診断</h1>' +
        '<p class="-w-pp-cover-sub">Webサイト品質診断レポート</p>' +
        '<table class="-w-pp-cover-meta"><tbody>' +
          '<tr><th>診断サイト</th><td>' + host + '</td></tr>' +
          '<tr><th>診断URL</th><td>' + diagUrl + '</td></tr>' +
          '<tr><th>診断日</th><td>' + diagDate + '</td></tr>' +
        '</tbody></table>' +
        '<p class="-w-pp-provided">PROVIDED BY<br>診断エンジン提供：株式会社ガーディアン（OWLet）</p>' +
      '</div>' + foot() + '</section>';

    /* ---- Page 2: 成績表 ---- */
    var tableRows = rows.map(function (r) {
      return '<tr>' +
        '<td>' + r.cat.no + '</td>' +
        '<td class="-w-l">' + r.cat.name + ' <span class="-w-sin">∕' + r.cat.sin + '</span></td>' +
        '<td>' + r.score + '</td>' +
        '<td>' + r.cat.avg + '</td>' +
        '<td>' + r.devi + '</td>' +
        '<td class="-w-pp-gl -w-gl-' + r.grade.toLowerCase() + '">' + r.grade + '</td>' +
        '<td>' + ppNum(r.rank) + '</td>' +
      '</tr>';
    }).join('') +
      '<tr class="-w-pp-tr-total"><td></td><td class="-w-l">総合</td><td>' + totScore + '</td><td>' + PP_MU_IND + '</td><td>' + totDevi + '</td>' +
      '<td class="-w-pp-gl -w-gl-' + totGrade.toLowerCase() + '">' + totGrade + '</td><td>' + ppNum(rankAll) + '</td></tr>';

    function distBox(ttl, rank, pop, topPct, devi) {
      var left = Math.max(3, Math.min(97, 100 - topPct));
      return '<div class="-w-pp-dist-box">' +
        '<p class="-w-pp-dist-ttl">' + ttl + '</p>' +
        '<div class="-w-pp-dist-bar"><span class="-w-pp-dist-marker" style="left:' + left + '%">あなた ↓</span></div>' +
        '<div class="-w-pp-dist-scale"><span>~30</span><span>78~</span></div>' +
        '<p class="-w-pp-dist-cap"><strong>' + ppNum(rank) + '</strong> / ' + ppNum(pop) + '位　上位 約' + topPct + '%（偏差値' + devi + '）</p>' +
      '</div>';
    }

    var benchRows = rows.map(function (r) {
      var top10 = Math.min(100, Math.round((r.cat.avg || 0) + 20));
      return '<div class="-w-pp-bench-row">' +
        '<span class="-w-pp-bench-label">' + r.cat.name + '<span class="-w-sin">∕' + r.cat.sin + '</span></span>' +
        '<span class="-w-pp-bench-track">' +
          '<span class="-w-pp-bench-you" style="width:' + r.score + '%"></span>' +
          '<span class="-w-pp-bench-avg" style="left:' + r.cat.avg + '%"></span>' +
          '<span class="-w-pp-bench-top" style="left:' + top10 + '%"></span>' +
        '</span>' +
        '<span class="-w-pp-bench-val">' + r.score + ' / 100</span>' +
      '</div>';
    }).join('');

    var top3 = failItems.slice(0, 3).map(function (f, i) {
      return '<div class="-w-pp-action">' +
        '<span class="-w-pp-action-num">' + (i + 1) + '</span>' +
        '<div><span class="-w-pp-action-cat">' + f.row.cat.name + '∕' + f.row.cat.sin + '</span>' +
        '<p class="-w-pp-action-ttl">' + f.def.n + '</p>' +
        '<p class="-w-pp-action-text">' + f.def.top3 + '</p></div>' +
      '</div>';
    }).join('') || '<p class="-w-pp-allok">不合格（×）の項目はありませんでした。守りは合格です。</p>';

    var p2 = '<section class="-w-pp">' + head('成績表', '七つの取りこぼし診断 ∕ Webサイト品質診断 ∕ 全7科目 総合評価') +
      sec(1, '総合評価', 'TOTAL SCORE') +
      '<div class="-w-pp-total">' +
        gradeBadge('TOTAL', totGrade, PP_GRADE_WORD[totGrade]) +
        '<div class="-w-pp-total-body">' +
          '<p class="-w-pp-total-headline">あなたのサイトの業界内順位は <strong>' + ppNum(rankInd) + '位</strong> です</p>' +
          '<div class="-w-pp-total-stats">' +
            '<span>偏差値 <strong>' + indDevi + '</strong></span>' +
            '<span>総合得点 <strong>' + totScore + '</strong>/100</span>' +
            '<span>合格項目 <strong>' + passTotal + '</strong>/21</span>' +
            '<span>総合順位 <strong>' + ppNum(rankInd) + '位</strong> / ' + ppNum(PP_POP_IND) + '（' + industry + '）</span>' +
          '</div>' +
        '</div>' +
        owlBox(PP_OWL_TOTAL[totGrade], true) +
      '</div>' +
      sec(2, '科目別バランス ＆ 成績一覧', 'CATEGORY BREAKDOWN') +
      '<div class="-w-pp-balance">' + printRadar() +
        '<table class="-w-pp-table"><thead><tr><th></th><th>科目（七つの取りこぼし）</th><th>得点</th><th>平均</th><th>偏差値</th><th>評価</th><th>順位</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody></table>' +
      '</div>' +
      sec(3, '全体分布マップ ― あなたはここ', 'DISTRIBUTION MAP') +
      '<div class="-w-pp-dist">' +
        distBox('全体分布（' + ppNum(PP_POP_ALL) + 'サイト）', rankAll, PP_POP_ALL, ppTopPct(totDevi), totDevi) +
        distBox('業界内分布（' + industry + '）', rankInd, PP_POP_IND, ppTopPct(indDevi), indDevi) +
      '</div>' +
      sec(4, 'あなた vs 業界平均 vs トップ10%', 'BENCHMARK') +
      '<p class="-w-pp-bench-legend">■あなた　｜業界平均　｜トップ10%</p>' + benchRows +
      sec(5, '最優先で直したい3項目', 'TOP 3 ACTIONS') + top3 +
      '<p class="-w-pp-refnote">※平均点・分布・順位はOWLet診断データベースの蓄積値に基づく参考値です。</p>' +
      foot() + '</section>';

    /* ---- Page 3-9: カテゴリ詳細 ×7 ---- */
    var catPages = rows.map(function (row) {
      var defs = PP_ITEMS[row.roman] || [];
      var okNames = [], ngNames = [];
      row.items.forEach(function (it, i) { (it.pass ? okNames : ngNames).push(defs[i] ? defs[i].n : ''); });
      var briefState = ngNames.length === 0
        ? '3つとも合格！この調子で維持していきましょう。'
        : (okNames.length ? okNames.join('・') + 'は合格。' : '') + 'ただし「' + ngNames.join('」「') + '」に課題があります。まずはここから直しましょう。';

      var itemsHtml = row.items.map(function (it, i) {
        var d = defs[i];
        if (!d) return '';
        return '<div class="-w-pp-item ' + (it.pass ? '-w-pp-item-ok' : '-w-pp-item-ng') + '">' +
          '<span class="-w-pp-item-badge">' + (it.pass ? 'OK' : 'NG') + '</span>' +
          '<div class="-w-pp-item-body">' +
            '<p class="-w-pp-item-name">' + d.n + '</p>' +
            '<p class="-w-pp-item-desc">' + d.desc + '</p>' +
            '<p class="-w-pp-item-detail">▶ ' + (it.pass ? d.ok : d.ng) + '</p>' +
            '<p class="-w-pp-item-owl"><b>OWLet</b>' + (it.pass ? d.owlOk : d.owlNg) + '</p>' +
          '</div>' +
          '<div class="-w-pp-item-side">' +
            '<p class="-w-pp-item-kv"><span>重要度</span><b>' + d.imp + '</b></p>' +
            '<p class="-w-pp-item-kv"><span>結果</span><b>' + (it.pass ? '合格' : '不合格') + '</b></p>' +
            '<p class="-w-pp-item-kv"><span>改修</span><b>' + (it.pass ? '不要' : '要対応') + '</b></p>' +
          '</div>' +
        '</div>';
      }).join('');

      var nextLead = ngNames.length === 0
        ? 'この章は全項目クリア！素晴らしい成績です。'
        : 'この章で直すべきは' + ngNames.length + '項目。数日で対応できます。';
      var nextCta = ngNames.length === 0
        ? 'この状態を維持する運用を相談する →'
        : 'この×の直し方を無料で相談する →';

      return '<section class="-w-pp">' +
        head('カテゴリ詳細 ∕ 第' + row.cat.no + 'の取りこぼし', '七つの取りこぼし診断 ∕ Webサイト品質診断 ∕ ' + row.cat.name + 'の章') +
        '<div class="-w-pp-cat-top">' +
          '<div class="-w-pp-cat-id">' +
            '<span class="-w-pp-cat-roman">' + row.roman + '</span>' +
            '<span class="-w-pp-cat-name">' + row.cat.name + '</span>' +
            '<span class="-w-pp-cat-latin">' + row.cat.latin + ' / ' + row.cat.sin + '</span>' +
            '<span class="-w-pp-cat-sub">― ' + row.cat.sub + '</span>' +
          '</div>' +
          '<div class="-w-pp-cat-side">' +
            '<div><p class="-w-pp-judge-word -w-gl-' + row.grade.toLowerCase() + '">' + PP_JUDGE_WORD[row.judgeCls] + '</p>' +
            gradeBadge('GRADE', row.grade, PP_GRADE_WORD[row.grade], true) + '</div>' +
            '<div class="-w-pp-meter">' +
              '<p class="-w-pp-meter-ttl">得点メーター</p>' +
              '<div class="-w-pp-meter-bar"><span class="-w-pp-meter-fill" style="width:' + row.score + '%"></span>' +
              '<span class="-w-pp-meter-avg" style="left:' + row.cat.avg + '%"></span></div>' +
              '<p class="-w-pp-meter-num">' + row.score + ' / 100</p>' +
              '<p class="-w-pp-meter-sub">平均 ' + row.cat.avg + '点∕偏差値 ' + row.devi + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="-w-pp-brief"><span class="-w-pp-brief-tag">OWLet&#39;s BRIEF</span>' + row.cat.brief + '<br>' + briefState + '</div>' +
        sec(1, 'チェック項目の詳細', 'ITEM BREAKDOWN　合格 ' + row.passCount + ' ∕ ' + row.items.length + '項目') +
        itemsHtml +
        '<div class="-w-pp-nextact">' +
          '<p class="-w-pp-nextact-lead">NEXT ACTION ∕ 次の一手<br>' + nextLead + '</p>' +
          '<p class="-w-pp-nextact-cta">' + nextCta + '<span class="-w-pp-nextact-sub">無料相談はこちら　tosen-net.co.jp/contact/</span></p>' +
        '</div>' +
        foot() + '</section>';
    }).join('');

    /* ---- Page 10: 特別章 制作会社 納品品質レポート ---- */
    var agencyDefs = [], sharedFails = [], clientFails = [], agencyFails = [];
    var agW = 0, agGot = 0, agPass = 0, agencyRows = [];
    rows.forEach(function (row) {
      (PP_ITEMS[row.roman] || []).forEach(function (d, i) {
        var pass = !!(row.items[i] && row.items[i].pass);
        if (d.resp === 'agency') {
          agW += d.w; if (pass) { agGot += d.w; agPass++; }
          agencyRows.push({ d: d, cat: row.cat, pass: pass });
          if (!pass) agencyFails.push(d.n);
        } else if (!pass) {
          (d.resp === 'client' ? clientFails : sharedFails).push(d.n);
        }
      });
    });
    var agScore = agW ? Math.round(agGot / agW * 100) : 0;
    var agGrade = ppGrade(agScore);
    var agDevi = ppDevi(agScore, PP_MU_TOTAL);
    var agPct = Math.round(agPass / 11 * 1000) / 10;
    var totPct = Math.round(passTotal / 21 * 1000) / 10;
    var diffPt = Math.round((totPct - agPct) * 10) / 10;
    var failCount = 21 - passTotal;
    var nonAgencyShare = failCount ? Math.round((sharedFails.length + clientFails.length) / failCount * 100) : 0;
    function bandWord(t) { return t >= 60 ? '上位圏' : t >= 55 ? 'やや上位' : t >= 45 ? '平均圏' : t >= 40 ? 'やや下位' : '下位圏'; }
    var dualNote;
    if (failCount === 0) {
      dualNote = '◆ 制作会社スコア・サイト総合ともに全項目合格です。納品品質・運用のどちらにも大きな課題は見つかりませんでした。';
    } else if (diffPt > 0) {
      dualNote = '◆ 制作会社スコア（' + agGrade + ' / ' + agPct + '%）はサイト総合（' + ppGrade(totScore) + ' / ' + totPct + '%）より ' + Math.abs(diffPt) + 'ポイント低い。つまりサイトの課題のうち約' + (100 - nonAgencyShare) + '%は制作会社の納品範囲にあり、残る約' + nonAgencyShare + '%は運営者側の責任範囲です。';
    } else if (diffPt < 0) {
      dualNote = '◆ 制作会社スコア（' + agGrade + ' / ' + agPct + '%）はサイト総合（' + ppGrade(totScore) + ' / ' + totPct + '%）より ' + Math.abs(diffPt) + 'ポイント高い。つまりサイトの課題のうち約' + nonAgencyShare + '%は運営者側（御社）の責任範囲であり、制作会社だけでは解消できない部分が含まれています。';
    } else {
      dualNote = '◆ 制作会社スコアとサイト総合は同水準（' + agPct + '%）です。納品範囲と運用範囲の双方に、同程度の改善余地があります。';
    }

    var evidence = agencyRows.map(function (a, i) {
      return '<div class="-w-pp-evd-row">' +
        '<span class="-w-pp-evd-num">' + (i + 1) + '</span>' +
        '<span class="-w-pp-evd-name">' + a.d.n + '</span>' +
        '<span class="-w-pp-evd-cat">' + a.cat.name + '</span>' +
        '<span class="-w-pp-evd-st ' + (a.pass ? '-w-pp-evd-ok' : '-w-pp-evd-ng') + '">' + (a.pass ? 'OK' : 'NG') + '</span>' +
        '<span class="-w-pp-evd-txt">' + (a.pass ? a.d.ok : a.d.ng) + '</span>' +
      '</div>';
    }).join('');

    function abcCard(label, ttl, names, text) {
      return '<div class="-w-pp-abc-card"><p class="-w-pp-abc-ttl">' + label + '｜' + ttl + (names.length ? names.length + '項目' : '') + '</p>' +
        '<p class="-w-pp-abc-items">' + (names.length ? names.join('・') : '該当なし（全項目クリア）') + '</p>' +
        (names.length ? '<p class="-w-pp-abc-text">' + text + '</p>' : '') + '</div>';
    }

    var p10 = '<section class="-w-pp">' + head('特別章 ∕ 制作会社 納品品質レポート', '七つの取りこぼし診断 ∕ 責任分析に基づく 客観的評価') +
      '<p class="-w-pp-lead"><strong>SPECIAL CHAPTER</strong>　制作会社の納品品質を、根拠データで可視化する章　<span class="-w-sin">客観性への配慮：運営者側の責任範囲はスコアから除外しています</span></p>' +
      sec(1, '二重評価 ― サイト総合 vs 制作会社納品', 'DUAL GRADING') +
      '<div class="-w-pp-dual">' +
        '<div class="-w-pp-dual-card">' + gradeBadge('DELIVERY', agGrade, PP_GRADE_WORD[agGrade], true) +
          '<div><p class="-w-pp-dual-ttl">制作会社 納品品質スコア</p>' +
          '<p class="-w-pp-dual-stats">合格率 <strong>' + agPct + '%</strong>　合格数 ' + agPass + ' / 11項目<br>偏差値 ' + agDevi + '　業界内 ' + bandWord(agDevi) + '</p></div></div>' +
        '<div class="-w-pp-dual-card">' + gradeBadge('TOTAL', totGrade, PP_GRADE_WORD[totGrade], true) +
          '<div><p class="-w-pp-dual-ttl">サイト総合評価（全21項目）</p>' +
          '<p class="-w-pp-dual-stats">合格率 <strong>' + totPct + '%</strong>　合格数 ' + passTotal + ' / 21項目<br>偏差値 ' + totDevi + '　業界内 ' + bandWord(indDevi) + '</p></div></div>' +
      '</div>' +
      '<p class="-w-pp-dual-note">' + dualNote + '</p>' +
      sec(2, '21項目の責任分担マップ', 'RESPONSIBILITY MAP') +
      '<div class="-w-pp-resp-bar"><i style="width:52%;background:#c8161d"></i><i style="width:33%;background:#b45309"></i><i style="width:15%;background:#5b6672"></i></div>' +
      '<div class="-w-pp-resp">' +
        '<div class="-w-pp-resp-col"><b>AGENCY　制作会社 11項目 / 52%</b>納品物として当然含まれるべき技術実装・デザイン基礎。スコアの算出対象。</div>' +
        '<div class="-w-pp-resp-col"><b>SHARED　共同責任 7項目 / 33%</b>テンプレ提供は制作会社、内容承認は運営者。契約次第で責任が分かれる領域。</div>' +
        '<div class="-w-pp-resp-col"><b>CLIENT　運営者 3項目 / 15%</b>日々のコンテンツ更新・運用など。スコアから除外。</div>' +
      '</div>' +
      sec(3, '制作会社責任 11項目 ― 合否の根拠', 'EVIDENCE　合格 ' + agPass + ' ∕ 不合格 ' + (11 - agPass)) +
      evidence +
      sec(4, '推奨アクション ― 対話の始め方', 'NEXT STEPS') +
      '<div class="-w-pp-abc">' +
        abcCard('ACTION A', '制作会社に相談すべき', agencyFails, '「この項目は標準実装に含まれていましたか？含まれていれば再対応を、含まれていなければ追加見積もりをお願いします」') +
        abcCard('ACTION B', '御社が主導すべき', clientFails, '社内の担当者を決めて、運用ルールから始めましょう。') +
        abcCard('ACTION C', '契約を確認すべき', sharedFails, '「納品時の仕様書に、この項目の記載はありましたか？」と当時の資料をご確認ください。') +
      '</div>' +
      '<p class="-w-pp-legal">本章の性質について ― 本章は特定の制作会社・事業者への評価・格付け・推奨・非推奨を行うものではありません。診断結果（客観的データ）に基づき、「制作会社が納品物として標準的に対応する項目」の合否を機械的に計測したものです。個別の契約内容・納品範囲・運用体制によって責任範囲は変動しますので、実際のアクションを取る前に必ず原契約書・見積書・仕様書をご確認ください。</p>' +
      foot() + '</section>';

    /* ---- Page 11: ×の埋め方（東宣提案） ---- */
    var gapCats = rows.filter(function (row) {
      return row.items.some(function (it) { return !it.pass; });
    });
    var gapLead, gapBody;
    if (gapCats.length) {
      gapLead = '今回の診断で見つかった×（取りこぼし）は' + gapCats.length + 'テーマ。Webの改善だけで終わらせず、「Webでは届かない層を、どの媒体で塞ぐか」までセットでご提案するのが、東宣の診断です。以下は貴社の×に対応した打ち手の一覧です。';
      gapBody = gapCats.map(function (row, gi) {
        var defs = PP_ITEMS[row.roman] || [];
        var ngDefs = [];
        row.items.forEach(function (it, i) { if (!it.pass && defs[i]) ngDefs.push(defs[i]); });
        var gap = PP_GAP[row.roman] || {};
        return '<div class="-w-pp-gap">' +
          '<p class="-w-pp-gap-ttl">×' + (gi + 1) + '｜' + ngDefs.map(function (d) { return d.n; }).join('・') + '（' + row.cat.name + '）</p>' +
          '<div class="-w-pp-gap-cols">' +
            '<div class="-w-pp-gap-col"><p class="-w-pp-gap-col-ttl">◤ Webで直す打ち手</p>' +
              ngDefs.map(function (d) { return '<p>' + d.fix + '</p>'; }).join('') + '</div>' +
            '<div class="-w-pp-gap-col"><p class="-w-pp-gap-col-ttl -w-pp-gap-col-red">◤ マス媒体で塞ぐ打ち手（東宣）</p>' +
              '<p>' + gap.text + '</p>' +
              '<p class="-w-pp-gap-tags">' + gap.tags + '</p>' +
              '<p class="-w-pp-gap-media">▶ ' + gap.media + '</p>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      gapLead = '今回の診断で×（取りこぼし）は見つかりませんでした。守りは合格です。次は、王道メディアで商圏の認知シェアを取りにいく「攻めの認知」の段階です。';
      gapBody = '<div class="-w-pp-gap">' +
        '<p class="-w-pp-gap-ttl">攻めの認知｜商圏シェアを取りにいく</p>' +
        '<div class="-w-pp-gap-cols">' +
          '<div class="-w-pp-gap-col"><p class="-w-pp-gap-col-ttl">◤ Webの現状維持</p><p>受け皿は整っています。定期的な再診断で品質を維持しましょう。</p></div>' +
          '<div class="-w-pp-gap-col"><p class="-w-pp-gap-col-ttl -w-pp-gap-col-red">◤ マス媒体で攻める（東宣）</p>' +
            '<p>新聞折込・地域TV・ラジオ・交通広告で「検索される前」の認知をつくり、商圏の第一想起を取りにいきます。</p>' +
            '<p class="-w-pp-gap-tags">#商圏認知 #第一想起</p>' +
            '<p class="-w-pp-gap-media">▶ 全媒体（媒体プランは無料相談で）</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    var p11 = '<section class="-w-pp">' + head('×の埋め方 ── Webで直す∕マス媒体で塞ぐ', '七つの取りこぼし診断 ∕ 東宣からの改善提案') +
      '<p class="-w-pp-lead">' + gapLead + '</p>' +
      gapBody +
      '<div class="-w-pp-nextact">' +
        '<p class="-w-pp-nextact-lead">NEXT ACTION ∕ 次の一手<br>この表の実行プランとお見積りを、無料でご提案します。<br><span class="-w-sin">あなたの業種で効いた実数（媒体×費用×成果）を根拠にご説明します。</span></p>' +
        '<div class="-w-pp-qr"><span>Scan to apply</span><span>QRは本番出力時に発行</span></div>' +
        '<p class="-w-pp-nextact-cta">結果を持って無料相談する →<span class="-w-pp-nextact-sub">tosen-net.co.jp/contact/</span></p>' +
      '</div>' +
      foot() + '</section>';

    /* ---- Page 12: 付録・解決策のご案内 ---- */
    var p12 = '<section class="-w-pp">' + head('付録・解決策のご案内', '七つの取りこぼし診断 ∕ 判定基準と次の一手') +
      '<div class="-w-pp-apx">' +
        '<div class="-w-pp-apx-col">' +
          '<h3 class="-w-pp-apx-h">診断レポートについて</h3>' +
          '<p><b>■ 七つの取りこぼし診断とは</b><br>WEBサイト運用において「知らず知らずのうちに犯しがちな7つの欠落＝取りこぼし」を診断する簡易診断サービスです。検出された×の改善方法や、Webでは届かない層への打ち手（折込・テレビ・ラジオ・新聞・交通等）について、診断結果をもとに無料でご相談いただけます。お見積りも無料です。</p>' +
          '<p><b>■ 判定基準</b><br>合格：基準クリア　要改善：推奨項目を満たさず　不合格：最低基準を満たさず</p>' +
          '<p><b>■ 重要度</b><br>必須：ひとつ×があれば不合格　推奨：ふたつ×があれば不合格</p>' +
          '<p><b>■ 診断アルゴリズム</b><br>診断対象のURLへ指定サーバからWEBサイトへのクロールを実施し、分析・解析を行います。WEBサイトのWAF等のセキュリティにより診断が正しく行われない可能性があります。また、診断には一部AIを取り入れた判定が含まれます。そのため、AIの誤判定により診断結果が変わる可能性があります。予めご了承ください。</p>' +
          '<p><b>■ 偏差値の計算式</b><br><span class="-w-pp-formula">T = 50 + 10 × (X − μ) / σ</span><br>X:総合スコア, μ:平均(72), σ:標準偏差(15.8)</p>' +
          '<p><b>■ 総合スコアの計算式</b><br><span class="-w-pp-formula">X = Σ(Wi × Si) / ΣWi × 100</span><br>Wi:項目の重み, Si:結果(OK=1, NG=0)</p>' +
        '</div>' +
        '<div class="-w-pp-apx-col">' +
          '<div class="-w-pp-consult">' +
            '<p class="-w-pp-consult-ttl">結果を持って、無料相談へ。</p>' +
            '<p class="-w-pp-consult-sub">― ×の埋め方を、一緒に考えます ―</p>' +
            '<p>検出された×について、「Webで直す打ち手」と「マス媒体で塞ぐ打ち手」の実行プランを無料でご提案します。あなたの業種で実際に効いた実数（媒体×費用×成果）を根拠にご説明しますので、印象論の売り込みはありません。</p>' +
            '<div class="-w-pp-consult-main">' +
              '<p class="-w-pp-consult-line">✔ 結果を持って無料相談する<span class="-w-pp-consult-rec">推奨</span></p>' +
              '<p>診断結果を元に、何から着手すべきか・どの媒体が合うかを具体的にご案内します。しつこい営業はいたしません。</p>' +
              '<p class="-w-pp-consult-web"><b>WEB</b> tosen-net.co.jp/contact/　<b>TEL</b> 00-0000-0000（平日 9:00–18:00）</p>' +
            '</div>' +
            '<div class="-w-pp-subcards">' +
              '<div class="-w-pp-subcard"><b>お見積りを依頼する</b>改善と出稿の概算費用を、内訳明示でお出しします。</div>' +
              '<div class="-w-pp-subcard"><b>同業の事例を見る</b>業種別の「効いた実数」を公開中。</div>' +
            '</div>' +
          '</div>' +
          '<p class="-w-pp-note">※成果に関する数値は特定案件の一例であり、成果を保証するものではありません。掲載は出典・条件・許諾に基づきます。<br>※本診断は公開情報の自動解析による簡易診断であり、結果は推定を含みます。実際の集客状況・改善効果を保証するものではありません。</p>' +
        '</div>' +
      '</div>' +
      foot() + '</section>';

    root.innerHTML = p1 + p2 + catPages + p10 + p11 + p12;
  }

  /* -----------------------------------------------------------
     2b-2. ページ内成績表（承認済み成績表UIに準拠）
        §01 総合評価 / §02 バランス＆成績一覧 / §03 分布マップ /
        §04 ベンチマーク / §05 TOP3
        エンジンの成績表カード（21項目内訳）はその下に温存し、
        重複するヘッダー・レーダーのみCSSで非表示にする
  ----------------------------------------------------------- */
  var SB_BUCKETS = ['~30', '30-40', '40-50', '50-60', '60-70', '70-78', '78~'];
  var SB_HEIGHTS = [8, 22, 52, 100, 62, 24, 9]; // 分布形状（最大100の相対値・参考形状）
  function sbBucketIdx(t) {
    return t < 30 ? 0 : t < 40 ? 1 : t < 50 ? 2 : t < 60 ? 3 : t < 70 ? 4 : t < 78 ? 5 : 6;
  }

  function sbSec(no, jp, en) {
    return '<h3 class="-w-sb-sec">§ 0' + no + '　' + jp + ' <span>' + en + '</span></h3>';
  }

  function sbHistogram(t) {
    var idx = sbBucketIdx(t);
    var bars = SB_BUCKETS.map(function (label, i) {
      return '<div class="-w-sb-hist-col">' +
        (i === idx ? '<span class="-w-sb-hist-marker">あなた ↓</span>' : '') +
        '<div class="-w-sb-hist-bar' + (i === idx ? ' -w-sb-hist-you' : '') + '" style="height:' + SB_HEIGHTS[i] + '%"></div>' +
        '<span class="-w-sb-hist-label">' + label + '</span>' +
      '</div>';
    }).join('');
    return '<div class="-w-sb-hist">' + bars + '</div>';
  }

  function sbRadar(rows) {
    var cx = 160, cy = 122, R = 84, N = rows.length || 7;
    function pt(i, ratio) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return (cx + R * ratio * Math.cos(a)).toFixed(1) + ',' + (cy + R * ratio * Math.sin(a)).toFixed(1);
    }
    var svg = '<svg viewBox="-50 0 420 250" role="img" aria-label="7科目レーダーチャート">';
    [1 / 3, 2 / 3, 1].forEach(function (g) {
      var ps = []; for (var i = 0; i < N; i++) ps.push(pt(i, g));
      svg += '<polygon points="' + ps.join(' ') + '" fill="none" stroke="var(--border-light, #e3e6ea)"/>';
    });
    for (var i = 0; i < N; i++) {
      var e = pt(i, 1).split(',');
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '" stroke="var(--border-light, #e3e6ea)"/>';
    }
    var avgPs = [], youPs = [];
    rows.forEach(function (row, i) {
      avgPs.push(pt(i, (row.cat.avg || 0) / 100));
      youPs.push(pt(i, row.score / 100));
    });
    svg += '<polygon points="' + avgPs.join(' ') + '" fill="rgba(91,102,114,0.10)" stroke="#5b6672" stroke-width="1.2" stroke-dasharray="4 3"/>';
    svg += '<polygon points="' + youPs.join(' ') + '" fill="rgba(200,22,29,0.16)" stroke="#c8161d" stroke-width="2"/>';
    rows.forEach(function (row, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / N;
      var lx = cx + (R + 20) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
      var anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + anchor + '" font-size="11" font-weight="700" fill="var(--o-r-colors-base_text, #1f2933)">' + row.name + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  function buildScoreboard(container) {
    var old = $('tosen-scoreboard');
    if (old) old.parentNode.removeChild(old);
    var d = ppCompute(container);
    if (!d.rows.length) return;

    /* §01 */
    var s01 = sbSec(1, '総合評価', 'TOTAL SCORE') +
      '<div class="-w-sb-total">' +
        '<div class="-w-sb-grade -w-gl-' + d.totGrade.toLowerCase() + '">' +
          '<span class="-w-sb-grade-tag">TOTAL</span>' +
          '<strong>' + d.totGrade + '</strong>' +
          '<span class="-w-sb-grade-word">' + PP_GRADE_WORD[d.totGrade] + '<br>GRADE</span>' +
        '</div>' +
        '<div class="-w-sb-total-body">' +
          '<p class="-w-sb-headline">あなたのサイトは <strong>' + ppNum(PP_POP_ALL) + 'サイト中 ' + ppNum(d.rankAll) + '番目</strong></p>' +
          '<div class="-w-sb-stats">' +
            '<div><span>偏差値</span><strong>' + d.totDevi + '</strong></div>' +
            '<div><span>総合得点</span><strong>' + d.totScore + '</strong><i>/100</i></div>' +
          '</div>' +
        '</div>' +
        '<div class="-w-sb-owl">' +
          '<span class="-w-sb-owl-corner">OWLet</span>' +
          '<p>' + PP_OWL_TOTAL[d.totGrade] + '</p>' +
          '<span class="-w-sb-owl-sig">―― OWLet先生の一言</span>' +
        '</div>' +
      '</div>';

    /* §02 */
    var tableRows = d.rows.map(function (r) {
      return '<tr>' +
        '<td class="-w-sb-td-subject"><span class="-w-sb-no">' + r.cat.no + '</span>' + r.cat.name + ' <i class="-w-sb-sin">∕' + r.cat.sin + '</i></td>' +
        '<td>' + r.score + '</td>' +
        '<td>' + r.cat.avg + '</td>' +
        '<td>' + r.devi + '</td>' +
        '<td><span class="-w-sb-eval -w-gl-' + r.grade.toLowerCase() + '">' + r.grade + '</span></td>' +
        '<td>' + ppNum(r.rank) + '</td>' +
      '</tr>';
    }).join('') +
      '<tr class="-w-sb-tr-total"><td class="-w-sb-td-subject">総合</td><td>' + d.totScore + '</td><td>' + PP_MU_IND + '</td><td>' + d.indDevi + '</td>' +
      '<td><span class="-w-sb-eval -w-gl-' + d.totGrade.toLowerCase() + '">' + d.totGrade + '</span></td><td>' + ppNum(d.rankAll) + '</td></tr>';

    var s02 = sbSec(2, '科目別バランス ＆ 成績一覧', 'CATEGORY BREAKDOWN') +
      '<div class="-w-sb-balance">' +
        '<div class="-w-sb-radar">' +
          '<p class="-w-sb-box-ttl">7科目レーダー<span class="-w-sb-radar-legend"><i class="-w-sb-lg-you"></i>あなた　<i class="-w-sb-lg-avg"></i>平均</span></p>' +
          sbRadar(d.rows) +
        '</div>' +
        '<div class="-w-sb-table-wrap">' +
          '<p class="-w-sb-box-ttl">科目別 成績表<span class="-w-sb-box-en">Score Table</span></p>' +
          '<div class="-w-sb-table-scroll"><table class="-w-sb-table">' +
            '<thead><tr><th class="-w-sb-td-subject">科目（七つの取りこぼし）</th><th>得点</th><th>平均</th><th>偏差値</th><th>評価</th><th>順位</th></tr></thead>' +
            '<tbody>' + tableRows + '</tbody>' +
          '</table></div>' +
        '</div>' +
      '</div>';

    /* §03 */
    var indBox;
    if (d.industry) {
      indBox = '<div class="-w-sb-dist-box">' +
        '<p class="-w-sb-box-ttl">業界内分布（' + d.industry + '）<span class="-w-sb-box-en">Industry</span></p>' +
        sbHistogram(d.indDevi) +
        '<p class="-w-sb-dist-cap"><strong>' + ppNum(d.rankInd) + '</strong> / ' + ppNum(PP_POP_IND) + '位（偏差値' + d.indDevi + '）</p>' +
      '</div>';
    } else {
      indBox = '<div class="-w-sb-dist-box -w-sb-dist-empty"><p>業界を指定すると分布が表示されます</p></div>';
    }
    var s03 = sbSec(3, '全体分布マップ ― あなたはここ', 'DISTRIBUTION MAP') +
      '<div class="-w-sb-dist">' +
        '<div class="-w-sb-dist-box">' +
          '<p class="-w-sb-box-ttl">全体分布（' + ppNum(PP_POP_ALL) + 'サイト）<span class="-w-sb-box-en">Overall</span></p>' +
          sbHistogram(d.totDevi) +
        '</div>' + indBox +
      '</div>';

    /* §04 */
    var bench = d.rows.map(function (r) {
      var top10 = Math.min(100, Math.round((r.cat.avg || 0) + 20));
      return '<div class="-w-sb-bench-row">' +
        '<span class="-w-sb-bench-label">' + r.cat.name + '<i class="-w-sb-sin">∕' + r.cat.sin + '</i></span>' +
        '<span class="-w-sb-bench-track">' +
          '<span class="-w-sb-bench-you" style="width:' + r.score + '%"></span>' +
          '<span class="-w-sb-bench-avg" style="left:' + r.cat.avg + '%"></span>' +
          '<span class="-w-sb-bench-top" style="left:' + top10 + '%"></span>' +
        '</span>' +
        '<span class="-w-sb-bench-val">' + r.score + ' / 100</span>' +
      '</div>';
    }).join('');
    var s04 = sbSec(4, 'あなた vs 業界平均 vs トップ10%', 'BENCHMARK') +
      '<div class="-w-sb-bench">' +
        '<p class="-w-sb-bench-legend"><i class="-w-sb-lg-you"></i>あなた　<i class="-w-sb-lg-line -w-sb-lg-avgline"></i>業界平均　<i class="-w-sb-lg-line -w-sb-lg-topline"></i>トップ10%</p>' +
        bench +
      '</div>';

    /* §05 */
    var top3;
    if (d.failItems.length) {
      top3 = '<div class="-w-sb-top3">' + d.failItems.slice(0, 3).map(function (f, i) {
        return '<div class="-w-sb-top3-card">' +
          '<span class="-w-sb-top3-num">' + (i + 1) + '</span>' +
          '<p class="-w-sb-top3-cat">' + f.row.cat.name + '∕' + f.row.cat.sin + '</p>' +
          '<p class="-w-sb-top3-ttl">' + f.def.n + '</p>' +
          '<p class="-w-sb-top3-text">' + f.def.top3 + '</p>' +
        '</div>';
      }).join('') + '</div>';
    } else {
      top3 = '<p class="-w-sb-allok">不合格（×）の項目はありませんでした。守りは合格です。</p>';
    }
    var s05 = sbSec(5, '最優先で直したい3項目', 'TOP 3 ACTIONS') + top3;

    var div = document.createElement('div');
    div.id = 'tosen-scoreboard';
    div.className = '-w-sb no-print';
    div.innerHTML =
      '<div class="-w-sb-head">' +
        '<div>' +
          '<p class="-w-sb-en">WEB PRESENCE QUALITY CHECK REPORT</p>' +
          '<h2 class="-w-sb-title">成績表</h2>' +
          '<p class="-w-sb-sub">七つの取りこぼし診断 ∕ Webサイト品質診断 ∕ 全7科目 総合評価</p>' +
        '</div>' +
        '<div class="-w-sb-meta">診断対象　<span>' + d.diagUrl + '</span><br>診断日　' + d.diagDate + '</div>' +
      '</div>' +
      s01 + s02 + s03 + s04 + s05 +
      '<p class="-w-sb-refnote">※平均点・分布・順位はOWLet診断データベースの蓄積値に基づく参考値です。</p>' +
      sbSec(6, '科目別詳細', 'ITEM BREAKDOWN');
    container.parentNode.insertBefore(div, container);
  }

  /* -----------------------------------------------------------
     2c. アンケート回答 → お困り事カード切替（入口文脈の引き継ぎ）
  ----------------------------------------------------------- */
  function updateSolutionCard() {
    var card = $('solution-card');
    var conf = SOLUTION_CARDS[state.surveyTrigger];
    if (!card || !conf) return;
    card.setAttribute('href', conf.url);
    card.setAttribute('data-card', conf.card);
    var ttl = card.querySelector('.-w-next-card-ttl');
    var tag = card.querySelector('.-w-next-card-tag');
    var text = card.querySelector('.-w-next-card-text');
    var link = card.querySelector('.-w-next-card-link');
    if (ttl) ttl.textContent = conf.ttl;
    if (tag) tag.textContent = conf.tag;
    if (text) text.textContent = conf.text;
    if (link) link.innerHTML = conf.link + iconSvg('i-arrow-right');
  }

  function initSurveyBridge() {
    var form = $('survey-form');
    if (!form) return;
    // エンジンの送信処理には干渉せず、回答値だけを読み取る
    form.addEventListener('submit', function () {
      var checked = form.querySelector('input[name="trigger"]:checked');
      if (checked) {
        state.surveyTrigger = checked.value;
        updateSolutionCard();
      }
      var ind = form.querySelector('#industry-select');
      if (ind && ind.value) state.surveyIndustry = ind.value;
    });
  }

  function initReportObserver() {
    var container = $('seven-report-container');
    if (!container || !('MutationObserver' in window)) return;

    var observer = new MutationObserver(function () {
      if (state.reportDone) return;
      if (container.querySelector('.-w-report-card')) {
        state.reportDone = true;
        var results = parseReport(container);
        buildScoreboard(container);
        renderBridge(results);
        buildPrintReport(container, results);
        updateSticky();
      }
    });
    observer.observe(container, { childList: true });
  }

  /* -----------------------------------------------------------
     3. 追従CTA（スクロール75%で出現・SSOT確定値）
  ----------------------------------------------------------- */
  var sticky, stickyText, stickyBtn;

  function diagnosisRunning() {
    var diag = $('step-diagnosis');
    var actions = $('final-actions');
    return !!(diag && !diag.hidden && actions &&
      actions.classList.contains('-w-is-locked'));
  }

  function overlayOpen() {
    var survey = $('survey-overlay');
    var exit = $('tosen-exit');
    return !!(survey && !survey.hidden) || !!(exit && !exit.hidden);
  }

  function updateSticky() {
    if (!sticky) return;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = docH > 0 ? window.scrollY / docH : 0;
    var show = ratio >= 0.75 &&
      !state.stickyClosed &&
      !diagnosisRunning() &&
      !overlayOpen();

    if (show && sticky.hidden) {
      // 状態別の文言切り替え（診断前／診断完了後）
      if (state.reportDone) {
        stickyText.textContent = '×項目の直し方、無料でご案内します';
        stickyBtn.textContent = '無料相談する';
        stickyBtn.setAttribute('href', '/contact/');
        stickyBtn.setAttribute('data-tsn-consult', '');
        stickyBtn.setAttribute('data-placement', 'sticky_post');
      } else {
        stickyText.textContent = 'あなたのサイトの取りこぼし、1分でわかります';
        stickyBtn.textContent = '無料で診断する';
        stickyBtn.setAttribute('href', '#step-entry');
        stickyBtn.removeAttribute('data-tsn-consult');
        stickyBtn.setAttribute('data-placement', 'sticky_pre');
      }
      sticky.hidden = false;
      track('sticky_show', { state: state.reportDone ? 'post' : 'pre' });
    } else if (!show && !sticky.hidden) {
      sticky.hidden = true;
    }
  }

  function initSticky() {
    sticky = $('tosen-sticky');
    stickyText = $('tosen-sticky-text');
    stickyBtn = $('tosen-sticky-btn');
    if (!sticky) return;

    $('tosen-sticky-close').addEventListener('click', function () {
      state.stickyClosed = true;
      sticky.hidden = true;
      try { sessionStorage.setItem('tosenStickyClosed', '1'); } catch (e) { /* 続行 */ }
    });
    try {
      if (sessionStorage.getItem('tosenStickyClosed') === '1') state.stickyClosed = true;
    } catch (e) { /* 続行 */ }

    window.addEventListener('scroll', updateSticky, { passive: true });
    window.addEventListener('resize', updateSticky, { passive: true });
  }

  /* -----------------------------------------------------------
     4. Exit Intent（3分岐・PCのみ・1セッション1回＋7日抑止）
  ----------------------------------------------------------- */
  var EXIT_SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;

  function exitSuppressed() {
    if (state.exitShown) return true;
    try {
      var ts = parseInt(localStorage.getItem('tosenExitShown') || '0', 10);
      return ts && (Date.now() - ts) < EXIT_SUPPRESS_MS;
    } catch (e) {
      return false;
    }
  }

  function openExit() {
    var exit = $('tosen-exit');
    if (!exit) return;
    var title = $('tosen-exit-title');
    var text = $('tosen-exit-text');
    var main = $('tosen-exit-main');
    var dismiss = $('tosen-exit-dismiss');
    var variant;

    if (!state.reportDone) {
      variant = 'pre';
      title.textContent = '1分だけ、"取りこぼし"を見てからにしませんか？';
      text.textContent = 'URLを入れるだけで、いま逃している集客の穴がその場で分かります。無料・登録不要です。';
      main.textContent = '取りこぼしを無料で診断する';
      main.onclick = function () {
        closeExit();
        var entry = $('step-entry');
        if (entry && !entry.hidden) entry.scrollIntoView({ behavior: 'smooth' });
        var input = $('target-url');
        if (input) input.focus();
      };
      dismiss.textContent = '今回はやめておく';
    } else if (!state.pdfSaved) {
      variant = 'post_nosave';
      title.textContent = 'この成績表、保存しなくて大丈夫ですか？';
      text.textContent = 'ページを閉じると結果は見られなくなります。PDFで手元に残しておけます。';
      main.textContent = '成績表をPDFで保存する';
      main.onclick = function () {
        closeExit();
        var btn = $('download-btn');
        if (btn && !btn.disabled) btn.click();
      };
      dismiss.textContent = '保存せずに閉じる';
    } else {
      variant = 'post_noconsult';
      title.textContent = '診断結果、そのままにしていませんか。';
      text.textContent = '穴の見方と「最初の一手」だけ、30分の無料相談でお伝えします。売り込みはしません。';
      main.textContent = '無料相談を予約する';
      main.onclick = function () {
        closeExit();
        track('generate_lead', { lead_type: 'consult', placement: 'exit' });
        location.href = '/contact/';
      };
      dismiss.textContent = '今回はやめておく';
    }

    state.exitShown = true;
    try { localStorage.setItem('tosenExitShown', String(Date.now())); } catch (e) { /* 続行 */ }
    exit.hidden = false;
    document.body.classList.add('-w-modal-open');
    var close = exit.querySelector('.-w-exit-close');
    if (close) close.focus();
    updateSticky();
    track('exit_show', { state: variant });
  }

  function closeExit() {
    var exit = $('tosen-exit');
    if (!exit) return;
    exit.hidden = true;
    document.body.classList.remove('-w-modal-open');
    updateSticky();
  }

  function initExitIntent() {
    var exit = $('tosen-exit');
    if (!exit) return;

    document.addEventListener('mouseout', function (e) {
      // ビューポート上端からのマウス離脱のみ（PC）。モーダル表示中は発火しない
      if (e.relatedTarget || e.clientY > 0) return;
      if (exitSuppressed() || overlayOpen()) return;
      openExit();
    });

    exit.querySelectorAll('[data-exit-close]').forEach(function (btn) {
      btn.addEventListener('click', closeExit);
    });
    exit.addEventListener('click', function (e) {
      if (e.target === exit) closeExit();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !exit.hidden) closeExit();
    });
  }

  /* -----------------------------------------------------------
     5. 計測（相談クリック placement／カード回遊／PDF保存フラグ）
  ----------------------------------------------------------- */
  function initTracking() {
    document.addEventListener('click', function (e) {
      var consult = e.target.closest('[data-tsn-consult]');
      if (consult) {
        track('generate_lead', {
          lead_type: 'consult',
          placement: consult.dataset.placement || 'unknown'
        });
        return;
      }
      var card = e.target.closest('[data-tsn-card]');
      if (card) {
        track('card_click', { card: card.dataset.card || 'unknown' });
      }
    });

    var dl = $('download-btn');
    if (dl) {
      dl.addEventListener('click', function () {
        if (!dl.disabled) state.pdfSaved = true;
      });
    }
  }

  /* -----------------------------------------------------------
     初期化
  ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initEntryParams();
    initSurveyBridge();
    initReportObserver();
    initSticky();
    initExitIntent();
    initTracking();
  });
})();
