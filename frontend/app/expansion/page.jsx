'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ExpansionMap from '@/components/ExpansionMap';

function ExpansionMapWithParams() {
  const searchParams = useSearchParams();
  const rentParam = searchParams.get('rent');
  const prefillRent = rentParam && !isNaN(Number(rentParam)) ? Number(rentParam) : null;
  return <ExpansionMap prefillRent={prefillRent} />;
}

export default function ExpansionPage() {
  return (
    <Suspense>
      <ExpansionMapWithParams />
    </Suspense>
  );
}
