import dynamic from 'next/dynamic';

const VyanInterface = dynamic(
  () => import('@/components/vistara/VyanInterface'),
  { ssr: false },
);

export const metadata = { title: 'Vistāra · Gateway Interface' };

export default function VistāraInterfacePage() {
  return <VyanInterface />;
}
