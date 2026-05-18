import LoaderClient from './LoaderClient';

// Phase 1 root: cinematic VYAN logo loader → /vyoma
// Server-rendered shell, hands off to client for the GSAP timeline.
export default function Page() {
  return <LoaderClient />;
}
