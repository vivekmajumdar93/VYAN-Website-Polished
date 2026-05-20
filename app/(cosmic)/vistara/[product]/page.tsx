// /vistara/<product-key> — deep link to a focused product in the Vistāra sub-void.
import { notFound } from 'next/navigation';

const VALID_PRODUCTS = new Set(['ritam', 'ojas', 'mudra', 'netra', 'akriti', 'sutra', 'placeholder']);

export function generateStaticParams() {
  return Array.from(VALID_PRODUCTS).map(product => ({ product }));
}

export const dynamicParams = false;

export default function VistaraProductPage({ params }: { params: { product: string } }) {
  if (!VALID_PRODUCTS.has(params.product)) notFound();
  return null;
}

export const metadata = { title: 'Vistāra Product' };
