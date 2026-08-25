'use client'

import { usePathname } from 'next/navigation'
import AcousticConsole from '@/components/AcousticConsole'

export default function AcousticConsoleWrapper() {
  const pathname = usePathname()
  const realmId = pathname.includes('medha') ? 'medha'
    : pathname.includes('vistara') ? 'vistara'
    : 'shunya'
  return <AcousticConsole realmId={realmId} />
}
