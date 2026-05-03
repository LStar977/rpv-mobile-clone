import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Represent — Verified civic voting for cities and citizens',
  description:
    'Represent is the infrastructure layer for verified public consensus. Run identity-verified votes that cities can act on, and let residents weigh in from their phone.',
  openGraph: {
    title: 'Represent',
    description: 'Verified civic voting. For cities and the people who live in them.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#040707',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="grain bg-ink text-bone min-h-[100dvh] antialiased">
        {children}
      </body>
    </html>
  );
}
