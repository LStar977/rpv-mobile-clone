import type { Metadata, Viewport } from 'next';
import { Onest, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Represent — Verified public consensus',
  description: 'Your city wants to know what you think. Verified voices, cryptographically recorded on Base.',
  openGraph: {
    title: 'Represent',
    description: 'Verified public consensus. Recorded on Base.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#040707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${onest.variable} ${jetbrains.variable}`}>
      <body className="font-display bg-ink text-paper min-h-screen">
        {children}
      </body>
    </html>
  );
}
