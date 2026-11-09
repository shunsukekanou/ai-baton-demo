# AI-Baton（デモ版）

老博士が話を聞いて「紹介状（専門家の配役つきプロンプト）」を書き、本人の AI（Claude・Gemini・ChatGPT）へ渡すアプリ。
サーバー・DB・AI の API は使わない。記録はブラウザの中（LocalStorage、キー `ai-baton:v1`）だけ。

## 画面の開き方
1. このフォルダ（app）でターミナルを開く
2. `npm run dev` を実行
3. ブラウザで http://localhost:3000 を開く（スマホの見た目は、ブラウザの開発者ツールでスマホ表示にする）

公開用のファイルは `npm run build` で `out/` にできる（静的ファイルなので、Vercel などにそのまま置ける）。
`out/index.html` をダブルクリックで開いても動かない（サーバー経由で開く）。

## どこを直せばよいか
| 直したいもの | ファイル |
|---|---|
| 博士のセリフ・分野と配役・世間話・選択肢・見本の相談者・AI のリンク | `src/lib/data.ts` |
| 紹介状の文面 | `src/lib/letter.ts` |
| 博士の絵 | `public/img/hakase.svg` を差し替える（別名なら `data.ts` の `HAKASE_IMAGE`） |
| 画面の部品と流れ | `src/app/BatonApp.tsx` |
| 色・文字の大きさ | `src/app/globals.css` |

## 公開用（GitHub Pages）
`PAGES=1 PAGES_BASE_PATH=/ai-baton-demo npm run build` で `docs/` に書き出す。`docs/.nojekyll` を置いてから公開する。
