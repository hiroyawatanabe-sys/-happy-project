# 新・七つの大罪｜141億のデータが裁く無料WEBサイト診断

guardian.jpn.com `/new-seven-deadly-sins/` の再構築プロジェクト。
本リポジトリは Vanilla HTML / CSS / JavaScript のみで構成され、CMS（OWLet）への移植を前提とした `-w-` プレフィックスのパーツ構造で実装しています。

> **東宣（TOSEN）版**：`tosen/` ディレクトリに、診断エンジンを変えずに導線・見せ方・CTAを株式会社東宣仕様へ転換した独立ページを収録（下記「東宣版」参照）。

## 現在の構築範囲（フェーズ1）

「新・七つの大罪って何？まずは動画を見る」セクションより**上**の領域。

| ブロック | 内容 | 状態 |
|---|---|---|
| ヘッダー | サイトタイトル帯（h1）／ロゴ／CTAボタン5種／グローバルナビ（PCメガメニュー・SPドロワー）／サイト内検索 | ✅ |
| パンくず | schema.org BreadcrumbList 構造化データ付き | ✅ |
| AI要約・精査 | フローティングウィジェット（開閉UI・パネル表示。生成はデモ表示） | ✅ |
| 診断ツール | URL入力 → 7カテゴリ診断演出 → アンケートモーダル → 成績表（レーダーチャート・判定スタンプ）→ PDF発行 → 誘導カード4種 | ✅ |
| エラー画面 | 通信エラー／アクセス制限（30分3回）／メンテナンス | ✅ |

### 次フェーズ（未構築）

`index.html` の `<main>` 内コメント参照。

1. 新・七つの大罪って何？まずは動画を見る（YouTube埋め込み）
2. あなたのWEBサイトは、知らずして罪を犯していないか？（導入文・統計・バッジ・メリット3カード）
3. 診断が必要な3つの理由
4. 審判される七つの罪（7カード）
5. 診断ツール2箇所目／固定バナー／フッター

## ファイル構成

```
index.html        … ページ本体
css/style.css     … 全スタイル（デザイントークン → コンポーネント → 印刷）
js/common.js      … 共通JS（固定ヘッダー・スクロールアニメ・メニュー・検索・AIウィジェット）
js/seven-cta.js   … 診断ツール本体（本番JS seven_cta3.js の関数契約と互換）
```

## デザイン定義（3D-CMF / design-styles-skill 準拠）

- **トーン**: 04.高級感 dark variant（5軸: 色温度4 / 彩度2 / 明度2 / 形状4 / 密度1）
- **8色**（すべて `--o-r-colors-*` CSS変数、OWLet移植時はリソースカラーに置換）

| 変数 | 値 | 用途 |
|---|---|---|
| base / base_text | `#0d1528` / `#f8f0dc` | 深紺地×シャンパンクリーム文字（CR 16.0:1） |
| assort / assort_text | `#16223c` / `#f8f0dc` | パネル・メガメニュー面 |
| accent / accent_text | `#c9a84c` / `#0d1528` | ゴールド強調（対base CR 7.9:1） |
| button / button_text | `#c9a84c` / `#0d1528` | CTA（金地×深紺文字 CR 7.9:1） |

- デザイントークン: `--ti-rb:24px / --ti-rc:16px / --ti-rin:8px / --ti-sp:80px / --ti-spc:40px / --ti-gap:24px / --ti-fwbo:800`
- セマンティック色（○△×・エラー等）は8色から派生させず固定色相（緑145°/赤0°/黄35°/青210°）
- 1rem = 10px（`html { font-size: 62.5% }`）、モバイルファースト（768px / 1024px）
- アイコンは自前SVGスプライト（Material Outlined 互換のストローク型、`index.html` 冒頭の `<symbol>` 定義）。CDNフォント非依存のためリガチャ文字化事故がなく、絵文字も不使用
- `prefers-reduced-motion` 対応、フォーカスリング、aria 属性、タッチターゲット 44px 以上

## 診断ツールの仕様

- 本番JS（`seven_cta3.js`）のグローバル関数契約を維持:
  `_startDiagnosis` / `_submitSurvey` / `_industrySurvey` / `finishDiagnosis` / `_pdfGenerate`
- 本番のDOM契約（`#target-url` `#step-entry` `#step-diagnosis` `#survey-form` `#seven-report-container` `#final-actions` `#download-btn` など）を踏襲
- **API接続ポイント**: `js/seven-cta.js` 冒頭の `DIAGNOSIS_API` にエンドポイントを設定すると fetch 実行。
  未設定（`null`）の間は、URL文字列をシードにした**決定論的シミュレーション**で完走（同じURL→同じ結果）
- レート制限（30分3回）はデモとして localStorage で再現。`?nolimit=1` でバイパス可
- PDF発行は `window.print()` ＋ 印刷CSS（成績表のみ白背景で出力）
- レーダーチャートは外部ライブラリ不使用（SVGを直接生成。本番の Chart.js 依存を排除）

## 本番サイトとの意図的な差分

| 項目 | 本番 | 本実装 | 理由 |
|---|---|---|---|
| viewport | `width=320` | `width=device-width` | モダン標準・レスポンシブ最適化 |
| CSSフレームワーク | Tailwind CDN + ページCSS | Vanilla CSS（デザイントークン） | design-styles-skill 実装規約・OWLet移植性 |
| アイコン | Font Awesome（CDNフォント） | インラインSVGスプライト（Material Outlined互換） | CDN障害時のリガチャ文字化を防止・オフライン耐性 |
| 金ボタンの文字色 | 白（AA不通過） | 深紺 `#0d1528`（CR 7.9:1） | WCAG AA 準拠 |
| ヒーロー画像 | CMS画像＋入力オーバーレイ | コード実装（タイポグラフィ＋フォーム） | 画像アセット非依存・CLS/LCP改善 |
| Chart.js / BudouX | CDN読込 | チャートはSVG自製／BudouXは失敗許容の動的import | 依存削減・オフライン耐性 |
| GA4 / Clarity | 設置済み | コメントアウトのプレースホルダー | 開発版から本番計測を汚染しない |
| ナビのPC/SP二重マークアップ | あり | 単一マークアップ＋CSS出し分け | 保守性（リンク内容は本番と同一） |

## 東宣（TOSEN）版 `tosen/`

GAMP提携先・株式会社東宣のPoC用に、**診断の根幹（7カテゴリ×21項目・判定ロジック・成績表機構）を変えずに**導線・見せ方・CTAのみを転換した独立ページ。設計根拠は東宣SSOT v1.0＋議事録2026/5/26（提案書アーティファクト参照）。

```
tosen/
├── index.html        … 東宣版ページ（FV／共感帯／3ステップ／診断／処方箋ブリッジ／誘導カード／最終CTA／フッター）
├── css/tosen.css     … 白基調×TOSENレッド#C8161D×診断CTA#C2410C（8色トークン差し替え＋明転派生）
└── js/
    ├── seven-cta.js  … エンジンのコピー。差分は表示文字列のみ（diffで検証可能）
    ├── common.js     … 共通JSのコピー（検索ドメインの1文字列のみ変更）
    └── tosen-cta.js  … 導線オーケストレーション（エンジン非干渉・成績表DOMをMutationObserverで読み取り）
```

### 東宣版の主要機能

- **世界観転換**：「罪を裁く審判」→「健診と処方箋」。総合判定は内部値不変のまま表示を「取りこぼしリスク：小/中/大/特大」へマッピング。罪名ラテン語行はCSS非表示
- **処方箋ブリッジ**：×カテゴリ→王道メディア処方（折込・地域TV・ラジオ・新聞・交通）＋引用可の実数（出典明記）。V防御力・VI基礎力はWeb改善相談へ正直に接続。全○時は「攻めの認知」分岐
- **CTA体系（SSOT準拠）**：最大CTA「取りこぼしを無料で診断する」×4配置（FV／追従75%／最終／Exit Intent 3分岐）。診断後カードは事例・ガイドDL・10万円テスト・コラム回遊＋相談帯
- **収束導線の受け**：`?from=column&t=カテゴリ` / `?from=price` でFV文言・ブリッジ優先度・10万円カード強調を出し分け
- **計測**：既存の `seven_sins_*` イベント温存＋`generate_lead`（placement付き）・`bridge_view`・`card_click`・`sticky_show`・`exit_show`
- **コンプラ**：判定文は推定表現／実数は出典併記／未許諾社名は業種表記／効果非保証注記を常設

### 未確定（公開前に差し替え）

TOSENレッド正式HEX／ロゴ素材／10万円テストパッケージの内容／GA4プロパティ／実績社名の掲載許諾。
※サイトIA（全URL）は確定済み・反映済み（`/service/*`・`/usp/*`・`/solution/*`・`/contact/` 等）。リンク先ページの実体は別途構築

## 動作確認

ローカルで `index.html`（ガーディアン版）または `tosen/index.html`（東宣版）を開くだけで動作します（ビルド不要）。

```bash
# 簡易サーバーを立てる場合
python3 -m http.server 8000
# → http://localhost:8000/ ／ http://localhost:8000/tosen/
```
