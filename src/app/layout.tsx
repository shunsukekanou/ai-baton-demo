import type { Metadata, Viewport } from 'next';
import './globals.css';

const TITLE = 'AI-Baton バトン博士の紹介状';
const DESCRIPTION = 'バトン博士が話を聞いて紹介状を書き、あなたのAIへ相談のバトンを渡します。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // LINE などにURLを貼ったときの表示（題名・説明）
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', locale: 'ja_JP', siteName: 'AI-Baton' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6efe3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
