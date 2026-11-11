// ブラウザの中（LocalStorage）だけに記録する。外部のサーバーには送らない。
import { TICKETS_PER_MONTH, type Rounds } from './data';

const KEY = 'ai-baton:v1';

export type Answers = {
  fieldId?: string;
  q2: string;
  q3: string;
  stuck?: string;
  pref?: string;
  exp?: string;
};

export type Draft = {
  answers: Answers;
  rounds: Rounds;
  letter: string;
  /** 紹介状を手で直したか */
  letterEdited: boolean;
  /** この相談でチケットを使ったか（同じ相談で2枚使わないため） */
  ticketUsed: boolean;
  /** 自分のAIでバトンを受け取る（チケットを使わない） */
  baton: boolean;
  /** 開いたAI */
  ai?: string;
};

export type Note = {
  id: string;
  /** 保存した日（YYYY-MM-DD） */
  date: string;
  fieldId?: string;
  summary: string;
  next: string;
  letter: string;
  answers: Answers;
  rounds: Rounds;
  ai?: string;
};

export type Saved = {
  version: 1;
  name: string;
  /** チケットを数えている月（YYYY-MM）。月が変わったら使った枚数を0に戻す */
  ticketMonth: string;
  ticketsUsed: number;
  notes: Note[];
  /** 相談の途中（AIへ行って戻るときにページが読み込み直されても続けられるように） */
  draft: Draft | null;
  /** 最後にいた画面 */
  screen: string;
  /** 最後に使った時刻（ミリ秒）。時間がたってから開いたときは、つづきからではなく書斎から始めるため */
  savedAt?: number;
};

export const emptyAnswers = (): Answers => ({ q2: '', q3: '' });

export const newDraft = (baton = false): Draft => ({
  answers: emptyAnswers(),
  rounds: 5,
  letter: '',
  letterEdited: false,
  ticketUsed: false,
  baton,
});

const pad = (n: number) => String(n).padStart(2, '0');
export const thisMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const today = (d = new Date()) => `${thisMonth(d)}-${pad(d.getDate())}`;

export const initialSaved = (): Saved => ({
  version: 1,
  name: '',
  ticketMonth: thisMonth(),
  ticketsUsed: 0,
  notes: [],
  draft: null,
  screen: 'welcome',
});

/** 読み込み。壊れたデータや古い月は、ここで直す。 */
export function loadSaved(): Saved {
  let s: Saved = initialSaved();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Saved>;
      s = {
        ...s,
        name: typeof p.name === 'string' ? p.name : '',
        ticketMonth: typeof p.ticketMonth === 'string' ? p.ticketMonth : thisMonth(),
        ticketsUsed: typeof p.ticketsUsed === 'number' ? p.ticketsUsed : 0,
        notes: Array.isArray(p.notes) ? p.notes : [],
        draft: p.draft && typeof p.draft === 'object' ? { ...newDraft(), ...p.draft } : null,
        screen: typeof p.screen === 'string' ? p.screen : 'welcome',
        savedAt: typeof p.savedAt === 'number' ? p.savedAt : undefined,
      };
    }
  } catch {
    // 読めないときは最初から（画面は止めない）
  }
  return refreshMonth(s);
}

/** 月が変わっていたら、チケットを4枚に戻す */
export function refreshMonth(s: Saved): Saved {
  const m = thisMonth();
  if (s.ticketMonth !== m) return { ...s, ticketMonth: m, ticketsUsed: 0 };
  return s;
}

export function saveSaved(s: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    // 保存できない（プライベートモードなど）ときも画面は動かす
  }
}

const INPUT_PREFIX = 'ai-baton:input:';

/** 入力の途中（名前・持ち帰りの貼り付けなど）の自動保存。戻るスワイプなどで画面が切り替わっても消えないように */
export function loadInput(key: string): string {
  try {
    return window.localStorage.getItem(INPUT_PREFIX + key) ?? '';
  } catch {
    return '';
  }
}
export function saveInput(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(INPUT_PREFIX + key, value);
    else window.localStorage.removeItem(INPUT_PREFIX + key);
  } catch {
    /* 保存できなくても、画面では使える */
  }
}
export const clearInput = (key: string) => saveInput(key, '');

export function clearSaved() {
  try {
    window.localStorage.removeItem(KEY);
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith(INPUT_PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    /* 何もしない */
  }
}

export const ticketsLeft = (s: Saved) => Math.max(0, TICKETS_PER_MONTH - s.ticketsUsed);
/** 水筒の大きさごとに使うチケット（小＝5回＝0.5枚、大＝10回＝1枚）。0.5刻みなので、足し引きの誤差は出ない */
export const ticketCost = (r: Rounds) => (r === 10 ? 1 : 0.5);
/** チケットの枚数の見せ方：整数は「3」、半端は「3.5」 */
export const fmtTickets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
