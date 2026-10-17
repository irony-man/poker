'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import {
  redeemFriendLink,
  resolveFriendLink,
  type FriendLinkOwner,
  type FriendLinkRedeemResult,
} from '@/lib/api';
import { authHref } from '@/lib/authRedirect';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'signed_out'; owner: FriendLinkOwner }
  | { kind: 'prompt'; owner: FriendLinkOwner }
  | { kind: 'own'; owner: FriendLinkOwner }
  | { kind: 'redeemed'; owner: FriendLinkOwner; result: FriendLinkRedeemResult }
  | { kind: 'declined'; owner: FriendLinkOwner }
  | { kind: 'error'; owner: FriendLinkOwner | null; message: string };

function resultCopy(result: FriendLinkRedeemResult, name: string): { title: string; body: string } {
  if (result === 'already_friends') {
    return { title: 'You are already friends', body: `${name} is already on your friends list.` };
  }
  return {
    title: `You and ${name} are now friends`,
    body: 'Challenge them to a table or add them to a group from your Friends page.',
  };
}

function OwnerCard({ owner, line }: { owner: FriendLinkOwner; line: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <PlayerAvatar
        userId={owner.userId}
        avatarId={owner.avatarId}
        avatarUrl={owner.avatarUrl}
        size={72}
        title={owner.name}
      />
      <p className="text-base font-semibold text-primary">{line}</p>
    </div>
  );
}

function currentToken(storeToken: string | null): string | null {
  return storeToken ?? readStoredSession()?.sessionToken ?? null;
}

export default function FriendLinkPage() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code ?? '');
  const storeToken = useSession((s) => s.sessionToken);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!code) {
      setState({ kind: 'invalid' });
      return;
    }
    let cancelled = false;
    const sessionToken = currentToken(storeToken);
    resolveFriendLink(code, sessionToken)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setState({ kind: 'invalid' });
          return;
        }
        const { owner, relationship } = data;
        if (!sessionToken) setState({ kind: 'signed_out', owner });
        else if (relationship === 'self') setState({ kind: 'own', owner });
        else if (relationship === 'friends') {
          setState({ kind: 'redeemed', owner, result: 'already_friends' });
        } else setState({ kind: 'prompt', owner });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          owner: null,
          message: err instanceof Error ? err.message : 'Could not load this invite',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [code, storeToken]);

  async function accept(owner: FriendLinkOwner) {
    const sessionToken = currentToken(storeToken);
    if (!sessionToken || accepting) return;
    setAccepting(true);
    try {
      const { result } = await redeemFriendLink(code, { sessionToken, silent: true });
      setState({ kind: 'redeemed', owner, result });
    } catch (err) {
      setState({
        kind: 'error',
        owner,
        message: err instanceof Error ? err.message : 'Could not accept this invite',
      });
    } finally {
      setAccepting(false);
    }
  }

  const returnTo = `/f/${encodeURIComponent(code)}`;

  return (
    <div className="lobby-page-intro mx-auto w-full max-w-md">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-title-page">Friend invite</h1>
      </div>
      {state.kind === 'loading' ? (
        <LoadingScreen compact label="Loading invite…" />
      ) : (
        <div className="surface-card-lg flex flex-col gap-5">
          {state.kind === 'invalid' ? (
            <>
              <Notice tone="danger" role="alert" title="This invite link is not valid">
                Ask your friend to send their link again.
              </Notice>
              <Button href="/" className="min-h-11 w-full">
                Go to Pokr
              </Button>
            </>
          ) : null}

          {state.kind === 'signed_out' ? (
            <>
              <OwnerCard
                owner={state.owner}
                line={`${state.owner.name} invited you to be friends on Pokr`}
              />
              <p className="text-center text-sm text-muted">
                Create a free account or sign in to accept the invite.
              </p>
              <div className="flex flex-col gap-2">
                <Button href={authHref('sign-up', returnTo)} className="min-h-11 w-full">
                  Create account
                </Button>
                <Button
                  href={authHref('sign-in', returnTo)}
                  variant="ghost"
                  className="min-h-11 w-full"
                >
                  Sign in
                </Button>
              </div>
            </>
          ) : null}

          {state.kind === 'prompt' ? (
            <>
              <OwnerCard
                owner={state.owner}
                line={`${state.owner.name} wants to be friends on Pokr`}
              />
              <p className="text-center text-sm text-muted">
                Accept to add {state.owner.name} to your friends, so you can challenge each other
                and share tables.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  disabled={accepting}
                  onClick={() => setState({ kind: 'declined', owner: state.owner })}
                  className="min-h-11 w-full"
                >
                  Decline
                </Button>
                <Button
                  disabled={accepting}
                  onClick={() => void accept(state.owner)}
                  className="min-h-11 w-full"
                >
                  {accepting ? 'Accepting…' : 'Accept'}
                </Button>
              </div>
            </>
          ) : null}

          {state.kind === 'own' ? (
            <>
              <OwnerCard owner={state.owner} line="This is your own friend link" />
              <p className="text-center text-sm text-muted">
                Share it with friends. When they open it and accept, you become friends.
              </p>
              <Button href="/friends" className="min-h-11 w-full">
                Go to Friends
              </Button>
            </>
          ) : null}

          {state.kind === 'redeemed' ? (
            <>
              <OwnerCard
                owner={state.owner}
                line={resultCopy(state.result, state.owner.name).title}
              />
              <p className="text-center text-sm text-muted">
                {resultCopy(state.result, state.owner.name).body}
              </p>
              <Button href="/friends" className="min-h-11 w-full">
                Go to Friends
              </Button>
            </>
          ) : null}

          {state.kind === 'declined' ? (
            <>
              <OwnerCard owner={state.owner} line="Invite declined" />
              <p className="text-center text-sm text-muted">
                Nothing was sent to {state.owner.name}. You can open the link again any time.
              </p>
              <Button href="/friends" className="min-h-11 w-full">
                Go to Friends
              </Button>
            </>
          ) : null}

          {state.kind === 'error' ? (
            <>
              {state.owner ? (
                <OwnerCard owner={state.owner} line={state.message} />
              ) : (
                <Notice tone="danger" role="alert" title={state.message} />
              )}
              <Button href="/friends" className="min-h-11 w-full">
                Go to Friends
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
