'use client'

// medha-lair.mp4 (gazebo) is kept in /public/assets but not used here.
// medha-entity.mp4 is the sole video for the Medhā scene.

export function MedhaLair() {
  return (
    <video
      src="/assets/medha-entity.mp4"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        // cover fills every screen size; object-position keeps subject centred
        objectFit: 'cover',
        objectPosition: 'center center',
        zIndex: 3,
        pointerEvents: 'none',
      }}
    />
  )
}
