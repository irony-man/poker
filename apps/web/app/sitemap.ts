import type { MetadataRoute } from 'next';
import { SITE_URL, SITEMAP_LAST_MODIFIED } from '@/lib/site';

const routes: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
  priority: number;
}[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/solo', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/host', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/contests', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/public', changeFrequency: 'weekly', priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: SITEMAP_LAST_MODIFIED,
    changeFrequency,
    priority,
  }));
}
