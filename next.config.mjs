/** @type {import('next').NextConfig} */
// 静的なファイルとして書き出す。サーバーやDBは使わない。
// GitHub Pages で公開するときは、PAGES=1 と PAGES_BASE_PATH=/リポジトリ名 をつけてビルドする（書き出し先は docs/）。
const pages = process.env.PAGES === '1';
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  ...(pages ? { distDir: 'docs', basePath: process.env.PAGES_BASE_PATH || '' } : {}),
};
export default nextConfig;
