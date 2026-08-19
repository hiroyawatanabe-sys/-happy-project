/* =============================================================
   CTA全面刷新 クロージングLP スクリプト

   原稿SSOT : docs/cta-lp-copy.md（コピーを変えるときは必ず原稿を先に直す）
   守備範囲 : S6 比較検討 → S7 決定

   担当する機能
     1. セグメント出し分け（?s=lec|scsc|cue）… tosen/js/tosen-cta.js の ?from= 方式を踏襲
     2. 申込期限のカウントダウン（②希少性。在庫・枠数の演出は行わない）
     3. 動画の開閉（セグメントで初期状態が変わる）
     4. 追従CTA（モバイル・スクロール25%以降）
     5. スクロール表示アニメーション
     6. 申込フォーム（その場エラー表示・支払い方法2択）
     7. 4段階効果測定（接触 → 品質 → 中間 → 事業）
============================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     定数
  ----------------------------------------------------------- */

  /* 申込期間（提案書p16）。日付を変えるときは docs/cta-lp-copy.md も直すこと */
  var CAMPAIGN_START = '2026-08-24';
  var CAMPAIGN_END = '2026-09-07';

  /* ▼ 本番差し替え：フォーム送信先。
     null の間は送信せず完了画面のみ表示する（実装確認用） */
  var FORM_ENDPOINT = null;

  /* セグメント別の第一声（原稿 §1 と一字一句そろえること）
     見出し＝痛み（自分ごと化）、サブ＝損失 → ベネフィット → オファー の順。
     事実提示（約175箇所）だけで終わらせない。人は得より損に2倍反応する。 */
  /* SP は文節ごとに改行する（-w-br-sp は768px以上で display:none）。
     日本語は語中で折り返すと読みにくく、見出しの強度が落ちる */
  var PAIN = 'アクセスはある。<br class="-w-br-sp">デザインも悪くない。<br>' +
             'それなのに、<br class="-w-br-sp"><span class="-w-hl">問い合わせが来ない</span>。';
  var LOSS = '閲覧者は迷って、そのまま帰っています。';

  var SEGMENTS = {
    lec: {
      /* 受講者のみ、痛みより⑥一貫性（あのとき納得した自分との整合）を優先する */
      head: '先日の第9回でお話しした<br class="-w-br-sp">「死んだCTA」。<br>御社サイトの、<span class="-w-hl">約175箇所</span>の話です。',
      sub: 'あの90分でご覧いただいた型を、御社のサイトへ丸ごと実装します。閲覧者を迷わせない文言へ、35ページ分すべてを。9月7日まで、<strong>39,750円（税別）</strong>。',
      video: 'closed',  // 90分受講済みのため既定で折りたたむ
      pay: 'scsc'       // ※受講2名がSCSC顧客かCUE顧客かは要確認（原稿 §8）
    },
    scsc: {
      head: PAIN,
      sub: '原因は、御社サイトの<strong>約175箇所のボタン</strong>が「詳しく見る」のままだからです。' + LOSS +
           '弊社へ都度ご依頼いただくと約292,000円相当。9月7日まで、<strong>39,750円（税別）</strong>で一括代行します。',
      video: 'closed',  // 月次MTGで人が説明するため補助扱い
      pay: 'scsc'
    },
    cue: {
      head: PAIN,
      sub: '原因は、御社サイトの<strong>約175箇所のボタン</strong>が「詳しく見る」のままだからです。' + LOSS +
           '修正チケット換算で約58枚分。9月7日まで、<strong>39,750円（税別）</strong>で一括代行します。',
      video: 'open',    // 対人接点が構造的に無いため、動画が唯一の説明者
      pay: 'cue'
    },
    'default': {
      head: PAIN,
      sub: '原因は、サイトの<strong>約175箇所のボタン</strong>が「詳しく見る」のままだからです。' + LOSS +
           '9月7日まで、35ページ分すべてを<strong>39,750円（税別）</strong>で書き換えます。',
      video: 'closed',
      pay: 'scsc'
    }
  };

  /* 支払い方法2択（原稿 §3 B10）。デフォルト選択は置かない */
  var PAY_SETS = {
    scsc: [
      {
        value: 'lump',
        title: '① 一括でお支払い',
        amount: '39,750円（税別）',
        rows: [
          ['初期費用', '39,750円（税別）'],
          ['月額の変化', 'なし'],
          ['向いている方', '今回だけ依頼したい']
        ],
        caution: 'お手続き期限：9月7日(月)まで'
      },
      {
        value: 'planup',
        title: '② プランアップでお支払い',
        amount: '初期費用 0円',
        rows: [
          ['初期費用', '0円'],
          ['月額の変化', '+30,000円（SCSC6.2へ）'],
          ['追加される役務', '毎月のHP解析詳細レポート／3ヶ月毎の改善支援／3ヶ月毎のプチリニューアル'],
          ['向いている方', '継続的に改善していきたい']
        ],
        caution: 'プラン変更は毎月25日締め。8月25日(火)までのお申込みで9月1日から、以降は10月1日からの適用となります。'
      }
    ],
    cue: [
      {
        value: 'card',
        title: '① クレジットカード',
        amount: '39,750円（税別）',
        rows: [
          ['金額', '39,750円（税別）'],
          ['お手続き', 'お申込み後、担当よりお支払い用URLをご案内します']
        ],
        caution: ''
      },
      {
        value: 'bank',
        title: '② 銀行振込',
        amount: '39,750円（税別）',
        rows: [
          ['金額', '39,750円（税別）'],
          ['お手続き', 'お申込み後、担当より請求書を発行します']
        ],
        caution: '請求書発行事務手数料 500円（税別）と振込手数料がご負担となります。'
      }
    ]
  };

  /* -----------------------------------------------------------
     ユーティリティ
  ----------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* GA4イベント（タグ未設置の環境では何もしない） */
  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 日付文字列（YYYY-MM-DD）をローカル0時のDateにする */
  function toDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  var state = {
    seg: 'default',
    formStarted: false,
    depthSent: {}
  };

  /* -----------------------------------------------------------
     1. セグメント出し分け（?s=lec|scsc|cue）
        第一声・動画の初期状態・支払い方法の3点のみを差し替える。
        本文（S6→S7）は全セグメント共通。
  ----------------------------------------------------------- */
  function initSegment() {
    var params = new URLSearchParams(location.search);
    var s = (params.get('s') || '').toLowerCase();
    state.seg = SEGMENTS[s] ? s : 'default';

    var conf = SEGMENTS[state.seg];
    var head = $('fv-head');
    var sub = $('fv-sub');
    if (head) head.innerHTML = conf.head;
    if (sub) sub.innerHTML = conf.sub;

    /* 支払い方法（?pay= で上書き可。受講者がCUE顧客だった場合の逃げ道） */
    var payKey = (params.get('pay') || '').toLowerCase();
    if (!PAY_SETS[payKey]) payKey = conf.pay;
    renderPayOptions(payKey);

    /* 方法Bの補足はSCSC顧客にのみ表示 */
    var tn = $('tertiary-note');
    if (tn && payKey === 'scsc') tn.hidden = false;

    document.documentElement.setAttribute('data-seg', state.seg);

    /* 【第1段階：接触】 */
    track('lp_view', { lp_segment: state.seg, lp_pay_set: payKey });
  }

  /* -----------------------------------------------------------
     2. 支払い方法2択の描画（デフォルト未選択）
  ----------------------------------------------------------- */
  function renderPayOptions(key) {
    var list = $('pay-list');
    if (!list) return;
    var set = PAY_SETS[key] || PAY_SETS.scsc;

    list.innerHTML = set.map(function (o) {
      var rows = o.rows.map(function (r) {
        return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
      }).join('');
      var caution = o.caution
        ? '<span class="-w-pay-caution">' +
          '<svg class="-w-icon" aria-hidden="true"><use href="#i-alert"></use></svg>' +
          esc(o.caution) + '</span>'
        : '';
      return '' +
        '<label class="-w-pay">' +
          '<input type="radio" name="pay" value="' + esc(o.value) + '" required>' +
          '<span class="-w-pay-inner">' +
            '<span class="-w-pay-ttl">' + esc(o.title) +
              '<span class="-w-pay-amount">' + esc(o.amount) + '</span>' +
            '</span>' +
            '<span class="-w-pay-desc"><dl>' + rows + '</dl>' + caution + '</span>' +
          '</span>' +
        '</label>';
    }).join('');
  }

  /* -----------------------------------------------------------
     3. 申込期限のカウントダウン（②希少性）
  ----------------------------------------------------------- */
  function initCountdown() {
    var el = $('lp-countdown');
    if (!el) return;

    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var start = toDate(CAMPAIGN_START);
    var end = toDate(CAMPAIGN_END);
    var day = 86400000;

    if (today < start) {
      el.textContent = Math.round((start - today) / day) + '日後に受付開始';
    } else if (today > end) {
      el.textContent = '受付終了';
    } else {
      /* 当日を含めた残り日数 */
      el.textContent = '残り' + (Math.round((end - today) / day) + 1) + '日';
    }
    el.hidden = false;
  }

  /* -----------------------------------------------------------
     4. 動画の開閉（セグメントで初期状態が変わる）
  ----------------------------------------------------------- */
  function initVideo() {
    var btn = $('video-toggle');
    var body = $('video-body');
    if (!btn || !body) return;

    function setOpen(open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.hidden = !open;
    }

    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      /* 【第2段階：品質】 */
      if (open) track('lp_video_open', { lp_segment: state.seg });
    });

    if (SEGMENTS[state.seg].video === 'open') {
      setOpen(true);
      track('lp_video_open', { lp_segment: state.seg, lp_auto: 1 });
    }
  }

  /* -----------------------------------------------------------
     5. 追従CTA（スクロール25%以降）
  ----------------------------------------------------------- */
  function initSticky() {
    var el = $('sticky-cta');
    if (!el) return;

    /* 追従CTAの出し入れは「画面にCTAが1つも無い状態を作らない」ための制御。
         - FVのCTAが画面外に出たら出す
         - 申込セクションが見えている間は隠す
           （押しても同じ場所へ飛ぶ空振りを防ぎ、フォームの視界も塞がない） */
    var fvOut = false;
    var applyVisible = false;

    function sync() {
      el.classList.toggle('-w-on', fvOut && !applyVisible);
    }

    if ('IntersectionObserver' in window) {
      var fvCta = document.querySelector('[data-cta="fv"]');
      if (fvCta) {
        new IntersectionObserver(function (entries) {
          fvOut = !entries[0].isIntersecting;
          sync();
        }, { threshold: 0 }).observe(fvCta);
      }
      var apply = $('apply');
      if (apply) {
        new IntersectionObserver(function (entries) {
          applyVisible = entries[0].isIntersecting;
          sync();
        }, { threshold: 0 }).observe(apply);
      }
    }

    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = h > 0 ? window.pageYOffset / h : 0;

      /* 【第2段階：品質】スクロール到達率 */
      [25, 50, 75, 100].forEach(function (p) {
        if (ratio * 100 >= p && !state.depthSent[p]) {
          state.depthSent[p] = true;
          track('lp_scroll_depth', { lp_segment: state.seg, lp_depth: p });
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -----------------------------------------------------------
     6. スクロール表示アニメーション
  ----------------------------------------------------------- */
  function initReveal() {
    var targets = $$('.-w-reveal');
    if (!targets.length) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('-w-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('-w-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    targets.forEach(function (t) { io.observe(t); });
  }

  /* -----------------------------------------------------------
     7. CTAクリックの計測（4箇所すべて同一文言・同一遷移先）
  ----------------------------------------------------------- */
  function initCtaTracking() {
    $$('[data-cta]').forEach(function (el) {
      if (el.tagName === 'BUTTON') return;   // フォーム送信ボタンは submit 側で計測
      el.addEventListener('click', function () {
        track('lp_cta_click', { lp_segment: state.seg, lp_placement: el.getAttribute('data-cta') });
      });
    });
  }

  /* -----------------------------------------------------------
     8. 申込フォーム
        教科書4-4：入力は必要最小限／必須・任意を明示／
        エラーはその場で表示／ボタン直下にマイクロコピー
  ----------------------------------------------------------- */
  function initForm() {
    var form = $('apply-form');
    var done = $('apply-done');
    if (!form) return;

    var fields = [
      { input: 'f-company', err: 'e-company', test: function (v) { return v.trim().length > 0; } },
      { input: 'f-name', err: 'e-name', test: function (v) { return v.trim().length > 0; } },
      { input: 'f-email', err: 'e-email', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); } }
    ];

    /* 【第3段階：中間】最初の入力でフォーム開始を計測 */
    form.addEventListener('focusin', function () {
      if (state.formStarted) return;
      state.formStarted = true;
      track('lp_form_start', { lp_segment: state.seg });
    });

    function showErr(f, on) {
      var input = $(f.input);
      var err = $(f.err);
      if (!input || !err) return;
      err.classList.toggle('-w-on', on);
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      if (on) input.setAttribute('aria-describedby', f.err);
      else input.removeAttribute('aria-describedby');
    }

    /* 入力を離れた時点でその場検証（教科書4-4） */
    fields.forEach(function (f) {
      var input = $(f.input);
      if (!input) return;
      input.addEventListener('blur', function () {
        if (input.value === '') return;      // 未入力のまま離れただけでは責めない
        showErr(f, !f.test(input.value));
      });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true' && f.test(input.value)) showErr(f, false);
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();

      var firstBad = null;
      fields.forEach(function (f) {
        var input = $(f.input);
        if (!input) return;
        var ok = f.test(input.value);
        showErr(f, !ok);
        if (!ok && !firstBad) firstBad = input;
      });

      var pay = form.querySelector('input[name="pay"]:checked');
      var payErr = $('e-pay');
      if (payErr) payErr.classList.toggle('-w-on', !pay);
      if (!pay && !firstBad) firstBad = form.querySelector('input[name="pay"]');

      if (firstBad) {
        firstBad.focus();
        firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
        track('lp_form_error', { lp_segment: state.seg });
        return;
      }

      var payload = {
        company: $('f-company').value.trim(),
        name: $('f-name').value.trim(),
        email: $('f-email').value.trim(),
        pay: pay.value,
        note: $('f-note') ? $('f-note').value.trim() : '',
        segment: state.seg,
        page: location.href
      };

      /* 【第4段階：事業】 */
      track('lp_apply', { lp_segment: state.seg, lp_pay: payload.pay });

      if (FORM_ENDPOINT) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) {
          if (!r.ok) throw new Error('bad response');
          complete();
        }).catch(function () {
          if (btn) btn.disabled = false;
          window.alert('送信に失敗しました。お手数ですが、時間をおいて再度お試しください。');
          track('lp_apply_failed', { lp_segment: state.seg });
        });
      } else {
        /* 送信先未設定：画面遷移の確認用に完了画面のみ表示 */
        complete();
      }

      function complete() {
        form.hidden = true;
        if (done) {
          done.hidden = false;
          done.focus();
          done.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
    });
  }

  /* -----------------------------------------------------------
     起動
  ----------------------------------------------------------- */
  function init() {
    initSegment();
    initCountdown();
    initVideo();
    initSticky();
    initReveal();
    initCtaTracking();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
