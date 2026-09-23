import { authHref, currentPathWithQuery } from '@/lib/authRedirect';
import { clearStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

let expiring = false;

/** Clear local auth after an invalid or expired session; optionally send user to sign-in. */
export function expireSession(options?: { redirect?: boolean }): void {
  if (typeof window === 'undefined') return;
  if (expiring) return;
  expiring = true;

  clearStoredSession();
  const state = useSession.getState();
  state.clearSession();
  state.setConnection('closed');
  state.setError(null);

  const redirect = options?.redirect ?? true;
  if (redirect) {
    const path = currentPathWithQuery();
    if (
      !path.startsWith('/sign-in') &&
      !path.startsWith('/sign-up')
    ) {
      window.location.assign(authHref('sign-in', path));
    }
  }
}

/** Test helper — allow another expire after sign-in in the same document. */
export function resetExpireSessionGuardForTests(): void {
  expiring = false;
}
