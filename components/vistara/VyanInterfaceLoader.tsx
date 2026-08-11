'use client';
import dynamic from 'next/dynamic';

const VyanInterface = dynamic(
  () => import('./VyanInterface'),
  { ssr: false },
);

export default function VyanInterfaceLoader() {
  return <VyanInterface />;
}
