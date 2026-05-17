import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Procedural Galaxy',
  description: 'Interactive WebGL galaxy built with React Three Fiber',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white overflow-hidden">{children}</body>
    </html>
  )
}
