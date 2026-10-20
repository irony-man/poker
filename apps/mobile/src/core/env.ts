/** Same origin the web app uses. REST is /api on this host; the socket is /ws. */
export const PRODUCTION_API_URL = 'https://pokr.site';
export const PRODUCTION_WS_URL = 'wss://pokr.site/ws';

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function resolveEndpoints(env: {
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_WS_URL?: string;
}): { apiUrl: string; wsUrl: string } {
  const api = env.EXPO_PUBLIC_API_URL?.trim();
  const ws = env.EXPO_PUBLIC_WS_URL?.trim();
  return {
    apiUrl: stripTrailingSlash(api ? api : PRODUCTION_API_URL),
    wsUrl: ws ? ws : PRODUCTION_WS_URL,
  };
}

const resolved = resolveEndpoints({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_WS_URL: process.env.EXPO_PUBLIC_WS_URL,
});

export const API_URL = resolved.apiUrl;
export const WS_URL = resolved.wsUrl;
