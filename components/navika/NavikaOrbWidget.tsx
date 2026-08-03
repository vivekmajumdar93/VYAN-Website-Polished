'use client';

import { useRef } from 'react';
import Navika from './Navika';

/**
 * Drop-in replacement for the old static/DOM Navika orb in the top-right
 * of the Medhā chrome (above the settings button). Same slot, same size
 * envelope — now a living creature instead of a static graphic.
 *
 * No click handler, no chat, no buttons on the orb itself — purely
 * ambient presence per spec. If the corner previously opened something
 * on click, move that trigger to a separate control; don't wire it here.
 */
export default function NavikaOrbWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        width: 88,
        height: 88,
        zIndex: 40,
        pointerEvents: 'none', // orb is decorative; never intercepts clicks
      }}
    >
      <Navika standalone containerRef={containerRef} />
    </div>
  );
}
