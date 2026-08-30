import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:'校招迹 · 校招投递进度',
  description:'在本地安全记录校招投递、面试进度与个人求职资料。',
  openGraph:{ title:'校招迹', description:'每一次投递，都在靠近理想工作。', images:['/og.png'] },
  twitter:{ card:'summary_large_image', title:'校招迹', description:'每一次投递，都在靠近理想工作。', images:['/og.png'] },
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="zh-CN"><body>{children}</body></html> }
