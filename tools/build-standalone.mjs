#!/usr/bin/env node
/* =============================================================
   単一HTMLファイルの書き出し

   使い方:  node tools/build-standalone.mjs
   出力:    dist/cta-lp.html

   cta-lp/index.html を基に、CSS・JS・画像をすべて埋め込んだ
   1ファイルのHTMLを作る。サーバーに置かなくてもダブルクリックで
   開けるため、確認・共有・LINEでの送付前チェックに使える。

   ※Googleフォントの読み込みだけは残す（オフラインでも
     フォールバックのフォントスタックで崩れないことを確認済み）
============================================================= */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname } from 'node:path';

const SRC = 'cta-lp/index.html';
const OUT = 'dist/cta-lp.html';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
               '.webp': 'image/webp', '.svg': 'image/svg+xml' };

let html = readFileSync(SRC, 'utf8');

/* CSS を <style> へ */
html = html.replace(
  /<link rel="stylesheet" href="css\/([^"]+)">/g,
  (_, f) => `<style>\n${readFileSync(`cta-lp/css/${f}`, 'utf8')}\n</style>`
);

/* JS を <script> へ（$& 等の置換記号を無効化するため関数で渡す） */
html = html.replace(
  /<script src="js\/([^"]+)"[^>]*><\/script>/g,
  (_, f) => `<script>\n${readFileSync(`cta-lp/js/${f}`, 'utf8')}\n</script>`
);

/* 画像を data URI へ */
const assets = new Set([...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]));
for (const rel of assets) {
  const ext = extname(rel).toLowerCase();
  if (!MIME[ext]) continue;                       // 動画などは埋め込まない
  let buf;
  try { buf = readFileSync(`cta-lp/${rel}`); } catch { continue; }  // 未配置は素通し
  html = html.replaceAll(`"${rel}"`, `"data:${MIME[ext]};base64,${buf.toString('base64')}"`);
}

mkdirSync('dist', { recursive: true });
writeFileSync(OUT, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
const left = [...html.matchAll(/(?:src|href)="(?!#|data:|https:)([^"]+)"/g)].map((m) => m[1]);

console.log(`\n書き出し: ${OUT}  (${kb} KB)`);
console.log(`  埋め込んだ画像: ${[...assets].filter((a) => MIME[extname(a).toLowerCase()]).length} 件`);
console.log(`  残った相対参照: ${left.length ? left.join(', ') : 'なし'}`);
