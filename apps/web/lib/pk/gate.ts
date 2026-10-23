import { authHref, safeReturnPath } from '@/lib/authRedirect';

/** Sign-in and sign-up links for the poker gate, with a same-origin `next`. */
export function gateLinks(next: string): { signIn: string; signUp: string; offline: string; next: string } {
  const path = safeReturnPath(next, '/');
  return {
    next: path,
    signIn: authHref('sign-in', path),
    signUp: authHref('sign-up', path),
    offline: '/solo',
  };
}
