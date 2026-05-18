import CosmicCanvas from './CosmicCanvas';

// Shared layout for /vyoma and /shunya/* — mounts the Three.js canvas ONCE.
// Child pages just signal which realm to show via window.__vyan.
export default function CosmicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicCanvas />
      {/* children are server components that signal route intent; they render nothing visible */}
      {children}
    </>
  );
}
