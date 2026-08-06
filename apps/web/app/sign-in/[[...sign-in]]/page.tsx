import { redirect } from 'next/navigation';

/** Play is callsign-only — no Clerk gate. Keep route for old bookmarks. */
export default function SignInPage() {
  redirect('/');
}
