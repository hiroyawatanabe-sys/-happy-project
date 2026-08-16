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
     ※媒体の選び方はガイドカード（/solution/media-choice/）と重複するため一覧へ */
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
      closeSub = '<a class="-w-bridge-close-sub" href="/solution/media-choice/" data-tsn-card data-card="guide">先に「媒体の選び方」を自分で読む</a>';
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
         参考: ガーディアン本番PDF（print_pdf.php）の構成を東宣仕様へ転換
         表紙 → 成績表サマリ → 処方箋・次の一手 の3ページ構成
  ----------------------------------------------------------- */
  function buildPrintReport(container, results) {
    var root = $('tosen-print');
    if (!root) return;

    var metaEl = container.querySelector('.-w-report-meta');
    var metaText = metaEl ? metaEl.textContent : '';
    var urlMatch = metaText.match(/診断URL：(.+?)診断日時：/);
    var dateMatch = metaText.match(/診断日時：([0-9\/]+ [0-9:]+)/);
    var passMatch = metaText.match(/合格項目：(\d+)\s*\/\s*21/);
    var diagUrl = urlMatch ? urlMatch[1] : '';
    var diagDate = dateMatch ? dateMatch[1].trim() : '';
    var passCount = passMatch ? passMatch[1] : '-';

    var stampEl = container.querySelector('.-w-report-stamp');
    var stampHtml = stampEl ? stampEl.outerHTML : '';
    var gradeEl = container.querySelector('.-w-report-stamp-grade');
    var gradeLabel = gradeEl ? gradeEl.textContent.trim() : '';

    var radarEl = container.querySelector('.-w-report-radar svg');
    var radarHtml = radarEl ? radarEl.outerHTML : '';

    var GRADE_MSG = {
      '小': '大きな取りこぼしは見当たりませんでした。次は「攻めの認知」で商圏シェアを取りにいく段階です。',
      '中': '放置すると機会損失につながる項目があります。×の項目から一つずつ塞いでいきましょう。',
      '大': '集客の取りこぼしが起きている可能性が高い状態です。優先度の高い×から着手をおすすめします。',
      '特大': '複数の経路でお客様を逃している可能性があります。まずは無料相談で対処の順番を整理しましょう。'
    };
    var JUDGE_LABEL = { pass: '合格', warn: '要注意', fail: '要改善' };

    // 各カテゴリ行のコメント・項目を成績表から回収
    var rows = [];
    container.querySelectorAll('.-w-report-row').forEach(function (row) {
      var roman = row.querySelector('.-w-report-row-roman');
      var name = row.querySelector('.-w-report-row-name');
      var judge = row.querySelector('.-w-report-row-judge');
      var comment = row.querySelector('.-w-report-row-comment');
      var items = [];
      row.querySelectorAll('.-w-report-item').forEach(function (item) {
        items.push({
          pass: item.classList.contains('-w-item-pass'),
          label: item.textContent.replace(/：(合格|不合格)$/, '').trim()
        });
      });
      if (roman && judge) {
        rows.push({
          roman: roman.textContent.trim(),
          name: name ? name.textContent.trim() : '',
          judgeText: judge.textContent.trim(),
          judgeCls: judge.classList.contains('-w-judge-fail') ? 'fail' : (judge.classList.contains('-w-judge-warn') ? 'warn' : 'pass'),
          comment: comment ? comment.textContent.trim() : '',
          items: items
        });
      }
    });

    var failRows = rows.filter(function (r) { return r.judgeCls === 'fail'; });
    var warnRows = rows.filter(function (r) { return r.judgeCls === 'warn'; });

    function header(pageTitle) {
      return '<div class="-w-pp-head">' +
        '<img class="-w-pp-logo" src="assets/logo-tosen.jpg" alt="株式会社東宣（TOSEN）">' +
        '<div class="-w-pp-head-right">' +
          '<span class="-w-pp-head-title">' + pageTitle + '</span>' +
          '<span class="-w-pp-provided">PROVIDED BY 株式会社ガーディアン</span>' +
        '</div>' +
      '</div>';
    }
    function footer(num) {
      return '<div class="-w-pp-foot">' +
        '<span>PROVIDED BY 株式会社ガーディアン　｜　WEB集客 取りこぼし診断</span>' +
        '<span>Page 0' + num + ' / 03</span>' +
      '</div>';
    }

    /* ---- Page 1: 表紙 ---- */
    var p1 = '<section class="-w-pp -w-pp-cover">' + header('WEB MARKETING LEAK CHECK REPORT') +
      '<div class="-w-pp-cover-main">' +
        '<p class="-w-pp-cover-en">WEB MARKETING LEAK CHECK REPORT</p>' +
        '<h1 class="-w-pp-cover-title">WEB集客 取りこぼし診断<br>レポート</h1>' +
        '<div class="-w-pp-cover-stamp">' + stampHtml + '</div>' +
        '<table class="-w-pp-cover-meta"><tbody>' +
          '<tr><th>診断URL</th><td>' + diagUrl + '</td></tr>' +
          '<tr><th>診断日</th><td>' + diagDate + '</td></tr>' +
          '<tr><th>診断項目</th><td>7カテゴリ 21項目（自動診断）／合格 ' + passCount + ' / 21</td></tr>' +
        '</tbody></table>' +
        '<p class="-w-pp-cover-org">株式会社 東宣（TOSEN）　創業1948年／全省庁統一資格／日本ABC協会加盟</p>' +
      '</div>' + footer(1) + '</section>';

    /* ---- Page 2: 成績表サマリ ---- */
    var tableRows = rows.map(function (r, i) {
      var ok = r.items.filter(function (it) { return it.pass; }).length;
      return '<tr>' +
        '<td class="-w-pp-td-roman">' + r.roman + '</td>' +
        '<td>' + r.name + '</td>' +
        '<td class="-w-pp-td-num">' + ok + ' / ' + r.items.length + '</td>' +
        '<td><span class="-w-pp-judge -w-pp-judge-' + r.judgeCls + '">' + JUDGE_LABEL[r.judgeCls] + '</span></td>' +
      '</tr>';
    }).join('');

    var topActions = failRows.slice(0, 3).map(function (r, i) {
      return '<div class="-w-pp-action">' +
        '<span class="-w-pp-action-num">' + (i + 1) + '</span>' +
        '<div><p class="-w-pp-action-ttl">' + r.roman + '. ' + r.name + '</p>' +
        '<p class="-w-pp-action-text">' + r.comment + '</p></div>' +
      '</div>';
    }).join('') || '<p class="-w-pp-note-inline">要改善（×）のカテゴリはありませんでした。</p>';

    var p2 = '<section class="-w-pp">' + header('成績表　SCORE REPORT') +
      '<h2 class="-w-pp-sec">§01　総合判定 <span>TOTAL</span></h2>' +
      '<div class="-w-pp-total">' +
        '<div class="-w-pp-total-stamp">' + stampHtml + '</div>' +
        '<div class="-w-pp-total-body">' +
          '<p class="-w-pp-total-line">合格項目：<strong>' + passCount + ' / 21</strong>　取りこぼしリスク：<strong>' + gradeLabel + '</strong></p>' +
          '<p class="-w-pp-total-msg">' + (GRADE_MSG[gradeLabel] || '') + '</p>' +
        '</div>' +
      '</div>' +
      '<h2 class="-w-pp-sec">§02　7カテゴリバランス <span>CATEGORY BREAKDOWN</span></h2>' +
      '<div class="-w-pp-balance">' +
        '<div class="-w-pp-radar">' + radarHtml + '</div>' +
        '<table class="-w-pp-table"><thead><tr><th></th><th>カテゴリ</th><th>合格</th><th>判定</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody></table>' +
      '</div>' +
      '<h2 class="-w-pp-sec">§03　最優先で直したい項目 <span>TOP ACTIONS</span></h2>' +
      topActions +
      footer(2) + '</section>';

    /* ---- Page 3: 処方箋・次の一手 ---- */
    var targets = failRows.length ? failRows : warnRows;
    var rxCards = targets.slice(0, 3).map(function (r) {
      var rx = RX[r.roman];
      if (!rx) return '';
      var media = rx.media.map(function (m) { return '<span>' + m.label + '</span>'; }).join('');
      return '<div class="-w-pp-rx">' +
        '<p class="-w-pp-rx-ttl">' + r.roman + '. ' + r.name + '：' + rx.hole + '</p>' +
        '<p class="-w-pp-rx-text">' + rx.rx + '</p>' +
        '<div class="-w-pp-rx-media">' + media + '</div>' +
        (rx.ev ? '<p class="-w-pp-rx-ev">' + rx.ev + (rx.src ? '<span>' + rx.src + '</span>' : '') + '</p>' : '') +
      '</div>';
    }).join('') || '<div class="-w-pp-rx"><p class="-w-pp-rx-ttl">守りは合格。次は攻めの認知です。</p>' +
      '<p class="-w-pp-rx-text">サイトの受け皿は整っています。王道メディアで商圏の認知シェアを取りにいく打ち手をご提案できます。</p></div>';

    var p3 = '<section class="-w-pp">' + header('処方箋　PRESCRIPTION') +
      '<h2 class="-w-pp-sec">§04　王道メディア処方 <span>PRESCRIPTION</span></h2>' +
      '<p class="-w-pp-lead">×の原因ごとに、Web施策だけでなく新聞折込・地域TV・ラジオ・交通広告などの"王道メディア"まで含めた打ち手を処方します。</p>' +
      rxCards +
      '<h2 class="-w-pp-sec">§05　次の一手 <span>NEXT ACTION</span></h2>' +
      '<div class="-w-pp-next">' +
        '<p class="-w-pp-next-ttl">この成績表を見ながら、30分の無料相談ができます</p>' +
        '<p class="-w-pp-next-text">オンラインOK。結果の見方と「最初の一手」だけお伝えします。売り込みはしません。</p>' +
        '<p class="-w-pp-next-url">無料相談・お問い合わせ　▶　https://www.tosen-net.co.jp/contact/</p>' +
        '<p class="-w-pp-next-org">株式会社 東宣（TOSEN）　〒104-0031 東京都中央区京橋3-7-10 東宣ビル2階</p>' +
      '</div>' +
      '<p class="-w-pp-note">※本診断は公開情報の自動解析による簡易診断であり、結果は推定を含みます。実際の集客状況・改善効果を保証するものではありません。<br>' +
      '※掲載の数値は各案件の実績であり、同様の効果をお約束するものではありません。</p>' +
      footer(3) + '</section>';

    root.innerHTML = p1 + p2 + p3;
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
