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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
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
