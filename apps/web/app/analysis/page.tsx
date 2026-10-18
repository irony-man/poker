'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AnalysisScreen } from '@/features/analysis/AnalysisScreen';

function AnalysisHome() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tableId = searchParams.get('table');

  useEffect(() => {
    if (!tableId) return;
    const params = new URLSearchParams();
    if (searchParams.get('coach') === '1') params.set('coach', '1');
    const since = searchParams.get('since');
    if (since) params.set('since', since);
    const qs = params.toString();
    router.replace(`/analysis/${encodeURIComponent(tableId)}${qs ? `?${qs}` : ''}`);
  }, [router, searchParams, tableId]);

  if (tableId) return <LoadingScreen label="Loading…" />;
  return <AnalysisScreen />;
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading…" />}>
      <AnalysisHome />
    </Suspense>
  );
}
