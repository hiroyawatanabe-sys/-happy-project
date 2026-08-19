#!/usr/bin/env node
/* =============================================================
   CTA文字数規格 機械検査（GBlueprint50 工程34 R5「視認性規格の機械的検査」）

   使い方:  node tools/cta-char-audit.mjs [対象HTML]
   既定の対象: cta-lp/index.html
   終了コード: 0=全合格 / 1=不合格あり（CIで落とせる）

   数え方: 全角・半角・記号・スペース すべて1文字

   【規格表】
     ボタン本体        合格 4〜13字 ／ 最適帯 6〜10字［理想8字］
                       絶対条件: スマホ表示で折り返さないこと
     便益サブテキスト  12〜18字・1行（省略可）
     マイクロコピー    15〜22字・1行（2行化の禁止）
     フォーム送信      ボタン本体規格に準ずる（13字以内）
     禁止語            送信 / クリック / こちら / 詳しくは
                       （行動内容が不明な語をボタン本体に使わない）

   ※折り返しの有無はDOM計測が必要なため、本スクリプトは字数と禁止語のみを検査する。
     折り返しは cta-lp/README または Playwright での実機確認で担保すること。
============================================================= */

import { readFileSync } from 'node:fs';

const FILE = process.argv[2] ?? 'cta-lp/index.html';
const BANNED = ['送信', 'クリック', 'こちら', '詳しくは'];

const SPEC = {
  button:  { pass: [4, 13], optimal: [6, 10], ideal: 8, label: '①行動文言（ボタン本体）' },
  benefit: { pass: [12, 18], label: '②便益サブテキスト' },
  micro:   { pass: [15, 22], label: '③マイクロコピー' },
};

const html = readFileSync(FILE, 'utf8');

/** タグを除いた素のテキストにする（規格の数え方に合わせ、空白は畳んで前後を落とす） */
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();

/** class 名でspan/pを拾う */
const pick = (cls) =>
  [...html.matchAll(new RegExp(`<(?:span|p)[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</(?:span|p)>`, 'g'))]
    .map((m) => strip(m[1]));

const groups = [
  { key: 'button',  items: pick('-w-cta-main') },
  { key: 'benefit', items: pick('-w-cta-benefit') },
  { key: 'micro',   items: pick('-w-cta-micro') },
];

let ng = 0;
let warn = 0;

console.log(`\nCTA文字数規格 機械検査  ─  ${FILE}`);
console.log('='.repeat(72));

for (const { key, items } of groups) {
  const spec = SPEC[key];
  console.log(`\n${spec.label}  規格 ${spec.pass[0]}〜${spec.pass[1]}字` +
    (spec.optimal ? `（最適帯 ${spec.optimal[0]}〜${spec.optimal[1]}字・理想${spec.ideal}字）` : ''));

  if (items.length === 0) {
    console.log('  該当なし');
    continue;
  }

  for (const t of items) {
    const c = [...t].length;                       // サロゲートペアも1文字として数える
    const inPass = c >= spec.pass[0] && c <= spec.pass[1];
    const inOpt = spec.optimal ? c >= spec.optimal[0] && c <= spec.optimal[1] : true;

    let mark, note;
    if (!inPass) { mark = 'NG '; note = `合格範囲${spec.pass[0]}〜${spec.pass[1]}字の外`; ng++; }
    else if (!inOpt) { mark = '△  '; note = '帯外（理由記録が必要）'; warn++; }
    else { mark = 'OK '; note = ''; }

    console.log(`  ${mark}${String(c).padStart(2)}字  「${t}」${note ? '  ← ' + note : ''}`);

    if (key === 'button') {
      const hit = BANNED.filter((w) => t.includes(w));
      if (hit.length) { console.log(`      NG 禁止語: ${hit.join(' / ')}`); ng++; }
    }
  }
}

/* 幹の統一検査（R2）：同一行動が別名で呼ばれていないか */
const trunks = [...new Set(pick('-w-cta-main'))];
console.log('\n幹の統一（R2）');
if (trunks.length === 1) {
  console.log(`  OK  全配置が同一：「${trunks[0]}」（${[...trunks[0]].length}字）`);
} else {
  console.log(`  NG  ${trunks.length}種の文言が混在：${trunks.map((t) => `「${t}」`).join(' / ')}`);
  ng++;
}

/* 三点セットの充足（R3）：ボタン単体の配置がないか */
console.log('\n三点セットの充足（R3）');
const nBtn = pick('-w-cta-main').length;
const nBen = pick('-w-cta-benefit').length;
const nMic = pick('-w-cta-micro').length;
console.log(`  ボタン ${nBtn}／便益 ${nBen}／マイクロ ${nMic}`);
if (nBen < nBtn) {
  console.log(`  NG  便益サブのない配置が ${nBtn - nBen} 件（ボタン単体の放置）`);
  ng++;
} else {
  console.log('  OK  ボタン単体の配置なし');
}
if (nMic < nBtn) {
  console.log(`  △   マイクロコピーのない配置が ${nBtn - nMic} 件 ← 理由記録が必要（docs/cta-lp-copy.md §2）`);
  warn++;
}

console.log('\n' + '='.repeat(72));
console.log(ng === 0 ? `結果: PASS（不合格0件／要理由記録 ${warn}件）` : `結果: FAIL（不合格 ${ng}件／要理由記録 ${warn}件）`);
process.exit(ng === 0 ? 0 : 1);
