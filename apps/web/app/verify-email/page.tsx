'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { verifyEmail } from '@/lib/api';

type State =
  | { kind: 'pending' }
  | { kind: 'done'; email: string | null }
  | { kind: 'error'; message: string };

function VerifyEmailStatus() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>({ kind: 'pending' });
  // Tokens are single-use; never submit the same one twice (e.g. React dev double effects).
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This link is missing its token.' });
      return;
    }
    if (submitted.current === token) return;
    submitted.current = token;
    verifyEmail(token)
      .then(({ email }) => setState({ kind: 'done', email }))
      .catch((err: unknown) =>
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not confirm email',
        }),
      );
  }, [token]);

  if (state.kind === 'pending') return <LoadingScreen compact label="Confirming…" />;

  return (
    <div className="surface-card-lg flex flex-col gap-4">
      {state.kind === 'done' ? (
        <Notice
          tone="positive"
          role="status"
          title={state.email ? `${state.email} is confirmed` : 'Email confirmed'}
        >
          You can now use it to reset your password.
        </Notice>
      ) : (
        <Notice tone="danger" role="alert" title={state.message}>
          Send a new confirmation link from your profile.
        </Notice>
      )}
      <Button href="/profile" className="min-h-11 w-full">
        Go to profile
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="lobby-page-intro mx-auto w-full max-w-md">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-title-page">Confirm email</h1>
      </div>
      <Suspense fallback={<LoadingScreen compact label="Loading…" />}>
        <VerifyEmailStatus />
      </Suspense>
    </div>
  );
}
