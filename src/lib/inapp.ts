// LINE・Instagram などのアプリの中の簡易画面（アプリ内ブラウザ／WebView）で開いているかを調べる。
// ここで開くと、記録（名前・チケット・相談ノート）が、ふつうのブラウザ（Chrome・Safari）とは別の場所に保存される。
// また、コピーや「別タブでAIを開く」が止められることがある。そのため、ブラウザで開き直してもらう。
//   ・アプリ名の印（Line/・FBAN・Instagram など）、または Android の WebView の印（; wv)）
//   ・iPhone：Safari の印（Safari/）も、Chrome・Firefox・Edge の印もない
// ※ 各アプリの実機での判定は確認できていない（一般的な印をもとにした判定）。
const IN_APP_UA = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK|Twitter|; wv\)/i;

export function isInAppBrowser(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  if (IN_APP_UA.test(ua)) return true;
  return /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** LINE の簡易画面か（LINE は、URL の末尾に ?openExternalBrowser=1 を付けると、標準のブラウザで開く） */
export const isLine = (ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean => /\bLine\//i.test(ua);

/** 標準のブラウザで開かせる印をつけた、いまのページの URL */
export function externalUrl(href: string = window.location.href): string {
  const u = new URL(href);
  u.searchParams.set('openExternalBrowser', '1');
  return u.toString();
}

/**
 * 簡易画面から、標準のブラウザへ出るための住所を、機種ごとに作る。
 *   ・Android：intent: 方式で Chrome を開く（Chrome が無いときは、ふつうのURLへ）
 *   ・iPhone：x-safari-https: 方式で Safari を開く（動かない簡易画面もある。その場合は、あとの手順でURLのコピーを案内する）
 *   ・そのほか：LINE が標準のブラウザで開くための印（?openExternalBrowser=1）をつけたURL
 * ※ どれも、実物の機種・アプリでの動きは確認できていない（一般に使われている方法）。
 */
export function browserTarget(href: string, ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const u = new URL(href);
  u.searchParams.delete('openExternalBrowser');
  const clean = u.toString();
  if (/Android/i.test(ua)) {
    const path = `${u.host}${u.pathname}${u.search}`;
    return `intent://${path}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(clean)};end`;
  }
  if (/iPhone|iPad|iPod/.test(ua)) {
    return clean.replace(/^https:/, 'x-safari-https:').replace(/^http:/, 'x-safari-http:');
  }
  return externalUrl(clean);
}
