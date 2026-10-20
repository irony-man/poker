'use client';

import { useEffect, useState } from 'react';
import { StatusChip } from '@/components/ui/StatusChip';
import { fetchCoachQuota, requestTableCoach, type CoachQuota } from '@/lib/api';

const coachInflight = new Map<string, Promise<CoachQuota & { cached: boolean }>>();

function requestTableCoachOnce(sessionToken: string, tableId: string) {
  const key = `${sessionToken}:${tableId}`;
  const existing = coachInflight.get(key);
  if (existing) return existing;
  const pending = requestTableCoach(sessionToken, tableId).finally(() => {
    coachInflight.delete(key);
  });
  coachInflight.set(key, pending);
  return pending;
}

function quotaLine(quota: CoachQuota | null): string | null {
  if (!quota) return null;
  if (quota.remaining === 0) return `No table coaching left today (${quota.limit} a day)`;
  return `${quota.remaining} of ${quota.limit} tables left today`;
}

/** Remaining coaching slots, shown above the table list. */
export function CoachQuotaNote({ sessionToken }: { sessionToken: string }) {
  const [quota, setQuota] = useState<CoachQuota | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchCoachQuota(sessionToken)
      .then((res) => {
        if (!cancelled) setQuota(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);
  const line = quotaLine(quota);
  if (!line) return null;
  return (
    <p className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sidebar ring-1 ring-inset ring-sidebar/12">
      {line}
    </p>
  );
}

/** Written review for one table. The model runs only after Analyse table. */
export function TableCoach({
  sessionToken,
  tableId,
  requestCoach,
  onReviews,
}: {
  sessionToken: string;
  tableId: string;
  requestCoach: boolean;
  onReviews: (reviews: Record<string, string>) => void;
}) {
  const [quota, setQuota] = useState<CoachQuota | null>(null);
  const [summary, setSummary] = useState('');
  const [coached, setCoached] = useState(false);
  const [coaching, setCoaching] = useState(requestCoach);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCoaching(requestCoach);
    setError(null);
    void (async () => {
      try {
        const quotaRes = await fetchCoachQuota(sessionToken, tableId);
        if (cancelled) return;
        setQuota(quotaRes);
        setSummary(quotaRes.summary);
        setCoached(Object.keys(quotaRes.reviews).length > 0 || quotaRes.summary.length > 0);
        onReviews(quotaRes.reviews);
        if (!requestCoach) return;
        const res = await requestTableCoachOnce(sessionToken, tableId);
        if (cancelled) return;
        setCoached(true);
        setQuota(res);
        setSummary(res.summary);
        onReviews(res.reviews);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Coaching failed');
      } finally {
        if (!cancelled) setCoaching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, tableId, requestCoach, onReviews]);

  const blocked = quota != null && quota.remaining === 0 && !coached;
  const line = quotaLine(quota);
  const daily = quota?.limit ?? 3;
  if (!coaching && !summary && !error && !blocked) return null;

  return (
    <section className="mb-5 rounded-2xl border border-sidebar/12 bg-white p-4 shadow-[0_4px_16px_rgb(29_4_50_/_0.04)] sm:p-5">
      <h2 className="font-heading-section">Table coach</h2>
      {line ? <p className="mt-2 text-xs font-semibold text-sidebar">{line}</p> : null}
      {coaching ? <p className="mt-3 text-sm text-muted">Reviewing this table…</p> : null}
      {blocked ? (
        <p className="mt-3 text-sm text-muted">
          You have coached {daily} tables today. This one can be coached tomorrow.
        </p>
      ) : null}
      {error ? (
        <StatusChip tone="danger" role="alert" className="mt-3 text-xs">
          {error}
        </StatusChip>
      ) : null}
      {summary ? (
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-sidebar/[0.05] p-3 text-sm leading-relaxed text-primary ring-1 ring-inset ring-sidebar/10">
          {summary}
        </p>
      ) : null}
    </section>
  );
}
