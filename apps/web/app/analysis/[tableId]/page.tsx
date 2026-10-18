'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AnalysisScreen } from '@/features/analysis/AnalysisScreen';

function AnalysisTablePage() {
  const params = useParams<{ tableId: string }>();
  const searchParams = useSearchParams();
  const tableId = params.tableId ? decodeURIComponent(params.tableId) : '';
  const sinceRaw = Number(searchParams.get('since'));
  const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : undefined;

  return (
    <AnalysisScreen
      key={`${tableId}:${since ?? ''}`}
      tableId={tableId}
      since={since}
      requestCoach={searchParams.get('coach') === '1'}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading…" />}>
      <AnalysisTablePage />
    </Suspense>
  );
}
