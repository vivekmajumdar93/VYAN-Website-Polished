import CosmicCanvas from './CosmicCanvas';
import ConciergeOrb from './ConciergeOrb';
import EdgeSwipeNav from './EdgeSwipeNav';
import SoundConsole from './SoundConsole';

export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      <ConciergeOrb />
      <SoundConsole />
      <EdgeSwipeNav />
      {children}
    </>
  );
}
