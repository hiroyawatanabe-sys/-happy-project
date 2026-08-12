/* =============================================================
   共通JavaScript
   - スクロール連動（固定ヘッダー／フロート要素／スクロールアニメーション）
     ※ 03c 共通JS仕様の実装。各ウィジェットはクラスと data 属性の付与のみで動作する
   - ヘッダーUI（ハンバーガー／サブメニュー／検索）
   - AI要約・精査ウィジェットの開閉
   - BudouX による見出しの改行最適化（読み込めない環境では無効化）
============================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     1. 固定ヘッダー（.-w-header-scroll + data-vh / data-px）
  ----------------------------------------------------------- */
  function initHeaderScroll() {
    var header = document.querySelector('.-w-header-scroll');
    if (!header) return;

    var fixed = false;

    function threshold() {
      if (header.dataset.px) return parseFloat(header.dataset.px) || 0;
      var vh = parseFloat(header.dataset.vh);
      return isNaN(vh) ? 100 : window.innerHeight * (vh / 100);
    }

    function onScroll() {
      var over = window.scrollY > threshold();
      if (over === fixed) return;
      fixed = over;
      if (fixed) {
        header.classList.add('-w-header-fixed');
        document.body.classList.add('-w-header-fixed-margin');
        // 固定分の余白補填：実高さを CSS 変数へ
        document.body.style.setProperty('--w-header-offset', header.offsetHeight + 'px');
      } else {
        header.classList.remove('-w-header-fixed');
        document.body.classList.remove('-w-header-fixed-margin');
        document.body.style.removeProperty('--w-header-offset');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  /* -----------------------------------------------------------
     2. フロート要素（.-w-float-event + data-vh / data-px）
  ----------------------------------------------------------- */
  function initFloatEvents() {
    var floats = document.querySelectorAll('.-w-float-event');
    if (!floats.length) return;

    function onScroll() {
      floats.forEach(function (el) {
        var t = el.dataset.px
          ? parseFloat(el.dataset.px) || 0
          : window.innerHeight * ((parseFloat(el.dataset.vh) || 100) / 100);
        el.classList.toggle('-w-floating', window.scrollY > t);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -----------------------------------------------------------
     3. スクロールアニメーション（.-w-scroll-animation）
        単発: -w-scroll-active（一度付与したら外さない）
        繰返: -w-scroll-re-active（ビューポート在中のみ）
  ----------------------------------------------------------- */
  function initScrollAnimation() {
    var targets = document.querySelectorAll('.-w-scroll-animation');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('-w-scroll-active'); });
      return;
    }

    targets.forEach(function (el) {
      // data-animation-timing: 0〜100（大きいほどビューポート上部で発火）
      var timing = parseFloat(el.dataset.animationTiming) || 15;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('-w-scroll-active', '-w-scroll-re-active');
          } else {
            entry.target.classList.remove('-w-scroll-re-active');
          }
        });
      }, { rootMargin: '0px 0px -' + timing + '% 0px' });
      observer.observe(el);
    });
  }

  /* -----------------------------------------------------------
     4. スクロール中フラグ（.-w-scroll-event → .-w-scrolling）
  ----------------------------------------------------------- */
  function initScrollingFlag() {
    var targets = document.querySelectorAll('.-w-scroll-event');
    if (!targets.length) return;
    var timer = null;
    window.addEventListener('scroll', function () {
      targets.forEach(function (el) { el.classList.add('-w-scrolling'); });
      clearTimeout(timer);
      timer = setTimeout(function () {
        targets.forEach(function (el) { el.classList.remove('-w-scrolling'); });
      }, 100);
    }, { passive: true });
  }

  /* -----------------------------------------------------------
     5. ハンバーガーメニュー（SPドロワー）
  ----------------------------------------------------------- */
  function initMenuToggle() {
    var toggle = document.querySelector('.-w-menu-toggle');
    var nav = document.getElementById('-w-global-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      document.body.classList.toggle('-w-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    }

    toggle.addEventListener('click', function () {
      setOpen(!document.body.classList.contains('-w-menu-open'));
    });

    // Escで閉じる
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('-w-menu-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // ドロワー内リンクへ遷移したら閉じる
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
  }

  /* -----------------------------------------------------------
     6. サブメニュー開閉（SPアコーディオン）
  ----------------------------------------------------------- */
  function initNavSubmenus() {
    document.querySelectorAll('.-w-nav-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.-w-nav-item');
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        if (item) item.classList.toggle('-w-open', !open);
      });
    });
  }

  /* -----------------------------------------------------------
     7. サイト内検索
        本番は Google CSE。スタンドアロン版は Google の site: 検索で代替
  ----------------------------------------------------------- */
  function initSearch() {
    var toggle = document.querySelector('.-w-search-toggle');
    var box = document.getElementById('-w-search-box');
    if (!toggle || !box) return;

    toggle.addEventListener('click', function () {
      var open = !box.hidden;
      box.hidden = open;
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'サイト内検索を開く' : 'サイト内検索を閉じる');
      if (!open) {
        var input = box.querySelector('.-w-search-input');
        if (input) input.focus();
      }
    });

    var form = box.querySelector('.-w-search-form');
    if (form) {
      form.addEventListener('submit', function () {
        var input = form.querySelector('.-w-search-input');
        if (input && input.value.indexOf('site:') !== 0) {
          input.value = 'site:guardian.jpn.com ' + input.value;
        }
      });
    }
  }

  /* -----------------------------------------------------------
     8. AI要約・精査ウィジェット
  ----------------------------------------------------------- */
  function initAiAssist() {
    var root = document.querySelector('.-w-ai-assist');
    if (!root) return;

    var begin = root.querySelector('.-w-ai-begin');
    var command = document.getElementById('-w-ai-command');
    var lastFocus = null;

    if (begin && command) {
      begin.addEventListener('click', function () {
        var open = !command.hidden;
        command.hidden = open;
        begin.setAttribute('aria-expanded', String(!open));
      });
      var closeBtn = command.querySelector('.-w-ai-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          command.hidden = true;
          begin.setAttribute('aria-expanded', 'false');
          begin.focus();
        });
      }
    }

    function openDisplay(kind) {
      var panel = document.getElementById('-w-ai-display-' + kind);
      if (!panel) return;
      lastFocus = document.activeElement;
      panel.hidden = false;
      document.body.classList.add('-w-modal-open');
      var close = panel.querySelector('.-w-ai-close-display');
      if (close) close.focus();
    }

    function closeDisplay(panel) {
      panel.hidden = true;
      document.body.classList.remove('-w-modal-open');
      if (lastFocus) lastFocus.focus();
    }

    root.querySelectorAll('[data-ai-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { openDisplay(btn.dataset.aiOpen); });
    });

    root.querySelectorAll('.-w-ai-display').forEach(function (panel) {
      panel.querySelectorAll('[data-ai-close], .-w-ai-close-display').forEach(function (btn) {
        btn.addEventListener('click', function () { closeDisplay(panel); });
      });
      // 背景クリックで閉じる
      panel.addEventListener('click', function (e) {
        if (e.target === panel) closeDisplay(panel);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      root.querySelectorAll('.-w-ai-display').forEach(function (panel) {
        if (!panel.hidden) closeDisplay(panel);
      });
    });

    // プロンプト表示切替
    root.querySelectorAll('.-w-ai-show-prompt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.dataset.promptTarget);
        if (target) target.hidden = !target.hidden;
      });
    });
  }

  /* -----------------------------------------------------------
     9. BudouX（見出しの日本語改行最適化・読み込めない環境では無効）
  ----------------------------------------------------------- */
  function initBudoux() {
    try {
      import('https://unpkg.com/budoux@0.6.4/module/index.js')
        .then(function (mod) {
          var parser = mod.loadDefaultJapaneseParser();
          document
            .querySelectorAll('h2, h3, .-w-entry-lead, .-w-report-row-name')
            .forEach(function (el) { parser.applyToElement(el); });
        })
        .catch(function () { /* オフライン環境等では何もしない */ });
    } catch (e) { /* dynamic import 非対応環境では何もしない */ }
  }

  /* -----------------------------------------------------------
     初期化
  ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initFloatEvents();
    initScrollAnimation();
    initScrollingFlag();
    initMenuToggle();
    initNavSubmenus();
    initSearch();
    initAiAssist();
    initBudoux();
  });
})();
