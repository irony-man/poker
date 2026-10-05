import type { MetadataRoute } from 'next';
import { isHrefHiddenByLobbyNav } from '@poker/protocol';
import { fetchLobbyNav } from '@/lib/lobbyNavServer';
import { SITE_URL, SITEMAP_LAST_MODIFIED } from '@/lib/site';

const routes: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
  priority: number;
}[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/solo', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/play', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contests', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/public', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/ludo', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/arcade', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/snakes', changeFrequency: 'monthly', priority: 0.55 },
  { path: '/memory', changeFrequency: 'monthly', priority: 0.55 },
  { path: '/courtpiece', changeFrequency: 'monthly', priority: 0.55 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lobbyNav = await fetchLobbyNav(revalidate);
  return routes
    .filter(({ path }) => !isHrefHiddenByLobbyNav(lobbyNav, path))
    .map(({ path, changeFrequency, priority }) => ({
      url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
      lastModified: SITEMAP_LAST_MODIFIED,
      changeFrequency,
      priority,
    }));
}
