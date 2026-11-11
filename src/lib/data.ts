// 博士のセリフ・分野・選択肢など、決まった文章はすべてここにまとめる。
// 文章を直したいときは、このファイルだけを直せばよい。

/** 博士の絵。本番の絵ができたら public/img/ に置き、ここのファイル名を変える。 */
export const HAKASE_IMAGE = 'img/hakase.svg';

/** 1か月に配る相談チケットの枚数 */
export const TICKETS_PER_MONTH = 4;

/** 水筒の往復数（初期値は最初のもの） */
export const ROUND_CHOICES = [5, 10] as const;
export type Rounds = (typeof ROUND_CHOICES)[number];

export type Field = {
  id: string;
  label: string;
  /** 紹介状の配役 */
  role: string;
  /** Q2・Q3 の入力例ボタン */
  q2Examples: string[];
  q3Examples: string[];
};

// 指示書 #1：Q1の分野と専門家配役（7分野）
export const FIELDS: Field[] = [
  {
    id: 'dandori',
    label: '仕事のこと',
    role: '仕事の段取り・業務改善にくわしい先生',
    q2Examples: ['やることが多くて、何から手をつければいいかわからない', '毎週同じ作業に時間がかかっている'],
    q3Examples: ['毎日の段取りがすっきり決まる', '作業時間を半分にしたい'],
  },
  {
    id: 'shorui',
    label: '書類・文章',
    role: 'わかりやすい文章・書類作成のプロ',
    q2Examples: ['お客さんへのメールの書き方に毎回迷う', '報告書がうまくまとまらない'],
    q3Examples: ['失礼のない文章をすぐ書けるようになりたい', '読みやすい報告書を作りたい'],
  },
  {
    id: 'shirabe',
    label: '調べもの',
    role: '調査・情報整理の専門家',
    q2Examples: ['調べたいことがあるが、どう調べればいいかわからない', '情報が多すぎて整理できない'],
    q3Examples: ['大事な点だけをまとめて知りたい', '比べやすい表にしたい'],
  },
  {
    id: 'pc',
    label: 'パソコン・Excel',
    role: 'パソコンやExcelをやさしく教える先生',
    q2Examples: ['Excelの集計を手作業でやっていて時間がかかる', 'パソコンの操作で毎回つまずく'],
    q3Examples: ['ボタンひとつで集計できるようにしたい', '自分ひとりで操作できるようになりたい'],
  },
  {
    id: 'kimochi',
    label: '気持ち・人間関係',
    role: '話をじっくり聞いて整理するカウンセラー',
    q2Examples: ['職場の人とのやりとりで気疲れしている', 'もやもやしていて気持ちが整理できない'],
    q3Examples: ['気持ちを少し軽くしたい', '相手にうまく伝える言い方を知りたい'],
  },
  {
    id: 'kurashi',
    label: '暮らし・お金',
    role: '暮らしの知恵や生活相談のアドバイザー',
    q2Examples: ['家計のやりくりを見直したい', '手続きのやり方がよくわからない'],
    q3Examples: ['毎月の出費を少し減らしたい', '何を準備すればいいか分かるようになりたい'],
  },
  {
    id: 'sonota',
    label: 'その他',
    role: 'なんでも一緒に考える相談役',
    q2Examples: ['うまく言えないけれど、困っていることがある', '新しく始めたいことがある'],
    q3Examples: ['話しながら考えを整理したい', '最初の一歩を決めたい'],
  },
];

export const findField = (id?: string) => FIELDS.find((f) => f.id === id);

/** Q4 どこで止まっておる？ */
export const STUCK_CHOICES = ['何から始めればいいか', 'やり方がわからない', '時間がない', '決められない'];

/** Q5 答えの好み → 紹介状に書く文 */
export const PREF_CHOICES: { label: string; text: string }[] = [
  { label: '短く', text: '返事は短く、要点だけにしてください。' },
  { label: 'くわしく', text: '返事はくわしく、順を追って説明してください。' },
  { label: '例をたくさん', text: '具体的な例をたくさん入れて説明してください。' },
];

/** Q5 AIの経験 → 紹介状に書く文 */
export const EXP_CHOICES: { label: string; text: string }[] = [
  { label: 'はじめて', text: 'AIに相談するのは、はじめてです。' },
  { label: '少し使った', text: 'AIは少し使ったことがあります。' },
  { label: 'よく使う', text: 'AIはふだんからよく使っています。' },
];

/** 聞き取りの各問いで、博士がうつあいづち */
export const AIZUCHI: Record<string, string> = {
  q1: 'ふむふむ。どんなことで困っておるか、まずは大まかに教えてくれんか。',
  q2: 'なるほどのう。もう少しだけ、くわしく教えてくれんか。',
  q3: 'それは大変じゃったのう。では、どうなったらうれしいかのう？',
  q4: 'うむうむ。今はどこで止まっておるんじゃ？',
  q5: 'よしよし、あと少しじゃ。答えの好みと、AIの経験を教えておくれ。',
};

// 指示書 #1：世間話（5往復）
export type TalkChoice = { label: string; action: 'next' | 'trouble' | 'home' };
export const TROUBLE_LABEL = '実はちょっと困ったことが…';
export const SMALL_TALK: { hakase: string; choices: TalkChoice[] }[] = [
  {
    hakase: 'いつもお疲れさまじゃ。最近の調子はどうじゃ？',
    choices: [
      { label: 'まあまあ順調', action: 'next' },
      { label: 'バタバタ忙しかった', action: 'next' },
      { label: 'ちょっと疲れた', action: 'next' },
    ],
  },
  {
    hakase: 'そうかそうか。ちゃんと息抜きはできておるかの？',
    choices: [
      { label: '休めてるよ', action: 'next' },
      { label: 'あんまり休めてない', action: 'next' },
      { label: '好きなことして過ごしてる', action: 'next' },
    ],
  },
  {
    hakase: '無理は禁物じゃぞ。温かいお茶でも飲んで一息つくのが一番じゃ。',
    choices: [
      { label: 'ありがとう', action: 'next' },
      { label: '博士も気をつけてね', action: 'next' },
    ],
  },
  {
    hakase: 'おぬしのそういう優しいところ、わしは好きじゃよ。何か気になることはあるかの？',
    choices: [
      { label: 'のんびり話したいだけじゃよ', action: 'next' },
      { label: TROUBLE_LABEL, action: 'trouble' },
    ],
  },
  {
    hakase: '話せて楽しかったぞ。またいつでも来るんじゃぞ！',
    choices: [{ label: 'また来るね（書斎へ戻る）', action: 'home' }],
  },
];

export type AiService = { id: string; label: string; url: string };
export const AI_SERVICES: AiService[] = [
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/new' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
];

/** 展示用「見本の相談者で試す」で入れる内容（架空の人物） */
export const SAMPLE = {
  name: 'まさる',
  answers: {
    fieldId: 'pc',
    q2: '毎月の在庫の表をExcelで手作業で集計していて、半日かかってしまう',
    q3: '1時間くらいで終わらせて、早く帰れるようになりたい',
    stuck: 'やり方がわからない',
    pref: '例をたくさん',
    exp: 'はじめて',
  },
};
