import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

export type ClerkIdentity = {
  userId: string;
};

/** True when the poker server should require Clerk JWTs for online play. */
export function clerkAuthRequired(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim());
}

/**
 * Verify `Authorization: Bearer <Clerk session JWT>`.
 * Returns the Clerk `sub` (user id) when valid.
 */
export async function requireClerkIdentity(req: Request): Promise<ClerkIdentity | null> {
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
