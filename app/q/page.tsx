'use client'

import { useRouter } from 'next/navigation'
import { QuantumGrid } from '@/components/vistara/QuantumGrid'

export default function QuantumPage() {
  const router = useRouter()
  return <QuantumGrid onBack={() => router.push('/shunya')} />
}
