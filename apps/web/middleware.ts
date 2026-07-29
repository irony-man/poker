import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** No auth gate — anyone can play with a callsign. */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
