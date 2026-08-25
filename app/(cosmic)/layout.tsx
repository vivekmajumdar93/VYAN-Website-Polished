import CosmicCanvas from './CosmicCanvas';
import EdgeSwipeNav from './EdgeSwipeNav';
import NebulaFooter from './NebulaFooter';
import NavikaOrbVideo from '@/components/navika/NavikaOrbVideo';
import AcousticConsoleWrapper from '@/components/AcousticConsoleWrapper';

export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      {/* Nāvika — self-positioned (fixed, z:250); slides to right corner when panels open */}
      <NavikaOrbVideo size={88} />
      <AcousticConsoleWrapper />
      <EdgeSwipeNav />
      {children}
      <NebulaFooter />
    </>
  );
}
