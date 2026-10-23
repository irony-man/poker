'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AnalysisScreen } from '@/features/analysis/AnalysisScreen';
import { PkAnalysis } from '@/components/pk/analysis/PkAnalysis';
import { usePokerV2 } from '@/lib/pokerV2';

function AnalysisTablePage() {
  const params = useParams<{ tableId: string }>();
  const searchParams = useSearchParams();
  const pokerV2 = usePokerV2('analysis');
  const tableId = params.tableId ? decodeURIComponent(params.tableId) : '';
  const sinceRaw = Number(searchParams.get('since'));
  const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : undefined;

  if (pokerV2) return <PkAnalysis tableId={tableId} />;

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
