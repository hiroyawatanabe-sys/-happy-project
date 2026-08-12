/* =============================================================
   新・七つの大罪 診断ツール（seven-cta）

   フロー:
     入力(step-entry) → 診断中(step-diagnosis + アンケートモーダル)
     → 成績表描画 → PDF発行(印刷) ／ エラー時は step-error 等へ

   本番接続:
     DIAGNOSIS_API にエンドポイントを設定すると fetch で診断を実行。
     未設定(null)の間は、URL文字列をシードにした決定論的シミュレーション
     で完走する（同じURLなら同じ結果）。

   本番JS(seven_cta3.js)との互換:
     _startDiagnosis / _submitSurvey / _industrySurvey /
     finishDiagnosis / _pdfGenerate をグローバルに公開。
============================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     設定
  ----------------------------------------------------------- */
  var DIAGNOSIS_API = null;      // 例: '/api/new-seven-deadly-sins/diagnose'
  var MAINTENANCE = false;       // true でメンテナンス画面を表示
  var RATE_LIMIT = { max: 3, windowMs: 30 * 60 * 1000 }; // 30分に3回（本番仕様）
  var CATEGORY_MS = 1900;        // 1カテゴリあたりの演出時間（デモ）

  /* -----------------------------------------------------------
     診断カテゴリ定義（7つの大罪 × 各3項目 = 21項目）
     p: デモ時の項目合格率（実態に近い傾向値）
  ----------------------------------------------------------- */
  var CATEGORIES = [
    {
      key: 'attract', roman: 'I', name: 'サイト集客基礎力', latin: 'Superbia — 傲慢の罪',
      items: [
        { label: 'インデックス設定', p: 0.85 },
        { label: '構造化データ', p: 0.45 },
        { label: 'XMLサイトマップ', p: 0.6 }
      ],
      comments: {
        pass: 'Googleに正しく門戸が開かれています。検索エンジンとの対話は良好です。',
        warn: '検索エンジンへの伝達に不足があります。構造化データ等の整備で流入の土台を固めましょう。',
        fail: '世界最大の紹介者であるGoogleに門を閉ざしています。インデックス基盤の早急な整備が必要です。'
      }
    },
    {
      key: 'serve', roman: 'II', name: 'サイト接客力', latin: 'Avaritia — 強欲の罪',
      items: [
        { label: 'USPの明示', p: 0.5 },
        { label: '採用情報', p: 0.55 },
        { label: 'ファーストビュー', p: 0.6 }
      ],
      comments: {
        pass: '訪問者に価値が伝わる接客ができています。この強みを磨き続けましょう。',
        warn: '価値の提示が不十分です。強みが伝わる前に離脱される恐れがあります。',
        fail: '価値を与えずして問い合わせだけを欲しがる状態です。伝えるべき強みの再設計が必要です。'
      }
    },
    {
      key: 'trust', roman: 'III', name: '会社信用力', latin: 'Invidia — 嫉妬の罪',
      items: [
        { label: '会社情報の表記', p: 0.75 },
        { label: 'プライバシーポリシー', p: 0.65 },
        { label: '更新頻度', p: 0.4 }
      ],
      comments: {
        pass: '信用の土台は良好です。継続的な情報発信で信頼をさらに積み上げましょう。',
        warn: '信用構築に穴があります。放置されたサイトは、それだけで選ばれない理由になります。',
        fail: '自らの信用構築を怠っています。会社の顔として最低限の信頼情報を整備してください。'
      }
    },
    {
      key: 'guide', roman: 'IV', name: 'サイト顧客誘導力', latin: 'Acedia — 怠惰の罪',
      items: [
        { label: 'グローバルナビ', p: 0.8 },
        { label: 'リンクの視認性', p: 0.55 },
        { label: '文字サイズ', p: 0.7 }
      ],
      comments: {
        pass: '訪問者を目的地へ導く道が整備されています。迷わせないサイトは成果に直結します。',
        warn: '導線の一部に難があります。訪問者が目的地へたどり着く前に迷子になっています。',
        fail: '道の整備が放棄されています。どれだけ集客しても、导線がなければ成果は生まれません。'
      }
    },
    {
      key: 'defense', roman: 'V', name: 'サイト防御力', latin: 'Gula — 暴食の罪',
      items: [
        { label: 'CMSバージョン秘匿', p: 0.35 },
        { label: 'TLS証明書', p: 0.85 },
        { label: 'Mixed Content', p: 0.7 }
      ],
      comments: {
        pass: '防御態勢は良好です。セキュリティは信頼の前提条件。この水準を維持してください。',
        warn: '防御に隙があります。攻撃者はこの小さな隙から侵入します。早めの対処を。',
        fail: '便利さの代償を顧みない危険な状態です。改ざん・情報漏えいの前に防御を固めてください。'
      }
    },
    {
      key: 'base', roman: 'VI', name: 'サイト基礎力', latin: 'Ira — 憤怒の罪',
      items: [
        { label: 'スマホ対応', p: 0.8 },
        { label: 'Core Web Vitals', p: 0.4 },
        { label: '画像最適化', p: 0.45 }
      ],
      comments: {
        pass: '快適な閲覧体験を提供できています。速さは最大のおもてなしです。',
        warn: '表示速度に課題があります。遅さのストレスは静かに訪問者を怒らせています。',
        fail: '遅さとストレスが訪問者の怒りを爆発させています。二度と戻らない前に改善が必要です。'
      }
    },
    {
      key: 'pdca', roman: 'VII', name: 'サイトPDCA改善力', latin: 'Luxuria — 色欲の罪',
      items: [
        { label: 'GA4導入', p: 0.55 },
        { label: 'GTM導入', p: 0.4 },
        { label: '計測阻害なし', p: 0.6 }
      ],
      comments: {
        pass: 'データに基づく改善体制が整っています。PDCAこそ成果への最短距離です。',
        warn: '計測体制が不完全です。感覚頼みの運用では、改善は再現できません。',
        fail: '美しさに陶酔し、データに基づく改善が放棄されています。まず現状を測ることから始めましょう。'
      }
    }
  ];

  /* -----------------------------------------------------------
     アンケート用 業種データ（大分類 → 小分類）
  ----------------------------------------------------------- */
  var INDUSTRIES = {
    '建設・不動産': ['工務店・建築', 'リフォーム', '不動産売買・仲介', '賃貸管理', '土木・造成'],
    '製造・工業': ['金属・機械加工', '食品製造', '印刷', '電子・電気', 'その他製造'],
    '医療・福祉': ['クリニック', '歯科', '整骨院・鍼灸', '介護・福祉施設', '調剤薬局'],
    '美容・健康': ['美容室', 'エステ・脱毛', 'ネイル・アイラッシュ', 'フィットネス'],
    '飲食・食品': ['レストラン・食堂', 'カフェ', '居酒屋・バー', 'テイクアウト・通販'],
    '小売・EC': ['店舗小売', 'ECサイト', '卸売'],
    '士業・コンサルティング': ['税理士・会計士', '弁護士・司法書士', '社労士・行政書士', '経営コンサルティング'],
    '教育・スクール': ['学習塾・予備校', '習い事教室', '資格スクール', '幼児教育'],
    'IT・WEB': ['ソフトウェア開発', 'WEB制作', 'ITサービス・SaaS'],
    '生活サービス': ['冠婚葬祭', '清掃・ハウスクリーニング', '修理・メンテナンス', '旅行・宿泊'],
    '運送・自動車': ['運送・物流', '自動車販売・整備', 'タクシー・バス'],
    'その他': ['その他']
  };

  /* -----------------------------------------------------------
     状態
  ----------------------------------------------------------- */
  var state = {
    url: '',
    results: null,        // [{category, items:[{label,pass}], passCount, judge}]
    running: false,
    diagnosisDone: false, // 全カテゴリの判定が完了したか
    surveyAnswered: false,
    finished: false       // 結果表示済みか
  };

  var el = {}; // DOM参照（init で取得）

  /* -----------------------------------------------------------
     ユーティリティ
  ----------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* URL文字列 → 32bitシード（同じURLなら同じ診断結果になる） */
  function hashSeed(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  /* mulberry32: シード付き擬似乱数 */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isValidUrl(value) {
    try {
      var u = new URL(value);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.indexOf('.') > 0;
    } catch (e) {
      return false;
    }
  }

  /* GA4イベント送信（タグ未設置の開発環境では何もしない） */
  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  /* 簡易レート制限（本番はサーバー側でIP判定。デモは localStorage で再現） */
  function checkRateLimit() {
    if (/[?&]nolimit=1/.test(location.search)) return true;
    try {
      var now = Date.now();
      var log = JSON.parse(localStorage.getItem('sevenSinsLog') || '[]')
        .filter(function (t) { return now - t < RATE_LIMIT.windowMs; });
      if (log.length >= RATE_LIMIT.max) return false;
      log.push(now);
      localStorage.setItem('sevenSinsLog', JSON.stringify(log));
      return true;
    } catch (e) {
      return true;
    }
  }

  /* -----------------------------------------------------------
     画面切替
  ----------------------------------------------------------- */
  var STEP_IDS = ['step-entry', 'step-error', 'step-block', 'step-maintenance', 'step-diagnosis'];

  function showStep(id) {
    STEP_IDS.forEach(function (sid) {
      var section = $(sid);
      if (section) section.hidden = (sid !== id);
    });
    var target = $(id);
    if (target && id !== 'step-entry') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function resetAll() {
    state.url = '';
    state.results = null;
    state.running = false;
    state.diagnosisDone = false;
    state.surveyAnswered = false;
    state.finished = false;

    if (el.reportContainer) el.reportContainer.innerHTML = '';
    if (el.finalActions) el.finalActions.classList.add('-w-is-locked');
    if (el.downloadBtn) el.downloadBtn.disabled = true;
    if (el.dlNote) el.dlNote.hidden = true;
    if (el.surveyOverlay) el.surveyOverlay.hidden = true;
    if (el.surveyForm) { el.surveyForm.reset(); el.surveyForm.hidden = false; }
    if (el.surveyThanks) el.surveyThanks.hidden = true;
    if (el.surveyStop) el.surveyStop.hidden = true;
    document.body.classList.remove('-w-modal-open');

    showStep('step-entry');
    if (el.input) el.input.focus();
  }

  /* -----------------------------------------------------------
     進捗サークル描画
  ----------------------------------------------------------- */
  var RING_R = 32;
  var RING_C = 2 * Math.PI * RING_R; // ≒ 201.06

  function renderCircles() {
    el.circles.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      var item = document.createElement('div');
      item.className = '-w-progress-item -w-state-pending';
      item.setAttribute('role', 'listitem');
      item.id = 'progress-cat-' + cat.key;
      item.innerHTML =
        '<div class="-w-progress-ring">' +
          '<svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">' +
            '<circle class="-w-progress-ring-track" cx="36" cy="36" r="' + RING_R + '" stroke-width="4" fill="none"></circle>' +
            '<circle class="-w-progress-ring-bar" cx="36" cy="36" r="' + RING_R + '" stroke-width="4" fill="none" ' +
              'stroke-dasharray="' + RING_C + '" stroke-dashoffset="' + RING_C + '"></circle>' +
          '</svg>' +
          '<span class="-w-progress-roman" aria-hidden="true">' + cat.roman + '</span>' +
          '<span class="-w-progress-mark" hidden></span>' +
        '</div>' +
        '<span class="-w-progress-name">' + cat.name + '</span>';
      el.circles.appendChild(item);
    });
  }

  function setRing(catKey, ratio) {
    var item = $('progress-cat-' + catKey);
    if (!item) return;
    var bar = item.querySelector('.-w-progress-ring-bar');
    if (bar) bar.setAttribute('stroke-dashoffset', String(RING_C * (1 - ratio)));
  }

  function setCircleState(catKey, stateName, judge) {
    var item = $('progress-cat-' + catKey);
    if (!item) return;
    item.classList.remove('-w-state-pending', '-w-state-running', '-w-state-pass', '-w-state-warn', '-w-state-fail');
    item.classList.add('-w-state-' + stateName);

    if (judge) {
      var roman = item.querySelector('.-w-progress-roman');
      var mark = item.querySelector('.-w-progress-mark');
      var iconId = judge === 'pass' ? 'i-check' : (judge === 'warn' ? 'i-exclaim' : 'i-close');
      if (roman) roman.hidden = true;
      if (mark) {
        mark.innerHTML = '<svg class="-w-icon" aria-hidden="true"><use href="#' + iconId + '"></use></svg>';
        mark.hidden = false;
      }
    }
  }

  /* -----------------------------------------------------------
     診断の実行
  ----------------------------------------------------------- */
  function _startDiagnosis(trigger) {
    if (state.running) return;

    var value = (el.input.value || '').trim();
    if (!isValidUrl(value)) {
      el.input.classList.add('-w-invalid');
      el.entryError.hidden = false;
      el.input.focus();
      setTimeout(function () { el.input.classList.remove('-w-invalid'); }, 400);
      return;
    }
    el.entryError.hidden = true;

    if (MAINTENANCE) { showStep('step-maintenance'); return; }
    if (!checkRateLimit()) { showStep('step-block'); track('seven_sins_blocked'); return; }

    state.url = value;
    state.running = true;
    state.diagnosisDone = false;
    state.surveyAnswered = false;
    state.finished = false;

    track('seven_sins_start', { target_url: value });

    $('progress-target-url').textContent = value;
    renderCircles();
    showStep('step-diagnosis');

    // アンケートモーダルを表示
    el.surveyOverlay.hidden = false;
    document.body.classList.add('-w-modal-open');
    var firstInput = el.surveyForm.querySelector('input');
    if (firstInput) firstInput.focus();

    runDiagnosis(value)
      .then(function (results) {
        state.results = results;
        state.diagnosisDone = true;
        state.running = false;
        el.status.textContent = '全カテゴリの審判が終了しました。';
        // アンケート未回答なら「回答せず結果を見る」を出す。回答済みなら即結果へ
        if (state.surveyAnswered) {
          finishDiagnosis();
        } else if (el.surveyStop) {
          el.surveyStop.hidden = false;
        }
      })
      .catch(function (err) {
        state.running = false;
        el.surveyOverlay.hidden = true;
        document.body.classList.remove('-w-modal-open');
        if (window.console && console.error) console.error('diagnosis failed:', err);
        showStep('step-error');
      });
  }

  /* 診断本体: API があれば fetch、なければシミュレーション */
  function runDiagnosis(url) {
    if (DIAGNOSIS_API) {
      return fetch(DIAGNOSIS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      })
        .then(function (res) {
          if (res.status === 429) { showStep('step-block'); throw new Error('rate limited'); }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) { return animateResults(data.results); });
    }
    // デモ: シードから結果を先に決め、カテゴリ順に演出する
    return animateResults(simulateResults(url));
  }

  function simulateResults(url) {
    var rand = mulberry32(hashSeed(url.replace(/\/+$/, '').toLowerCase()));
    return CATEGORIES.map(function (cat) {
      var items = cat.items.map(function (def) {
        return { label: def.label, pass: rand() < def.p };
      });
      var passCount = items.filter(function (i) { return i.pass; }).length;
      return {
        key: cat.key,
        items: items,
        passCount: passCount,
        judge: passCount === 3 ? 'pass' : (passCount === 2 ? 'warn' : 'fail')
      };
    });
  }

  /* カテゴリ順に進捗リングと判定を演出 */
  function animateResults(results) {
    var chain = Promise.resolve();
    results.forEach(function (result, idx) {
      var cat = CATEGORIES[idx];
      chain = chain.then(function () {
        setCircleState(cat.key, 'running');
        el.status.textContent = cat.roman + '. ' + cat.name + ' を審判中…';
        var steps = [0.33, 0.66, 1];
        var per = CATEGORY_MS / steps.length;
        var sub = Promise.resolve();
        steps.forEach(function (ratio) {
          sub = sub.then(function () {
            return delay(per).then(function () { setRing(cat.key, ratio); });
          });
        });
        return sub.then(function () {
          setCircleState(cat.key, result.judge, result.judge);
        });
      });
    });
    return chain.then(function () { return results; });
  }

  /* -----------------------------------------------------------
     アンケート
  ----------------------------------------------------------- */
  function populateIndustries() {
    var select = $('industry-select');
    if (!select) return;
    Object.keys(INDUSTRIES).forEach(function (major) {
      var opt = document.createElement('option');
      opt.value = major;
      opt.textContent = major;
      select.appendChild(opt);
    });
  }

  function _industrySurvey() {
    var major = $('industry-select').value;
    var sub = $('industry-select2');
    sub.innerHTML = '<option value="">-</option>';
    (INDUSTRIES[major] || []).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sub.appendChild(opt);
    });
  }

  function _submitSurvey(event) {
    if (event) event.preventDefault();
    var data = new FormData(el.surveyForm);
    var payload = {
      trigger: data.get('trigger'),
      goals: data.getAll('goal[]'),
      industry2: data.get('industry2'),
      industry3: data.get('industry3'),
      url: state.url
    };
    // 本番はCMSのアンケートAPIへPOST。デモはローカル保存のみ
    try { localStorage.setItem('sevenSinsSurvey', JSON.stringify(payload)); } catch (e) { /* 保存不可でも続行 */ }
    track('seven_sins_survey', payload);

    state.surveyAnswered = true;
    el.surveyForm.hidden = true;
    el.surveyThanks.hidden = false;

    // 診断が既に終わっていれば少し間を置いて結果表示
    if (state.diagnosisDone) {
      delay(900).then(finishDiagnosis);
    }
  }

  /* -----------------------------------------------------------
     結果表示（成績表）
  ----------------------------------------------------------- */
  function finishDiagnosis() {
    if (state.finished || !state.diagnosisDone) return;
    state.finished = true;

    el.surveyOverlay.hidden = true;
    document.body.classList.remove('-w-modal-open');

    buildReport();
    el.finalActions.classList.remove('-w-is-locked');
    el.downloadBtn.disabled = false;
    el.dlNote.hidden = false;

    track('seven_sins_complete', { target_url: state.url });
    el.reportContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function overallGrade() {
    var fails = state.results.filter(function (r) { return r.judge === 'fail'; }).length;
    var warns = state.results.filter(function (r) { return r.judge === 'warn'; }).length;
    if (fails === 0 && warns <= 1) return { label: '優良', cls: '-w-grade-excellent' };
    if (fails <= 1) return { label: '要注意', cls: '-w-grade-caution' };
    if (fails <= 3) return { label: '改善必要', cls: '-w-grade-improve' };
    return { label: '危険', cls: '-w-grade-danger' };
  }

  /* 7角形レーダーチャート（SVG生成・スコアは各カテゴリ 0〜3） */
  function buildRadarSvg() {
    var size = 320;
    var cx = size / 2;
    var cy = size / 2 + 6;
    var radius = 108;

    function point(index, ratio) {
      var angle = -Math.PI / 2 + (2 * Math.PI * index) / 7;
      return [
        (cx + Math.cos(angle) * radius * ratio).toFixed(1),
        (cy + Math.sin(angle) * radius * ratio).toFixed(1)
      ];
    }

    function polygon(ratio) {
      var pts = [];
      for (var i = 0; i < 7; i++) pts.push(point(i, ratio).join(','));
      return pts.join(' ');
    }

    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="カテゴリ別スコアのレーダーチャート">';
    [1, 2 / 3, 1 / 3].forEach(function (ratio) {
      svg += '<polygon class="-w-radar-grid" points="' + polygon(ratio) + '"></polygon>';
    });
    for (var i = 0; i < 7; i++) {
      var outer = point(i, 1);
      svg += '<line class="-w-radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + outer[0] + '" y2="' + outer[1] + '"></line>';
    }
    var scorePts = state.results.map(function (r, i) {
      return point(i, Math.max(r.passCount, 0.15) / 3).join(',');
    }).join(' ');
    svg += '<polygon class="-w-radar-shape" points="' + scorePts + '"></polygon>';
    CATEGORIES.forEach(function (cat, i) {
      var lp = point(i, 1.17);
      svg += '<text class="-w-radar-label" x="' + lp[0] + '" y="' + lp[1] + '" text-anchor="middle" dominant-baseline="middle">' + cat.roman + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  function buildReport() {
    var grade = overallGrade();
    var totalPass = state.results.reduce(function (sum, r) { return sum + r.passCount; }, 0);
    var now = new Date();
    var stamp = now.getFullYear() + '/' +
      String(now.getMonth() + 1).padStart(2, '0') + '/' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    var judgeLabel = { pass: '合格', warn: '要注意', fail: '要改善' };
    var judgeCls = { pass: '-w-judge-pass', warn: '-w-judge-warn', fail: '-w-judge-fail' };

    var rows = state.results.map(function (result, idx) {
      var cat = CATEGORIES[idx];
      var items = result.items.map(function (item) {
        return '<span class="-w-report-item ' + (item.pass ? '-w-item-pass' : '-w-item-fail') + '">' +
          '<svg class="-w-icon" aria-hidden="true"><use href="#' + (item.pass ? 'i-check' : 'i-close') + '"></use></svg>' +
          item.label +
          '<span class="-w-visually-hidden">：' + (item.pass ? '合格' : '不合格') + '</span>' +
        '</span>';
      }).join('');

      return '<div class="-w-report-row">' +
        '<span class="-w-report-row-roman" aria-hidden="true">' + cat.roman + '</span>' +
        '<div class="-w-report-row-head">' +
          '<span class="-w-report-row-name">' + cat.name + '</span>' +
          '<span class="-w-report-row-latin">' + cat.latin + '</span>' +
          '<span class="-w-report-row-judge ' + judgeCls[result.judge] + '">' + judgeLabel[result.judge] +
            '（' + result.passCount + '/3）</span>' +
        '</div>' +
        '<div class="-w-report-row-items">' + items + '</div>' +
        '<p class="-w-report-row-comment">' + cat.comments[result.judge] + '</p>' +
      '</div>';
    }).join('');

    el.reportContainer.innerHTML =
      '<article class="-w-report-card" aria-label="新・七つの大罪 診断成績表">' +
        '<div class="-w-report-head">' +
          '<div>' +
            '<h2 class="-w-report-title"><span>新・七つの大罪</span> 診断成績表</h2>' +
            '<p class="-w-report-meta">診断URL：' + escapeHtml(state.url) + '<br>' +
              '診断日時：' + stamp + '　合格項目：' + totalPass + ' / 21</p>' +
          '</div>' +
          '<div class="-w-report-stamp ' + grade.cls + '" role="img" aria-label="総合判定：' + grade.label + '">' +
            '<span class="-w-report-stamp-label">総合判定</span>' +
            '<span class="-w-report-stamp-grade">' + grade.label + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="-w-report-radar">' + buildRadarSvg() + '</div>' +
        '<div class="-w-report-rows">' + rows + '</div>' +
        '<p class="-w-report-note">※本診断は公開情報に基づく簡易チェックです。詳細な原因分析と改善指南は「新・77\'s Check!!」をご利用ください。</p>' +
      '</article>';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* -----------------------------------------------------------
     PDF発行（成績表のみを印刷 → PDF保存）
  ----------------------------------------------------------- */
  function _pdfGenerate() {
    if (el.downloadBtn.disabled) return;
    track('seven_sins_pdf', { target_url: state.url });
    window.print();
  }

  /* -----------------------------------------------------------
     初期化
  ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    el.form = $('seven-entry-form');
    el.input = $('target-url');
    el.entryError = $('entry-error');
    el.circles = $('progress-circles');
    el.status = $('progress-status');
    el.surveyOverlay = $('survey-overlay');
    el.surveyForm = $('survey-form');
    el.surveyThanks = $('survey-thanks');
    el.surveyStop = $('survey-stop');
    el.finalActions = $('final-actions');
    el.reportContainer = $('seven-report-container');
    el.downloadBtn = $('download-btn');
    el.dlNote = $('dl-note');

    if (!el.form || !el.input) return; // このページに診断ツールがない場合は何もしない

    populateIndustries();

    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      _startDiagnosis(e.submitter);
    });
    el.input.addEventListener('input', function () { el.entryError.hidden = true; });

    el.surveyForm.addEventListener('submit', _submitSurvey);
    $('industry-select').addEventListener('change', _industrySurvey);
    el.surveyStop.addEventListener('click', finishDiagnosis);
    el.downloadBtn.addEventListener('click', _pdfGenerate);

    document.querySelectorAll('[data-seven-reset]').forEach(function (btn) {
      btn.addEventListener('click', resetAll);
    });
  });

  /* 本番JS互換のグローバル公開 */
  window._startDiagnosis = _startDiagnosis;
  window._submitSurvey = _submitSurvey;
  window._industrySurvey = _industrySurvey;
  window.finishDiagnosis = finishDiagnosis;
  window._pdfGenerate = _pdfGenerate;
})();
