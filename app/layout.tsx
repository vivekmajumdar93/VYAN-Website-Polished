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
        {/* Preload critical font weights so text is never invisible on first paint */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/VYANShunyalekh-Regular.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/VYANShunyalekh-Bold.woff2" crossOrigin="anonymous" />
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
