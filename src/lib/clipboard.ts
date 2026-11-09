// クリップボードへのコピー。新しい仕組み（navigator.clipboard）が使えないときは古い方法で写す。
// ボタンを押した直後（別タブを開く前）に呼ぶこと。

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 先に古い方法（その場で写し終わる）を試す。別タブを開くとこの画面から操作が離れ、
 * 新しい仕組みは「画面が選ばれていない」として失敗することがあるため。
 */
export async function copyText(text: string): Promise<boolean> {
  if (legacyCopy(text)) return true;
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** 貼り付け（読み取り）。ブラウザが許可しないときは null */
export async function readText(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
  } catch {
    /* 許可されなかった */
  }
  return null;
}
