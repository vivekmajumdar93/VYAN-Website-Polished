import CosmicCanvas from './CosmicCanvas';
import ConciergeOrb from './ConciergeOrb';
import SoundConsole from './SoundConsole';

// Shared layout for /vyoma, /shunya/*, /vistara/*, /medha — mounts the Three.js
// canvas ONCE and persistently renders the Concierge Orb + Sound Console.
export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      <ConciergeOrb />
      <SoundConsole />
      {children}
    </>
  );
}
