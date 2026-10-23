'use client';

import { useRouter } from 'next/navigation';
import type { AuthSession } from '@poker/protocol';
import { GoogleAuthPanel } from '@/components/GoogleAuthPanel';
import { authHref } from '@/lib/authRedirect';
import { gateLinks } from '@/lib/pk/gate';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';
import { PkButton, PkLinkButton } from './Button';
import { PkDialog, PkSheet } from './Overlay';

export function PkGate({
  open,
  title,
  body,
  next,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  next: string;
  onClose: () => void;
}) {
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const links = gateLinks(next);

  function finish(session: AuthSession) {
    const avatarId = session.avatarId ?? loadSavedAvatarId();
    const stored = { ...session, avatarId };
    setSession(stored);
    writeStoredSession(stored);
    saveAvatarId(avatarId);
    onClose();
    router.replace(links.next);
  }

  const content = (
    <div className="flex flex-col gap-pk-3">
      <p className="text-pk-body-md text-muted">{body}</p>
      <GoogleAuthPanel mode="sign-in" onSession={finish} returnTo={links.next} />
      <PkLinkButton href={authHref('sign-in', links.next)}>Sign in</PkLinkButton>
      <PkLinkButton href={links.signUp} variant="secondary">
        Create account
      </PkLinkButton>
      <PkButton variant="ghost" onClick={() => router.push(links.offline)}>
        Not now — play offline as a guest
      </PkButton>
    </div>
  );

  if (narrow || landscape) {
    return (
      <PkSheet open={open} title={title} onClose={onClose} side={landscape}>
        {content}
      </PkSheet>
    );
  }
  return (
    <PkDialog open={open} title={title} onClose={onClose}>
      {content}
    </PkDialog>
  );
}
