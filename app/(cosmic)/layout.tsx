import CosmicCanvas from './CosmicCanvas';
import ConciergeOrb from './ConciergeOrb';
import EdgeSwipeNav from './EdgeSwipeNav';

// Shared layout for /vyoma, /shunya/*, /vistara/*, /medha — mounts the Three.js
// canvas ONCE and persistently renders the Concierge Orb + edge swipe nav.
// (NetraConsole is mounted in the root layout so it works site-wide.)
// (Sound Console is the in-canvas "SOUND OFF" button on the top-left — the
//  duplicate React SoundConsole was removed to keep only one.)
export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      <ConciergeOrb />
      <EdgeSwipeNav />
      {children}
    </>
  );
}
