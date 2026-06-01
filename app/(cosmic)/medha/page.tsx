import { Suspense } from 'react';
import MedhaHUD from './MedhaHUD';

export const metadata = { title: 'Medhā — The Consciousness of VYAN' };

export default function MedhaPage() {
  return (
    <Suspense>
      <MedhaHUD />
    </Suspense>
  );
}
