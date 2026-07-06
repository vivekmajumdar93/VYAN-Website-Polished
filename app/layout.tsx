import './globals.css';
import type { Metadata, Viewport } from 'next';
import NetraConsole from './(cosmic)/NetraConsole';

export const metadata: Metadata = {
  title: 'VYAN Shunya Mandala — Architecting the Liquid Infinite',
  description: 'A cosmic multiverse by VYAN Technologies — Vyōma, Shunya, Vistāra, Medhā.',
  icons: { icon: '/logo.png' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Preload the logo so the loader has it instantly */}
        <link rel="preload" as="image" href="/logo.png" />
      </head>
      <body>
        {children}
        <NetraConsole />
      </body>
    </html>
  );
}
