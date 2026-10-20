import { PRODUCTION_API_URL, PRODUCTION_WS_URL, resolveEndpoints } from './env';

describe('resolveEndpoints', () => {
  it('falls back to pokr.site', () => {
    expect(resolveEndpoints({})).toEqual({
      apiUrl: PRODUCTION_API_URL,
      wsUrl: PRODUCTION_WS_URL,
    });
  });

  it('strips a trailing slash from the API URL and keeps an explicit websocket URL', () => {
    expect(
      resolveEndpoints({
        EXPO_PUBLIC_API_URL: 'http://10.0.2.2:4000/',
        EXPO_PUBLIC_WS_URL: 'ws://10.0.2.2:4000/ws',
      }),
    ).toEqual({
      apiUrl: 'http://10.0.2.2:4000',
      wsUrl: 'ws://10.0.2.2:4000/ws',
    });
  });
});
