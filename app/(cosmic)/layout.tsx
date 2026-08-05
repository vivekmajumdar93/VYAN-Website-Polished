import CosmicCanvas from './CosmicCanvas';
import EdgeSwipeNav from './EdgeSwipeNav';
import SoundConsole from './SoundConsole';
import NebulaFooter from './NebulaFooter';
import NavikaOrbVideo from '@/components/navika/NavikaOrbVideo';

export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      {/* Nāvika — self-positioned (fixed, z:250); slides to right corner when panels open */}
      <NavikaOrbVideo size={88} />
      <SoundConsole />
      <EdgeSwipeNav />
      {children}
      <NebulaFooter />
    </>
  );
}
