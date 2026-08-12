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
        { label: '新聞折込', icon: 'i-doc-lines' },
        { label: '地域TV', icon: 'i-tv' },
        { label: 'ラジオ', icon: 'i-radio' }
      ],
      ev: '紙・交通広告を起点にしたキャンペーンで、LP流入 <strong>14,000件超</strong> の実績があります。',
      src: '出典：東宣 実施実績（がん啓発キャンペーン／流入＝LPセッション数）'
    },
    'II': {
      hole: 'サイトの強みが伝わる前に離脱されている可能性があります',
      rx: '新聞・住宅情報誌・折込のクリエイティブで「伝わる訴求」を設計し、サイトへ還流させる導線が有効です（制作はグループ会社TACと一気通貫）。',
      media: [
        { label: '新聞広告', icon: 'i-doc-lines' },
        { label: '新聞折込', icon: 'i-doc-lines' }
      ],
      ev: '関東・関西の住宅会社で、ブランディングTVCMからメディアプラン・バイイングまでの一括運用実績があります。',
      src: '※社名・数値は掲載許諾の確定後に表示します'
    },
    'III': {
      hole: '会社を信頼してもらう根拠が不足している可能性があります',
      rx: '第三者公査（日本ABC協会）の部数データを持つ新聞や地域TVへの掲載は、それ自体が「マス媒体に載っている会社」という信用補完になります。',
      media: [
        { label: '新聞広告', icon: 'i-doc-lines' },
        { label: '地域TV', icon: 'i-tv' }
      ],
      ev: '東宣は官公庁・公的機関（国税局・警察・自治体 等）の広告実績を多数持つ、創業1958年の広告会社です。',
      src: '出典：東宣 業務実績（公的機関案件）'
    },
    'IV': {
      hole: '訪問者がサイト内で迷い、行動にたどり着けていない可能性があります',
      rx: '折込チラシ＋QRコードなら「電話・来店・LP直行」の一直線導線を紙側に設計でき、サイト内の迷子を回避できます。',
      media: [
        { label: '新聞折込', icon: 'i-doc-lines' },
        { label: '交通広告', icon: 'i-train' }
      ],
      ev: '紙・交通広告を起点にしたLP直行導線で、流入 <strong>14,000件超</strong> の実績があります。',
      src: '出典：東宣 実施実績（がん啓発キャンペーン／流入＝LPセッション数）'
    },
    'V': {
      hole: '安心して集客・出稿できる状態ではない可能性があります',
      rx: 'まずWeb側の改善が先決です。無料相談で対処の方針をご案内します。並行して、紙媒体はサイトの状態に左右されず商圏へ届く手段として使えます。',
      media: [
        { label: 'まずWeb改善', icon: 'i-wrench' }
      ],
      ev: null,
      src: null
    },
    'VI': {
      hole: '表示の遅さ・見づらさで、せっかくの訪問者が離脱している可能性があります',
      rx: 'まず受け皿（サイト）の改善が先決です。無料相談で対処の方針をご案内します。紙媒体は表示速度に依存しない到達手段として並走できます。',
      media: [
        { label: 'まずWeb改善', icon: 'i-wrench' },
        { label: '新聞折込', icon: 'i-doc-lines' }
      ],
      ev: null,
      src: null
    },
    'VII': {
      hole: '効果が測れておらず、販促の良し悪しを判断できない可能性があります',
      rx: 'クーポン・QRコード付きの折込は、反響が「回収枚数」でそのまま数えられる、計測できるマス媒体です。数字で判断する販促に切り替えられます。',
      media: [
        { label: '新聞折込', icon: 'i-doc-lines' },
        { label: '新聞広告', icon: 'i-doc-lines' }
      ],
      ev: '媒体接触の実測例として、総接触 <strong>6,024,186人</strong> を記録した企画があります。',
      src: '出典：東宣 実施実績（渋沢栄一関連企画／総接触＝各媒体接触人数の合算）'
    }
  };

  var state = {
    from: null,        // column | price | null
    focusCat: null,    // ?t= で指定されたローマ数字
    reportDone: false,
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
    var media = rx.media.map(function (m) {
      return '<span>' + iconSvg(m.icon) + m.label + '</span>';
    }).join('');
    var ev = rx.ev
      ? '<div class="-w-bridge-ev">' + rx.ev +
        (rx.src ? '<span class="-w-bridge-src">' + rx.src + '</span>' : '') + '</div>'
      : '';
    return '<div class="-w-bridge-card" data-category="' + result.roman + '">' +
      '<div class="-w-bridge-card-top">' +
        '<span class="-w-bridge-x">' + iconSvg('i-close') + '×判定</span>' +
        '<span class="-w-bridge-hole">' + result.roman + '. ' + result.name + '：' + rx.hole + '</span>' +
      '</div>' +
      '<p class="-w-bridge-rx">' + rx.rx + '</p>' +
      '<div class="-w-bridge-media">' + media + '</div>' +
      ev +
      '<a class="-w-bridge-col-link" href="/column/?t=' + result.roman + '" data-tsn-card data-card="bridge_column">この分野の解説コラムを読む</a>' +
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
      '</div>';
    }

    html += '<div class="-w-bridge-close">' +
      '<p class="-w-bridge-close-lead">あなたの結果に、どの処方が合うか。答え合わせは無料です。</p>' +
      '<a class="-w-consult-btn -w-button-click" href="#final-cta" data-tsn-consult data-placement="bridge">' +
        iconSvg('i-headset') + '<span>自社に合う処方を無料で聞く</span></a>' +
    '</div>' +
    '<p class="-w-bridge-note">※掲載の数値は各案件の実績であり、同様の効果をお約束するものではありません。</p>';

    bridge.innerHTML = html;
    bridge.hidden = false;

    // 導線B（費用ページ）流入時は10万円テストカードを強調
    if (state.from === 'price') {
      var trial = $('trial-card');
      if (trial) trial.classList.add('-w-trial-open');
    }

    track('bridge_view', {
      ng_count: fails.length,
      ng_categories: fails.map(function (r) { return r.roman; }).join(',')
    });
  }

  function initReportObserver() {
    var container = $('seven-report-container');
    if (!container || !('MutationObserver' in window)) return;

    var observer = new MutationObserver(function () {
      if (state.reportDone) return;
      if (container.querySelector('.-w-report-card')) {
        state.reportDone = true;
        renderBridge(parseReport(container));
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
        stickyBtn.setAttribute('href', '#final-cta');
        stickyBtn.setAttribute('data-placement', 'sticky_post');
      } else {
        stickyText.textContent = 'あなたのサイトの取りこぼし、1分でわかります';
        stickyBtn.textContent = '無料で診断する';
        stickyBtn.setAttribute('href', '#step-entry');
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
        var cta = $('final-cta');
        if (cta) cta.scrollIntoView({ behavior: 'smooth' });
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
          lead_type: consult.dataset.placement === 'trial_card' || consult.dataset.placement === 'final_trial'
            ? 'trial' : 'consult',
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
    initReportObserver();
    initSticky();
    initExitIntent();
    initTracking();
  });
})();
