import CosmicCanvas from './CosmicCanvas';
import EdgeSwipeNav from './EdgeSwipeNav';
import SoundConsole from './SoundConsole';
import NebulaFooter from './NebulaFooter';
import NavikaOrbWidget from '@/components/navika/NavikaOrbWidget';

export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      <NavikaOrbWidget />
      <SoundConsole />
      <EdgeSwipeNav />
      {children}
      <NebulaFooter />
    </>
  );
}
