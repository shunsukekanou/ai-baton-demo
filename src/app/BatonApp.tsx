'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AI_SERVICES,
  AIZUCHI,
  EXP_CHOICES,
  FIELDS,
  HAKASE_IMAGE,
  PREF_CHOICES,
  ROUND_CHOICES,
  SAMPLE,
  STUCK_CHOICES,
  TICKETS_PER_MONTH,
  TALK_ACCEPT,
  TALK_AREA_ASK,
  TALK_AREAS,
  TALK_NONE_AREA,
  TALK_NONE_CANDIDATE,
  TALK_REST,
  TALK_SAFETY,
  TALK_WEATHER,
  findField,
  type Rounds,
} from '@/lib/data';
import { buildLetter } from '@/lib/letter';
import { copyText } from '@/lib/clipboard';
import { browserTarget, externalUrl, isInAppBrowser } from '@/lib/inapp';
import {
  clearInput,
  clearSaved,
  emptyAnswers,
  initialSaved,
  loadInput,
  loadSaved,
  newDraft,
  refreshMonth,
  saveInput,
  saveSaved,
  ticketsLeft,
  today,
  type Answers,
  type Draft,
  type Note,
  type Saved,
} from '@/lib/storage';

type Screen =
  | 'welcome' | 'study' | 'chat'
  | 'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  | 'confirm' | 'letter' | 'depart' | 'return' | 'notes';

const SCREENS: Screen[] = ['welcome', 'study', 'chat', 'q1', 'q2', 'q3', 'q4', 'q5', 'confirm', 'letter', 'depart', 'return', 'notes'];
const NEEDS_DRAFT: Screen[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'confirm', 'letter', 'depart', 'return'];
const QUESTIONS: Screen[] = ['q1', 'q2', 'q3', 'q4', 'q5'];

/** これより長く開いていなかったら、前の画面のつづきからではなく、書斎から始める（AIに相談して戻ってくる間は、つづきから） */
const RESUME_MS = 6 * 60 * 60 * 1000;
/** 同じブラウザの画面（タブ）の中かどうかの印。新しくURLを開いたとき（LINEから開き直したときなど）は無いので、書斎から始める */
const SESSION_KEY = 'ai-baton:session';
/** つづきからにしない画面（最初から開いてよい画面） */
const HOME_SCREENS: Screen[] = ['welcome', 'study', 'chat', 'notes'];

/** 入力の途中を、打つたびに自動で保存する（戻るスワイプなどで画面が切り替わっても消えない） */
function usePersistedText(key: string): [string, (v: string) => void, () => void] {
  const [v, setV] = useState('');
  useEffect(() => {
    setV(loadInput(key)); // 描いたあとに読む（サーバーで作った画面と食い違わないように）
  }, [key]);
  const set = (x: string) => {
    setV(x);
    saveInput(key, x);
  };
  const clear = () => {
    setV('');
    clearInput(key);
  };
  return [v, set, clear];
}

/** 入力の途中の画面。ここで戻るスワイプをされても、画面を動かさない */
const INPUT_SCREENS: Screen[] = ['welcome', 'q2', 'q3', 'return'];

/** 名前が無い・相談の途中データが無いのにその画面へ来たら、入れる画面へ直す */
function validScreen(s: Saved, want: string): Screen {
  if (!s.name) return 'welcome';
  const sc = (SCREENS as string[]).includes(want) ? (want as Screen) : 'study';
  if (sc === 'welcome') return 'study';
  if (NEEDS_DRAFT.includes(sc) && !s.draft) return 'study';
  return sc;
}

/** チケットを1枚使う（同じ相談では1回だけ。0枚なら自分のAIへのバトンにする） */
function spendTicket(p: Saved): Saved {
  const s = refreshMonth(p);
  if (!s.draft || s.draft.ticketUsed || s.draft.baton) return s;
  if (ticketsLeft(s) > 0) {
    return { ...s, ticketsUsed: s.ticketsUsed + 1, draft: { ...s.draft, ticketUsed: true } };
  }
  return { ...s, draft: { ...s.draft, baton: true } };
}

/** ノートの持ち帰りメモを引き継いだ、新しい相談（新しい水筒）の下書きを作る */
function continueFrom(q: Saved, n: Note): Saved {
  return {
    ...q,
    draft: {
      ...newDraft(ticketsLeft(q) === 0),
      answers: n.answers,
      rounds: n.rounds,
      letter: buildLetter(q.name, n.answers, n.rounds, { summary: n.summary, next: n.next }),
      letterEdited: false,
    },
  };
}

export default function BatonApp() {
  const [s, setS] = useState<Saved | null>(null);
  // Next.js が履歴の状態に入れている内部の印（__NA など）。これを消すと、戻るスワイプのたびにページが丸ごと読み込み直されて、
  // 入力が消える。画面の履歴を書くときは、必ずこの印を引き継ぐ。
  const nextState = useRef<Record<string, unknown>>({});
  const [fixing, setFixing] = useState(false);
  const [flash, setFlash] = useState('');
  const [sheet, setSheet] = useState<{ kind: SheetKind; screen: string } | null>(null);

  // 起動時：LocalStorage から読み込む（サーバーでの下書き表示と食い違わないよう、読み込み後に描く）
  useEffect(() => {
    const loaded = loadSaved();
    let sameSession = false;
    try {
      sameSession = window.sessionStorage.getItem(SESSION_KEY) === '1';
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* 使えないときは、書斎から始める */
    }
    // 新しく開いたとき・時間がたっているときは、つづきからではなく書斎から。同じ画面（タブ）の読み込み直しは、つづきから
    const stale = !sameSession || !loaded.savedAt || Date.now() - loaded.savedAt > RESUME_MS;
    let screen = validScreen(loaded, loaded.screen);
    if (stale && !HOME_SCREENS.includes(screen)) screen = validScreen(loaded, 'study'); // 時間がたっている：書斎から
    else if (!HOME_SCREENS.includes(screen)) setToast('前のつづきから開いたぞ。最初からやるなら、「もどる」で書斎へ戻るんじゃ。');
    setS({ ...loaded, screen });
    const cur = (window.history.state ?? {}) as Record<string, unknown>;
    nextState.current = Object.fromEntries(Object.entries(cur).filter(([k]) => k.startsWith('__')));
    window.history.replaceState({ ...nextState.current, base: true }, ''); // いちばん下の「土台」。ここまで戻ったら、画面を動かさず積み直す
    window.history.pushState({ ...nextState.current, screen }, '');
  }, []);

  // 変わるたびに保存
  useEffect(() => {
    if (s) saveSaved(s);
  }, [s]);

  // いま出ている画面（戻るスワイプの処理が、最新の画面を知るため）
  const screenRef = useRef<Screen>('welcome');
  useEffect(() => {
    if (s) screenRef.current = s.screen as Screen;
  }, [s]);

  // LINE などの簡易画面で開いているか（開いていたら、ブラウザで開き直す案内を出す）
  const [inApp, setInApp] = useState(false);
  const [inAppOk, setInAppOk] = useState(false); // 「このまま使う」を選んだ
  const [urlCopied, setUrlCopied] = useState(false);
  const [tried, setTried] = useState(false); // 「ブラウザで開き直す」を押した
  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  // 戻るスワイプのお知らせ（数秒で消える）
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ブラウザ・スマホの「戻る」：入力の途中の画面や、いちばん最初の画面では、画面を動かさない（打った内容を守る）
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { screen?: string; base?: boolean } | null;
      const cur = screenRef.current;
      if (!st?.screen || INPUT_SCREENS.includes(cur)) {
        window.history.pushState({ ...nextState.current, screen: cur }, ''); // 積み直して、いまの画面にとどまる
        setToast('戻るときは、画面の「もどる」ボタンを押してのう。書いた内容は消えんぞ。');
        return;
      }
      setS((p) => (p ? { ...p, screen: validScreen(p, st.screen as string) } : p));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [s?.screen]);

  if (!s) return <div className="loading">博士を呼んでおるぞ…</div>;

  const left = ticketsLeft(s);
  const name = s.name;
  const draft = s.draft;
  const screen = s.screen as Screen;
  const openSheet = (kind: SheetKind) => setSheet({ kind, screen });

  const go = (sc: Screen, f?: (p: Saved) => Saved) => {
    setS((p) => (p ? { ...(f ? f(p) : p), screen: sc } : p));
    window.history.pushState({ ...nextState.current, screen: sc }, '');
  };
  const update = (f: (p: Saved) => Saved) => setS((p) => (p ? f(p) : p));
  const setDraft = (f: (d: Draft) => Draft) => update((p) => (p.draft ? { ...p, draft: f(p.draft) } : p));
  const setAnswers = (patch: Partial<Answers>) => setDraft((d) => ({ ...d, answers: { ...d.answers, ...patch } }));

  /** 相談を始める（チケットが無ければ、自分のAIでバトンを受け取る形で） */
  const startConsult = () => {
    setFixing(false);
    go('q1', (p) => ({ ...p, draft: newDraft(ticketsLeft(refreshMonth(p)) === 0) }));
  };

  /** 聞き取りの次へ（直している途中なら、受け止め確認へ戻る） */
  const nextQuestion = (from: Screen) => {
    if (fixing) {
      setFixing(false);
      go('confirm');
      return;
    }
    const i = QUESTIONS.indexOf(from);
    go(i < QUESTIONS.length - 1 ? QUESTIONS[i + 1] : 'confirm');
  };
  const prevQuestion = (from: Screen) => {
    if (fixing) {
      setFixing(false);
      go('confirm');
      return;
    }
    const i = QUESTIONS.indexOf(from);
    go(i > 0 ? QUESTIONS[i - 1] : 'study');
  };

  /** 世間話から相談へ。選んだ分野と困りごとを入れた状態で、Q2（くわしく聞くところ）から始める */
  const startFromTalk = (fieldId: string, text: string) => {
    setFixing(false);
    go('q2', (p) => ({
      ...p,
      draft: { ...newDraft(ticketsLeft(refreshMonth(p)) === 0), answers: { ...emptyAnswers(), fieldId, q2: text } },
    }));
  };

  const startSample = () => {
    setFixing(false);
    go('letter', (p) => {
      const q = refreshMonth(p);
      const nm = q.name || SAMPLE.name;
      const d: Draft = {
        ...newDraft(ticketsLeft(q) === 0),
        answers: { ...SAMPLE.answers },
      };
      d.letter = buildLetter(nm, d.answers, d.rounds);
      return { ...q, name: nm, draft: d };
    });
  };

  const resetAll = () => {
    if (!window.confirm('名前・チケット・相談ノートをすべて消して、最初からやり直します。よいかの？')) return;
    clearSaved();
    setFixing(false);
    setFlash('');
    setS({ ...initialSaved(), screen: 'welcome' });
    window.history.replaceState({ ...nextState.current, screen: 'welcome' }, '');
  };

  let body: ReactNode = null;
  switch (screen) {
    case 'welcome':
      body = <Welcome onDone={(nm) => go('study', (p) => ({ ...p, name: nm }))} />;
      break;
    case 'study':
      body = (
        <Study
          name={name}
          left={left}
          noteCount={s.notes.length}
          hasReturn={!!draft && (draft.ticketUsed || draft.baton) && !!draft.ai}
          onConsult={startConsult}
          onChat={() => go('chat')}
          onNotes={() => go('notes')}
          onReturn={() => go('return')}
          onAbout={() => openSheet('about')}
        />
      );
      break;
    case 'chat':
      body = <Chat onConsult={startFromTalk} onHome={() => go('study')} />;
      break;
    case 'q1':
    case 'q2':
    case 'q3':
    case 'q4':
    case 'q5':
      body = draft && (
        <Question
          q={screen}
          answers={draft.answers}
          baton={draft.baton}
          fixing={fixing}
          onChange={setAnswers}
          onNext={() => nextQuestion(screen)}
          onBack={() => prevQuestion(screen)}
        />
      );
      break;
    case 'confirm':
      body = draft && (
        <Confirm
          name={name}
          answers={draft.answers}
          onYes={() =>
            go('letter', (p) =>
              p.draft
                ? { ...p, draft: { ...p.draft, letter: buildLetter(p.name, p.draft.answers, p.draft.rounds), letterEdited: false } }
                : p,
            )
          }
          onFix={(q) => {
            setFixing(true);
            go(q);
          }}
          onBack={() => go('q5')}
        />
      );
      break;
    case 'letter':
      body = draft && (
        <Letter
          draft={draft}
          onRounds={(r) => {
            setDraft((d) => ({ ...d, rounds: r, letter: buildLetter(name, d.answers, r), letterEdited: false }));
          }}
          onNext={() => go('depart')}
          onBack={() => go('confirm')}
          onHelp={() => openSheet('letter')}
        />
      );
      break;
    case 'depart':
      body = draft && (
        <Depart
          draft={draft}
          left={left}
          onOpen={(aiId) => update((p) => {
            const q = spendTicket(p);
            return q.draft ? { ...q, draft: { ...q.draft, ai: aiId } } : q;
          })}
          onReturn={() => go('return')}
          onBack={() => go('letter')}
          onHelp={() => openSheet('bottle')}
        />
      );
      break;
    case 'return':
      body = draft && (
        <Return
          onSave={(summary, next) => {
            setFlash('よく頑張ったのう。次にやること、ひとつだけでも試してみるんじゃぞ。');
            go('notes', (p) => {
              if (!p.draft) return p;
              const d = p.draft;
              const note = {
                id: `${Date.now()}`,
                date: today(),
                fieldId: d.answers.fieldId,
                summary,
                next,
                letter: d.letter,
                answers: d.answers,
                rounds: d.rounds,
                ai: d.ai,
              };
              return { ...p, notes: [note, ...p.notes], draft: null };
            });
          }}
          onSaveContinue={(summary, next) => {
            setFlash('');
            go('depart', (p) => {
              if (!p.draft) return p;
              const d = p.draft;
              const note = {
                id: `${Date.now()}`,
                date: today(),
                fieldId: d.answers.fieldId,
                summary,
                next,
                letter: d.letter,
                answers: d.answers,
                rounds: d.rounds,
                ai: d.ai,
              };
              return continueFrom(refreshMonth({ ...p, notes: [note, ...p.notes] }), note);
            });
          }}
          onBack={() => go('depart')}
          onHelp={() => openSheet('bottle')}
        />
      );
      break;
    case 'notes':
      body = (
        <Notes
          notes={s.notes}
          flash={flash}
          onAgain={(id) => {
            setFlash('');
            go('depart', (p) => {
              const n = p.notes.find((x) => x.id === id);
              if (!n) return p;
              return continueFrom(refreshMonth(p), n);
            });
          }}
          onHome={() => {
            setFlash('');
            go('study');
          }}
        />
      );
      break;
  }

  return (
    <div className="page room">
      <header className="top">
        <span className="brand">AI-Baton</span>
        <button type="button" className="about-btn" data-testid="about-open" onClick={() => openSheet('about')}>
          ？ AI-Batonとは
        </button>
        {name && (
          <span className="top-ticket" aria-label="今月の相談チケット">
            {name}さん｜チケット 残り <b data-testid="tickets-left">{left}</b>/{TICKETS_PER_MONTH}
          </span>
        )}
      </header>
      {sheet && sheet.screen === screen && <AboutSheet kind={sheet.kind} onClose={() => setSheet(null)} />}
      <main className="main" data-screen={screen}>
        {inApp && !inAppOk && (
          <div className="inapp" role="alert">
            <p>
              <b>LINEなどの中で開いておるようじゃ。</b>ここでは、名前やチケット、ノートが、ふつうのブラウザ（ChromeやSafari）とは別の場所に保存されてしまうぞ。
              コピーやAIの画面も、うまく動かないことがある。ブラウザで開き直しておくれ。
            </p>
            <div className="row-buttons">
              <button
                type="button"
                className="btn-small"
                onClick={() => {
                  setTried(true);
                  // 外のブラウザへ出る。出られなかったとき（この画面が残っているとき）のために、少しあとで印つきのURLへも進む
                  window.location.href = browserTarget(window.location.href);
                  window.setTimeout(() => {
                    if (document.visibilityState === 'visible') window.location.href = externalUrl();
                  }, 1800);
                }}
              >
                ブラウザで開き直す
              </button>
              <button
                type="button"
                className="btn-small"
                onClick={async () => {
                  setUrlCopied(await copyText(window.location.origin + window.location.pathname));
                }}
              >
                URLをコピー
              </button>
              <button type="button" className="btn-link" onClick={() => setInAppOk(true)}>このまま使う</button>
            </div>
            {urlCopied && <p className="ok-text">コピーしたぞ。ChromeやSafariを開いて、貼り付けておくれ。</p>}
            {tried && !urlCopied && <p className="hint">ブラウザが開かなかったら、「URLをコピー」を押して、ChromeやSafariに貼り付けておくれ。</p>}
          </div>
        )}
        {body}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <footer className="demo">
        <span className="demo-label">展示用</span>
        <button type="button" className="btn-small" onClick={startSample}>見本の相談者で試す</button>
        <button type="button" className="btn-small" onClick={resetAll}>最初からやり直す</button>
      </footer>
    </div>
  );
}

/* ---------- 部品 ---------- */

function Hakase({ children }: { children: ReactNode }) {
  return (
    <div className="hakase">
      {/* 博士の絵は data.ts の HAKASE_IMAGE で差し替える */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hakase-img" src={HAKASE_IMAGE} alt="バトン博士" width={96} height={96} />
      <div className="bubble">{children}</div>
    </div>
  );
}

/** 電池の目盛りつき水筒。level＝残り段数（0〜5）。10回の水筒は少し大きく描く */
function Bottle({ rounds, level = 5 }: { rounds: Rounds; level?: number }) {
  const big = rounds === 10;
  return (
    <svg className="bottle" data-testid="bottle" data-level={level} viewBox="0 0 40 64" width={big ? 44 : 34} height={big ? 70 : 54} role="img" aria-label={`水筒の残り ${level}/5`}>
      <rect x="14" y="2" width="12" height="7" rx="2" fill="#8a5a2b" />
      <rect x="7" y="9" width="26" height="52" rx="8" fill="#fff" stroke="#3d6e8f" strokeWidth="2.5" />
      {[0, 1, 2, 3, 4].map((k) => {
        const filled = 4 - k < level;
        return (
          <rect
            key={k}
            data-block={filled ? 'full' : 'empty'}
            x="11.5" y={14 + k * 8.8} width="17" height="7" rx="1.8"
            fill={filled ? '#7fc3e6' : '#f4f1ea'}
            stroke={filled ? '#4f9bc4' : '#d8d2c4'}
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

/* ① はじめて */
function Welcome({ onDone }: { onDone: (name: string) => void }) {
  const [nm, setNm, clearNm] = usePersistedText('name');
  const [step, setStep] = useState<1 | 2>(1);
  const trimmed = nm.trim();
  if (step === 2) {
    return (
      <section>
        <Hakase>
          {trimmed}さん、よろしくのう。<br />
          今月の相談チケットは<b>{TICKETS_PER_MONTH}枚</b>じゃ。週に1回、気軽においで。
        </Hakase>
        <button type="button" className="btn-big" onClick={() => {
          clearNm();
          onDone(trimmed);
        }}>博士の書斎に入る</button>
        <button type="button" className="btn-link" onClick={() => setStep(1)}>名前を直す</button>
      </section>
    );
  }
  return (
    <section>
      <Hakase>やあやあ、よくきたのう。わしはバトン博士じゃ。おぬしの名前を教えてくれんか。</Hakase>
      <label className="field-label" htmlFor="nm">呼び名（ニックネームでもよいぞ）</label>
      <input
        id="nm"
        className="input"
        value={nm}
        maxLength={20}
        placeholder="例：まさる"
        onChange={(e) => setNm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && trimmed && !e.nativeEvent.isComposing) setStep(2);
        }}
      />
      <button type="button" className="btn-big" disabled={!trimmed} onClick={() => setStep(2)}>これでよし</button>
    </section>
  );
}

/* ② 博士の書斎 */
type SheetKind = 'about' | 'letter' | 'bottle';
const SHEET_TITLES: Record<SheetKind, string> = { about: 'AI-Batonとは', letter: '手紙（紹介状）とは', bottle: '水筒とは' };

/** やさしい一言＋「？」（くわしい説明シートを開く） */
function HintLine({ text, onMore, label, testId }: { text: string; onMore: () => void; label: string; testId: string }) {
  return (
    <p className="room-intro" data-testid={testId}>
      {text}
      <button type="button" className="intro-more" aria-label={label} onClick={onMore}>？</button>
    </p>
  );
}

/* 「AI-Batonとは」の説明シート（下から開く）。外側タップ・「とじる」・Esc で閉じる */
function AboutSheet({ kind, onClose }: { kind: SheetKind; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);
  return (
    <div className={shown ? 'sheet-back shown' : 'sheet-back'} data-testid="about-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="about-title" data-testid="about-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <h2 id="about-title" className="sheet-title">{SHEET_TITLES[kind]}</h2>
        {kind === 'about' && (
          <>
            <p>{'AI-Batonは、よくわからない心の悩みや頭のもやもやを、少しずつほどいていくための、AIへの相談窓口です。バトン博士に紹介されたそれぞれの相談役に、あなたの話を聞いてもらってください。行動への第一歩につながるかもしれません。'}</p>
            <ol className="sheet-steps">
              <li><b>①</b> 博士が話を聞く・手紙を書く</li>
              <li><b>②</b> 水筒を持って相談役へ</li>
              <li><b>③</b> 行動への第一歩を持ち帰る</li>
            </ol>
          </>
        )}
        {kind === 'letter' && (
          <p>{'バトン博士が勧めてくれた、専門家への手紙です。あなたが相談したい内容に対して、どんな立場で話を掘り下げてくれるかなどが書かれています。'}</p>
        )}
        {kind === 'bottle' && (
          <p>{'AIは、長い話のなかで、記憶が抜けたり、答えの精度が下がったりすることがあります。水筒は、そうならないうちに話をまとめるための、目安のゲージです。'}</p>
        )}
        <p className="sheet-note">※本アプリは医療機関の診察や治療を行うものではありません</p>
        <button type="button" ref={closeRef} className="btn-big" data-testid="about-close" onClick={onClose}>とじる</button>
      </div>
    </div>
  );
}

function Study(props: {
  name: string;
  left: number;
  noteCount: number;
  hasReturn: boolean;
  onConsult: () => void;
  onChat: () => void;
  onNotes: () => void;
  onReturn: () => void;
  onAbout: () => void;
}) {
  const { name, left } = props;
  return (
    <section>
      <p className="room-intro" data-testid="intro-line">
        ここは、心のもやもやを話して、一歩ふみ出すための相談窓口じゃ。
        <button type="button" className="intro-more" data-testid="intro-more" onClick={props.onAbout}>詳しく</button>
      </p>
      <Hakase>
        {left > 0 ? (
          <>{name}さん、よくきたのう。どうしたんじゃ？</>
        ) : (
          <>今月のチケットはもう使い切ったぞ。じゃが、おぬし自身のAIで続けることはできるぞ。</>
        )}
      </Hakase>
      <div className="tickets" aria-label={`今月の相談チケット 残り${left}枚`}>
        <span className="tickets-title">今月の相談チケット</span>
        <span className="ticket-row">
          {Array.from({ length: TICKETS_PER_MONTH }, (_, i) => (
            <span key={i} className={i < left ? 'ticket on' : 'ticket off'} />
          ))}
        </span>
        <span className="tickets-count">残り <b>{left}</b>枚／{TICKETS_PER_MONTH}枚</span>
      </div>
      {props.hasReturn && (
        <button type="button" className="btn-big btn-accent" onClick={props.onReturn}>相談から帰ってきた（持ち帰り）</button>
      )}
      {left > 0 ? (
        <button type="button" className="btn-big" onClick={props.onConsult}>相談ごとがある</button>
      ) : (
        <button type="button" className="btn-big" onClick={props.onConsult}>自分のAIでバトンを受け取る</button>
      )}
      <button type="button" className="btn-big btn-soft" onClick={props.onChat}>ちょっと世間話</button>
      <button type="button" className="btn-small wide" onClick={props.onNotes}>相談ノートを見る（{props.noteCount}件）</button>
    </section>
  );
}

/* ③A 世間話 */
function Chat({ onConsult, onHome }: { onConsult: (fieldId: string, text: string) => void; onHome: () => void }) {
  type Step = 'weather' | 'area' | 'candidate' | 'accept' | 'rest';
  const [step, setStep] = useState<Step>('weather');
  const [area, setArea] = useState<(typeof TALK_AREAS)[number] | null>(null);
  const [concern, setConcern] = useState('');
  const [log, setLog] = useState<{ who: 'h' | 'me'; text: string }[]>([{ who: 'h', text: TALK_WEATHER.hakase }]);
  const say = (me: string, h: string) => setLog((l) => [...l, { who: 'me', text: me }, { who: 'h', text: h }]);
  const stepNo = step === 'weather' ? 1 : step === 'area' ? 2 : 3;
  // 選ぶたびに内容が下へ伸びるので、新しい博士の言葉と選択肢が見える位置まで、自動で下へ送る
  useEffect(() => {
    if (log.length <= 1) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: calm ? 'auto' : 'smooth' }), 80);
    return () => window.clearTimeout(id);
  }, [log.length]);

  let choices: ReactNode = null;
  if (step === 'weather') {
    choices = TALK_WEATHER.choices.map((c) => (
      <button key={c} type="button" className="btn-choice" onClick={() => { say(c, TALK_AREA_ASK); setStep('area'); }}>{c}</button>
    ));
  } else if (step === 'area') {
    choices = (
      <>
        {TALK_AREAS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="btn-choice"
            onClick={() => {
              say(a.label, `ふむふむ。「${a.label}」で、「そういえば…」と思い当たることはあるかの？`);
              setArea(a);
              setStep('candidate');
            }}
          >
            {a.label}
          </button>
        ))}
        <button type="button" className="btn-choice" onClick={() => { say(TALK_NONE_AREA, TALK_REST); setStep('rest'); }}>{TALK_NONE_AREA}</button>
      </>
    );
  } else if (step === 'candidate' && area) {
    choices = (
      <>
        {area.candidates.map((c) => (
          <button key={c} type="button" className="btn-choice" onClick={() => { say(c, TALK_ACCEPT); setConcern(c); setStep('accept'); }}>{c}</button>
        ))}
        <button type="button" className="btn-choice" onClick={() => { say(TALK_NONE_CANDIDATE, TALK_REST); setStep('rest'); }}>{TALK_NONE_CANDIDATE}</button>
      </>
    );
  }

  return (
    <section>
      <div className="chat-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hakase-img small" src={HAKASE_IMAGE} alt="バトン博士" width={56} height={56} />
        <span>
          {step === 'accept' || step === 'rest' ? '世間話' : `世間話（${stepNo}／3）`} チケットは使わんぞ
        </span>
      </div>
      <div className="chat-log">
        {log.map((m, i) => (
          <p key={i} className={m.who === 'h' ? 'msg msg-h' : 'msg msg-me'}>{m.text}</p>
        ))}
      </div>
      {choices && <div className="choices">{choices}</div>}
      {step === 'accept' && area && (
        <>
          <button type="button" className="btn-big" data-testid="talk-consult" onClick={() => onConsult(area.fieldId, concern)}>この内容で相談してみる</button>
          <button type="button" className="btn-link" onClick={onHome}>書斎へもどる</button>
        </>
      )}
      {step === 'rest' && (
        <button type="button" className="btn-big btn-soft" data-testid="talk-home" onClick={onHome}>書斎へもどる</button>
      )}
      {step !== 'accept' && step !== 'rest' && (
        <button type="button" className="btn-link" onClick={onHome}>もどる（書斎へ）</button>
      )}
      <p className="hint" data-testid="talk-safety">{TALK_SAFETY}</p>
    </section>
  );
}

/* ③B 相談の聞き取り（1画面1問） */
function Question(props: {
  q: 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
  answers: Answers;
  baton: boolean;
  fixing: boolean;
  onChange: (p: Partial<Answers>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { q, answers: a, onChange, onNext } = props;
  const no = QUESTIONS.indexOf(q) + 1;
  const field = findField(a.fieldId);
  let content: ReactNode = null;
  let bubble: ReactNode = AIZUCHI[q];

  if (q === 'q1') {
    bubble = (
      <>
        {props.baton && <>今回はおぬし自身のAIでバトンを受け取るんじゃな。チケットは使わんぞ。<br /></>}
        {AIZUCHI.q1}
      </>
    );
    content = (
      <>
        <h2 className="q-title">どんなことで困っておる？</h2>
        <div className="choices grid">
          {FIELDS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={a.fieldId === f.id ? 'btn-choice picked' : 'btn-choice'}
              onClick={() => {
                onChange({ fieldId: f.id });
                onNext();
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </>
    );
  } else if (q === 'q2' || q === 'q3') {
    const key = q;
    const examples = (q === 'q2' ? field?.q2Examples : field?.q3Examples) ?? [];
    if (q === 'q2' && field) bubble = <>「{field.label}」のことじゃな。{AIZUCHI.q2}</>;
    content = (
      <>
        <h2 className="q-title">{q === 'q2' ? 'もう少し教えてくれんか' : 'どうなったらうれしいかのう？'}</h2>
        <textarea
          className="input area"
          rows={4}
          maxLength={300}
          value={a[key]}
          placeholder={q === 'q2' ? '困っていることを、ひとことでも' : 'こうなったらいいな、をひとことでも'}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
        {examples.length > 0 && (
          <div className="examples">
            <span className="examples-label">入力例（押すと入るぞ）</span>
            {examples.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => onChange({ [key]: ex })}>{ex}</button>
            ))}
          </div>
        )}
        <button type="button" className="btn-big" disabled={!a[key].trim()} onClick={onNext}>
          {props.fixing ? 'これでよし（確認へ）' : '次へ'}
        </button>
      </>
    );
  } else if (q === 'q4') {
    content = (
      <>
        <h2 className="q-title">どこで止まっておる？</h2>
        <div className="choices">
          {STUCK_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              className={a.stuck === c ? 'btn-choice picked' : 'btn-choice'}
              onClick={() => {
                onChange({ stuck: c });
                onNext();
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </>
    );
  } else {
    content = (
      <>
        <h2 className="q-title">答えの好みは？</h2>
        <div className="choices row">
          {PREF_CHOICES.map((c) => (
            <button key={c.label} type="button" className={a.pref === c.label ? 'btn-choice picked' : 'btn-choice'} onClick={() => onChange({ pref: c.label })}>
              {c.label}
            </button>
          ))}
        </div>
        <h2 className="q-title">AIを使ったことは？</h2>
        <div className="choices row">
          {EXP_CHOICES.map((c) => (
            <button key={c.label} type="button" className={a.exp === c.label ? 'btn-choice picked' : 'btn-choice'} onClick={() => onChange({ exp: c.label })}>
              {c.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn-big" disabled={!a.pref || !a.exp} onClick={onNext}>
          {props.fixing ? 'これでよし（確認へ）' : '次へ'}
        </button>
      </>
    );
  }

  return (
    <section>
      <p className="progress">相談の聞き取り　{no}／{QUESTIONS.length}</p>
      <Hakase>{bubble}</Hakase>
      {content}
      <button type="button" className="btn-link" onClick={props.onBack}>
        {props.fixing ? 'もどる（確認へ）' : 'もどる'}
      </button>
    </section>
  );
}

/* ④ 受け止め確認 */
function Confirm(props: {
  name: string;
  answers: Answers;
  onYes: () => void;
  onFix: (q: Screen) => void;
  onBack: () => void;
}) {
  const { name, answers: a } = props;
  const [choosing, setChoosing] = useState(false);
  const rows: { q: Screen; label: string; value: string }[] = [
    { q: 'q1', label: '困っている分野', value: findField(a.fieldId)?.label ?? '' },
    { q: 'q2', label: '困っていること', value: a.q2 },
    { q: 'q3', label: 'こうなったらうれしい', value: a.q3 },
    { q: 'q4', label: '止まっているところ', value: a.stuck ?? '' },
    { q: 'q5', label: '答えの好み・AIの経験', value: `${a.pref ?? ''}／${a.exp ?? ''}` },
  ];
  return (
    <section>
      <Hakase>
        {name}さんは「<b>{a.q2}</b>」で困っていて、「<b>{a.q3}</b>」と願っておるけれど、「<b>{a.stuck}</b>」で悩んでおるんじゃな？
      </Hakase>
      {!choosing ? (
        <>
          <button type="button" className="btn-big" onClick={props.onYes}>そうなんです</button>
          <button type="button" className="btn-big btn-soft" onClick={() => setChoosing(true)}>ちょっと違う</button>
          <button type="button" className="btn-link" onClick={props.onBack}>もどる</button>
        </>
      ) : (
        <>
          <p className="note-text">どこを直すかのう？</p>
          <div className="fix-list">
            {rows.map((r) => (
              <button key={r.q} type="button" className="fix-row" onClick={() => props.onFix(r.q)}>
                <span className="fix-label">{r.label}</span>
                <span className="fix-value">{r.value}</span>
                <span className="fix-go">直す</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-link" onClick={() => setChoosing(false)}>やっぱりこのままでよい</button>
        </>
      )}
    </section>
  );
}

/* ⑤ 紹介状（中身は見せない。出発の画面で AI のボタンを押すと、自動でコピーされる） */
function Letter(props: {
  draft: Draft;
  onRounds: (r: Rounds) => void;
  onNext: () => void;
  onBack: () => void;
  onHelp: () => void;
}) {
  const { draft } = props;
  const field = findField(draft.answers.fieldId);
  return (
    <section>
      <Hakase>
        よし、紹介状を書いたぞ。「{field?.role ?? '相談役'}」に話を聞いてもらうとよい。
        水筒を持って行っておいで。
      </Hakase>
      <HintLine testId="hint-letter" text="博士が書く、専門家への手紙じゃ。どう話を聞いてくれるかが書いてある。" onMore={props.onHelp} label="手紙のくわしい説明" />
      <div className="rounds">
        <Bottle rounds={draft.rounds} level={5} />
        <span className="rounds-label">水筒の大きさ<br /><small data-testid="bottle-label">満タン（{draft.rounds}回分）</small></span>
        {ROUND_CHOICES.map((r) => (
          <button key={r} type="button" className={draft.rounds === r ? 'btn-choice picked' : 'btn-choice'} onClick={() => props.onRounds(r)}>
            {r <= 5 ? '小' : '大'}（{r}回）
          </button>
        ))}
      </div>
      <p className="hint">
        水筒とは、相談する先生（AI）と<b>つづけて話せる回数</b>のことじゃ。おぬしが1回話して、先生が1回答えたら「1回」と数える。
        小さい水筒は5回、大きい水筒は10回まで。ちょっと聞きたいだけなら小、じっくり相談したいなら大がよいぞ。
      </p>
      <p className="hint">※ 紹介状は、このあと開くおぬし自身のAIに貼り付けて送るぞ。名前や住所、会社の秘密は、相談に入れんようにのう。</p>
      <button type="button" className="btn-big" onClick={props.onNext}>この紹介状を持って出発する</button>
      <button type="button" className="btn-link" onClick={props.onBack}>もどる</button>
    </section>
  );
}

/* ⑥ AIを選んで出発 */
function Depart(props: {
  draft: Draft;
  left: number;
  onOpen: (aiId: string) => void;
  onReturn: () => void;
  onBack: () => void;
  onHelp: () => void;
}) {
  const { draft, left } = props;
  const [msg, setMsg] = useState<{ ai: string; copied: boolean } | null>(null);
  // 「相談から帰ってきた」ボタンは、AIを開いたあと、実際にこの画面へ戻ってきたときだけ出す。
  // （前にAIを開いていて、ページが読み込み直されて戻ったときも出す）
  const [returned, setReturned] = useState(!!draft.ai);
  const openedAt = useRef(0);
  const autoWent = useRef(false);
  const onReturnRef = useRef(props.onReturn);
  onReturnRef.current = props.onReturn;
  useEffect(() => {
    const back = () => {
      if (openedAt.current && document.visibilityState === 'visible' && Date.now() - openedAt.current > 3000) {
        setReturned(true);
        // AIの画面から戻ってきたら、自動で持ち帰り画面（⑦）へ進む（一度だけ）
        if (!autoWent.current) {
          autoWent.current = true;
          onReturnRef.current();
        }
      }
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
    };
  }, []);

  let ticketMsg: string;
  if (draft.ticketUsed) ticketMsg = 'この相談のチケットはもう使ったぞ。別のAIを開き直しても、チケットは減らん。';
  else if (draft.baton) ticketMsg = '今回はおぬし自身のAIで受け取るので、チケットは使わんぞ。';
  else if (left > 0) ticketMsg = `AIのボタンを押すと、チケットを1枚使うぞ（いま残り${left}枚）。`;
  else ticketMsg = 'チケットが無いので、おぬし自身のAIでバトンを受け取るんじゃ（チケットは使わん）。';

  const open = async (id: string, url: string, label: string) => {
    // 先にコピー（その場で写す）→ 待たずに別タブを開く（待つとポップアップとして止められることがある）→ チケットを使う
    const copying = copyText(draft.letter);
    openedAt.current = Date.now();
    autoWent.current = false;
    window.open(url, '_blank', 'noopener');
    props.onOpen(id);
    setMsg({ ai: label, copied: await copying });
  };

  return (
    <section>
      <Hakase>水筒を持って相談しておいで。</Hakase>
      <div className="bottle-status">
        <Bottle rounds={draft.rounds} level={5} />
        <span data-testid="bottle-label">水筒 満タン（{draft.rounds}回分）</span>
      </div>
      <HintLine testId="hint-bottle" text="AIが話を忘れないうちに、まとめる目安のゲージじゃ。" onMore={props.onHelp} label="水筒のくわしい説明" />
      <p className="ticket-msg" data-testid="ticket-msg">{ticketMsg}</p>
      <p className="hint">ふだんよく使うAIがあれば、それがおすすめじゃな。AIに「記憶」の機能があれば、オンにしておくと、おぬしのことを覚えて答えてくれるぞ。</p>
      <div className="choices">
        {AI_SERVICES.map((ai) => (
          <button key={ai.id} type="button" className="btn-big btn-ai" onClick={() => open(ai.id, ai.url, ai.label)}>
            {ai.label} を開く
          </button>
        ))}
      </div>
      {msg && (
        <p className={msg.copied ? 'ok-text' : 'ng-text'} role="status">
          {msg.copied
            ? `紹介状をコピーして、${msg.ai}を別のタブで開いたぞ。開かなかったら、ブラウザのポップアップの設定を見ておくれ。`
            : `${msg.ai}を開いたが、コピーがうまくいかんかった。下の紹介状を長押し（または選んで）コピーしてから、貼り付けておくれ。`}
        </p>
      )}
      {msg && !msg.copied && (
        <div className="letter-paper">
          <pre className="letter-text" data-testid="letter">{draft.letter}</pre>
        </div>
      )}
      <div className="howto">
        <h3>貼り付け方</h3>
        <p className="hint">AIのボタンを押すと、紹介状は自動でコピーされるぞ。開いた画面に“貼り付け”て送るだけじゃ。</p>
        <div className="howto-grid">
          <div className="howto-card">
            <b>パソコン</b>
            <ol>
              <li>AIの入力欄をクリック</li>
              <li><kbd>Ctrl</kbd> ＋ <kbd>V</kbd> を押す</li>
              <li>送信ボタン（↑ や ▶）を押す</li>
            </ol>
          </div>
          <div className="howto-card">
            <b>スマホ</b>
            <ol>
              <li>AIの入力欄を長押し</li>
              <li>「ペースト」（貼り付け）を押す</li>
              <li>送信ボタンを押す</li>
            </ol>
          </div>
        </div>
        <p className="hint">AIのアプリやサイトは、おぬし自身のアカウントで使うんじゃよ。</p>
      </div>
      {returned ? (
        <button type="button" className="btn-big btn-accent" onClick={props.onReturn}>相談から帰ってきた（持ち帰り画面へ）</button>
      ) : (
        msg && <p className="hint">AIでの相談が終わったら、このタブへ戻ってくるんじゃ。戻ると、自動で持ち帰りの画面に進むぞ。AIにログインしないで使うと、閉じたときに会話の履歴が消えることがある。最後の【持ち帰りメモ】を、忘れずにコピーして持ち帰るんじゃぞ。</p>
      )}
      <button type="button" className="btn-link" onClick={props.onBack}>もどる（紹介状へ）</button>
    </section>
  );
}

/* ⑦ 持ち帰り */
function Return({ onSave, onSaveContinue, onBack, onHelp }: { onSave: (summary: string, next: string) => void; onSaveContinue: (summary: string, next: string) => void; onBack: () => void; onHelp: () => void }) {
  const [summary, setSummary, clearSummary] = usePersistedText('summary');
  const [next, setNext, clearNext] = usePersistedText('next');
  const filled = !!summary.trim();
  const pasteHelp = '📋 この枠の中を長押しして「ペースト（貼り付け）」を押してください（パソコンはクリックして Ctrl＋V）';
  return (
    <section>
      <Hakase>
        {filled
          ? 'よしよし、しっかり受け取ったぞ！ あとは下の「ノートにしまう」ボタンを押せば、記録完了じゃ！'
          : 'おかえり！ 先生（AI）との相談はどうじゃったかな？ 下の大きな枠を長押し（パソコンはクリック）して、コピーしてきた「持ち帰りメモ」を貼り付けておくれ。'}
      </Hakase>
      <div className="bottle-status">
        <Bottle rounds={5} level={0} />
        <span data-testid="bottle-label">水筒が空になったぞ（おつかれさま！）</span>
      </div>
      <HintLine testId="hint-bottle" text="AIが話を忘れないうちに、まとめる目安のゲージじゃ。" onMore={onHelp} label="水筒のくわしい説明" />
      <label className="field-label" htmlFor="sum">先生の話のまとめ（持ち帰りメモ）</label>
      {!filled && <p className="paste-help" data-testid="paste-help">{pasteHelp}</p>}
      <textarea
        id="sum"
        className={`input area${filled ? '' : ' paste-box'}`}
        rows={7}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder={pasteHelp}
      />
      <label className="field-label" htmlFor="nx">次にやること（書かなくてもよいぞ）</label>
      <textarea id="nx" className="input area" rows={3} value={next} onChange={(e) => setNext(e.target.value)} placeholder="例：明日、表の合計を関数でやってみる" />
      <button type="button" className={`btn-big${filled ? ' attn' : ''}`} disabled={!filled} onClick={() => {
          clearSummary();
          clearNext();
          onSave(summary.trim(), next.trim());
        }}>
        ノートにしまう
      </button>
      <button type="button" className={`btn-big btn-soft${filled ? ' attn' : ''}`} disabled={!filled} onClick={() => {
          const sm = summary.trim();
          const nx = next.trim();
          clearSummary();
          clearNext();
          onSaveContinue(sm, nx);
        }}>
        ノートにしまって、新しい水筒でつづける
      </button>
      <button type="button" className="btn-link" onClick={onBack}>もどる（もう一度AIを開く・出発画面へ）</button>
    </section>
  );
}

/* ⑧ 相談ノート */
function Notes(props: {
  notes: Saved['notes'];
  flash: string;
  onAgain: (id: string) => void;
  onHome: () => void;
}) {
  return (
    <section>
      <Hakase>{props.flash || (props.notes.length ? 'これまでの相談ノートじゃ。読み返すと、案外ヒントがあるもんじゃよ。' : 'まだノートは空っぽじゃ。相談したら、ここにしまっておくぞ。')}</Hakase>
      <p className="room-intro" data-testid="hint-notes">相談役と一緒に見つけた「行動への第一歩」をしまっておくノートじゃ。</p>
      <h2 className="q-title">相談ノート（{props.notes.length}件）</h2>
      <ul className="notes">
        {props.notes.map((n) => (
          <li key={n.id} className="note-card" data-testid="note">
            <div className="note-head">
              <span>{n.date.replace(/-/g, '/')}</span>
              <span className="tag">{findField(n.fieldId)?.label ?? 'その他'}</span>
            </div>
            <p className="note-summary">{n.summary}</p>
            {n.next && (
              <p className="note-next"><b>次にやること：</b>{n.next}</p>
            )}
            <details>
              <summary>紹介状を見る</summary>
              <pre className="letter-text small">{n.letter}</pre>
            </details>
            <button type="button" className="btn-small" onClick={() => props.onAgain(n.id)}>もう一度相談する</button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-big btn-soft" onClick={props.onHome}>書斎へ戻る</button>
    </section>
  );
}
