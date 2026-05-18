import VyomaClient from './VyomaClient';

export const metadata = {
  title: 'Vyōma — VYAN Gateway',
  description: 'The cosmic gateway. Vyōma orb pulses at the threshold of the multiverse.'
};

// Server shell. The 3D scene lives entirely in the client component below.
export default function VyomaPage() {
  return <VyomaClient />;
}
