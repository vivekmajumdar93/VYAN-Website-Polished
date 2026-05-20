import CosmicCanvas from './CosmicCanvas';
import ConciergeOrb from './ConciergeOrb';
import SoundConsole from './SoundConsole';
import NetraConsole from './NetraConsole';

// Shared layout for /vyoma, /shunya/*, /vistara/*, /medha — mounts the Three.js
// canvas ONCE and persistently renders the Concierge Orb + Sound Console + Netra.
export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      <ConciergeOrb />
      <SoundConsole />
      <NetraConsole />
      {children}
    </>
  );
}
