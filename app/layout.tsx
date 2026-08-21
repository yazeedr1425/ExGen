import type { Metadata } from 'next';
import { Geist, Geist_Mono, Caveat } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: ['600'], variable: '--font-hand', display: 'swap' });

export const metadata: Metadata = {
  title: 'Extgen — prompt to Chrome extension',
  description: 'Describe an extension in plain English and get a working Manifest V3 build.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
