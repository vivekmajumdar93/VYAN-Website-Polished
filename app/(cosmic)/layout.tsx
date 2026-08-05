import CosmicCanvas from './CosmicCanvas';
import EdgeSwipeNav from './EdgeSwipeNav';
import SoundConsole from './SoundConsole';
import NebulaFooter from './NebulaFooter';
import NavikaOrbVideo from '@/components/navika/NavikaOrbVideo';

export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      {/* Nāvika — ambient presence, top-right, decorative only */}
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none' }}>
        <NavikaOrbVideo
          size={88}
          forwardSrc="/videos/navika-orb-forward.mp4"
          reversedSrc="/videos/navika-orb-reversed.mp4"
        />
      </div>
      <SoundConsole />
      <EdgeSwipeNav />
      {children}
      <NebulaFooter />
    </>
  );
}
