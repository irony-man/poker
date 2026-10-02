export interface User {
  id: string;
  /** Stored with original casing; unique case-insensitively. */
  username: string;
  /** Display name — always equals username. */
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  /** Viewer table felt theme preset (0–8). */
  tableColorId: number;
  /** Playing card face theme id from site config. */
  cardThemeId: string;
  /** App chrome look: Classic (`v1`), Arcade (`v2`), or Glass (`v3`). */
  uiTheme: 'v1' | 'v2' | 'v3';
  /** Table layout: Classic oval (`v1`) or stacked HUD (`v2`). */
  tableLayout: 'v1' | 'v2';
  /** Mute table SFX (deal / action / win). */
  sfxMuted: boolean;
  /** Remappable table keyboard shortcuts (full map after clamp). */
  keyboardShortcuts: Record<string, string>;
  /** Null for accounts that only sign in with Google. */
  passwordHash: string | null;
  /** Recovery email (original casing). */
  email: string | null;
  /** Only verified emails receive reset links or auto-link Google sign-ins. */
  emailVerified: boolean;
  /** Linked Google account subject id. */
  googleSub: string | null;
  /** Global play-money balance (chips). */
  chipBalance: number;
  /** Contest ranking rating (Whuffies); not spendable. */
  whuffieBalance: number;
  /** Completed online hands this user was dealt into. */
  handsPlayed: number;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  tableColorId: number;
  createdAt: number;
  chipBalance: number;
  whuffieBalance: number;
}

export interface WsTicket {
  ticket: string;
  userId: string;
  expiresAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface AuthSessionPayload {
  userId: string;
  username: string;
  name: string;
  ticket: string;
  sessionToken: string;
  avatarId: number;
  avatarUrl: string | null;
  chipBalance: number;
  whuffieBalance: number;
}

export type EmailTokenPurpose = 'verify_email' | 'reset_password';

export interface EmailToken {
  tokenHash: string;
  userId: string;
  purpose: EmailTokenPurpose;
  email: string;
  expiresAt: number;
  usedAt: number | null;
}

/** Identity claims taken from a verified Google ID token. */
export interface GoogleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export type GoogleSignInResult =
  | { kind: 'session'; session: AuthSessionPayload; created: boolean }
  | { kind: 'needs_username'; suggestedUsername: string };

export type AuthErrorCode =
  | 'username_taken'
  | 'invalid_credentials'
  | 'invalid_username'
  | 'email_taken'
  | 'google_taken'
  | 'password_required'
  | 'invalid_token';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
