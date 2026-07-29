import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

export type ClerkIdentity = {
  userId: string;
};

/**
 * Verify `Authorization: Bearer <Clerk session JWT>` when `CLERK_SECRET_KEY` is set.
 * Returns the Clerk `sub` (user id) when valid; otherwise null.
 * Online play does not require a Clerk token — callsign registration is enough.
 */
export async function optionalClerkIdentity(req: Request): Promise<ClerkIdentity | null> {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) return null;

  const header = req.header('authorization') ?? req.header('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return null;

  try {
    const payload = await verifyToken(match[1], { secretKey });
    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

/** @deprecated Prefer optionalClerkIdentity — auth is no longer required for play. */
export const requireClerkIdentity = optionalClerkIdentity;

/** @deprecated Always false for play; kept so older call sites compile. */
export function clerkAuthRequired(): boolean {
  return false;
}
