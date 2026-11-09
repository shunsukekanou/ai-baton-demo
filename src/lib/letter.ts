// 紹介状（そのまま外部AIへ貼るプロンプト）を組み立てる。
import { EXP_CHOICES, PREF_CHOICES, findField, type Rounds } from './data';
import type { Answers } from './storage';

export function buildLetter(name: string, a: Answers, rounds: Rounds): string {
  const field = findField(a.fieldId);
  const role = field?.role ?? 'なんでも一緒に考える相談役';
  const pref = PREF_CHOICES.find((p) => p.label === a.pref)?.text ?? '';
  const exp = EXP_CHOICES.find((e) => e.label === a.exp)?.text ?? '';
  const who = name ? `${name}さん` : '相談者';

  return [
    '【バトン博士からの紹介状】',
    '',
    `あなたは「${role}」です。`,
    `これから${who}の相談に乗ってください。`,
    '',
    '■ 相談者の様子',
    `・困っている分野：${field?.label ?? '（未選択）'}`,
    `・困っていること：${a.q2 || '（未記入）'}`,
    `・こうなったらうれしい：${a.q3 || '（未記入）'}`,
    `・止まっているところ：${a.stuck ?? '（未選択）'}`,
    `・AIの経験：${a.exp ?? '（未選択）'}　${exp}`,
    `・答えの好み：${a.pref ?? '（未選択）'}　${pref}`,
    '',
    '■ 水筒のルール（大切）',
    `・この相談は ${rounds}往復 までです（往復＝相談者が1回送り、あなたが1回返事をすること。この紹介状が1往復目です）。`,
    `・毎回の返事の最初に「水筒 残り ○/${rounds}」と書いてください。最初の返事は「水筒 残り ${rounds - 1}/${rounds}」で、返事のたびに1つずつ減らします。`,
    '・残りが0になる最後の返事では、見出しを「【持ち帰りメモ】」として、①相談の要約 ②次にやること3つ をまとめてください。',
    '・相談者が途中で「まとめて」と言ったら、残りに関係なく【持ち帰りメモ】を書いてください。',
    '',
    '■ 話し方のお願い',
    '・やさしい言葉で話し、専門用語を使うときは、かんたんな説明をつけてください。',
    '・最初の返事では、まず相談者の気持ちを受け止める一言を添え、わからない点があれば質問を1〜2個だけしてください。',
    '・一度にたくさんのことを言わず、すぐ試せる小さな一歩を大切にしてください。',
  ].join('\n');
}
