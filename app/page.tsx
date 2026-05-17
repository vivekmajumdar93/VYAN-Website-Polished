import dynamic from 'next/dynamic'
import HUD from '@/components/galaxy/HUD'

const GalaxyScene = dynamic(() => import('@/components/galaxy/GalaxyScene'), { ssr: false })

export default function Page() {
  return (
    <main className="fixed inset-0 w-screen h-screen bg-black">
      <GalaxyScene />
      <HUD />
    </main>
  )
}
