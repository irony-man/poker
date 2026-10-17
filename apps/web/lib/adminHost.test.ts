import { describe, expect, it } from 'vitest';
import { adminBasePath, adminHomeHref, adminHostRoute, requestHost } from './adminHost';

const opts = {
  adminUrl: 'https://admin.pokr.site',
  adminHost: 'admin.pokr.site',
  siteUrl: 'https://pokr.site',
};

describe('adminHostRoute', () => {
  it('does nothing when no admin subdomain is configured', () => {
    const off = { adminUrl: '', adminHost: '', siteUrl: 'https://pokr.site' };
    expect(adminHostRoute('pokr.site', '/admin', '?tab=economy', off)).toEqual({ kind: 'next' });
  });

  it('rewrites the admin host root to the admin page', () => {
    expect(adminHostRoute('admin.pokr.site', '/', '?tab=economy', opts)).toEqual({
      kind: 'rewrite',
      pathname: '/admin',
    });
  });

  it('sends /admin on the admin host to the clean root, keeping the query', () => {
    expect(adminHostRoute('admin.pokr.site', '/admin', '?tab=bots', opts)).toEqual({
      kind: 'redirect',
      url: 'https://admin.pokr.site/?tab=bots',
      permanent: false,
    });
  });

  it('lets sign-in pages through on the admin host', () => {
    expect(adminHostRoute('admin.pokr.site', '/sign-in', '', opts)).toEqual({ kind: 'next' });
    expect(adminHostRoute('admin.pokr.site', '/forgot-password', '', opts)).toEqual({
      kind: 'next',
    });
    expect(adminHostRoute('admin.pokr.site', '/reset-password', '?token=x', opts)).toEqual({
      kind: 'next',
    });
  });

  it('sends other admin-host paths to the main site', () => {
    expect(adminHostRoute('admin.pokr.site', '/play', '?mode=join', opts)).toEqual({
      kind: 'redirect',
      url: 'https://pokr.site/play?mode=join',
      permanent: false,
    });
    expect(adminHostRoute('admin.pokr.site', '/sign-up', '', opts)).toEqual({
      kind: 'redirect',
      url: 'https://pokr.site/sign-up',
      permanent: false,
    });
  });

  it('permanently redirects /admin on the main site to the admin host', () => {
    expect(adminHostRoute('pokr.site', '/admin', '?tab=economy', opts)).toEqual({
      kind: 'redirect',
      url: 'https://admin.pokr.site/?tab=economy',
      permanent: true,
    });
    expect(adminHostRoute('pokr.site', '/admin/x', '', opts)).toEqual({
      kind: 'redirect',
      url: 'https://admin.pokr.site/',
      permanent: true,
    });
  });

  it('leaves main-site paths that only start with "admin" alone', () => {
    expect(adminHostRoute('pokr.site', '/administrator', '', opts)).toEqual({ kind: 'next' });
    expect(adminHostRoute('pokr.site', '/play', '', opts)).toEqual({ kind: 'next' });
  });
});

describe('requestHost', () => {
  it('prefers the first forwarded host and lowercases it', () => {
    expect(requestHost('Admin.Pokr.site, proxy', 'web:3000')).toBe('admin.pokr.site');
    expect(requestHost(null, 'pokr.site')).toBe('pokr.site');
    expect(requestHost(null, null)).toBe('');
  });
});

describe('admin links', () => {
  it('use the subdomain when configured', () => {
    expect(adminBasePath('admin.pokr.site')).toBe('/');
    expect(adminHomeHref('https://admin.pokr.site')).toBe('https://admin.pokr.site/');
  });

  it('fall back to /admin on the main site', () => {
    expect(adminBasePath('')).toBe('/admin');
    expect(adminHomeHref('')).toBe('/admin');
  });
});
