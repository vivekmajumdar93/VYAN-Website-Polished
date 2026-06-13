'use client'
import { useRouter } from 'next/navigation'
import { VistaraVoid } from '@/components/vistara/VistaraVoid'

export default function VistaraPage() {
  const router = useRouter()
  return <VistaraVoid onBack={() => router.push('/shunya')} />
}
