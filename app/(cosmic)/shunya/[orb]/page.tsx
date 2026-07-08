// /shunya/<orb-key> — deep link to a focused orb in the Shunya void.
import { notFound } from 'next/navigation';

const VALID_ORBS = new Set(['udbhava', 'vistara', 'vyuha', 'sankalpa', 'medha', 'sandhi']);

export function generateStaticParams() {
  return Array.from(VALID_ORBS).map(orb => ({ orb }));
}

export const dynamicParams = false;

export default async function ShunyaOrbPage({ params }: { params: Promise<{ orb: string }> }) {
  const { orb } = await params;
  if (!VALID_ORBS.has(orb)) notFound();
  return null;
}

export const metadata = { title: 'Shunya Mandala' };
