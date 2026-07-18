import './globals.css';
import type { Metadata, Viewport } from 'next';
import NetraConsole from './(cosmic)/NetraConsole';
import VersionPanel from '@/components/VersionPanel';

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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/vivekmajumdar93/VYAN-SHUNYALEKH@main/web/vyan-font.css" />
        {/* Preload the logo so the loader has it instantly */}
        <link rel="preload" as="image" href="/logo-symbol.png" />
      </head>
      <body>
        {children}
        <NetraConsole />
        <VersionPanel />
      </body>
    </html>
  );
}
