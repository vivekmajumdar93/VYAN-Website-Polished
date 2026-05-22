// /vistara/<product-key> — opens the interactive Vistāra demo slab
// while the cosmic canvas keeps rendering the product's NanoOrb behind it.
import { notFound } from 'next/navigation';
import VistaraProductDemo from '../VistaraProductDemo';

const VALID_PRODUCTS = ['ritam', 'ojas', 'mudra', 'netra', 'akriti', 'sutra', 'placeholder'] as const;
type ValidProduct = typeof VALID_PRODUCTS[number];
const VALID_SET = new Set<string>(VALID_PRODUCTS);

export function generateStaticParams() {
  return VALID_PRODUCTS.map(product => ({ product }));
}

export const dynamicParams = false;

export default function VistaraProductPage({ params }: { params: { product: string } }) {
  if (!VALID_SET.has(params.product)) notFound();
  return <VistaraProductDemo productKey={params.product as ValidProduct} />;
}

export const metadata = { title: 'Vistāra Product' };
