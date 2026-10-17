import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse } from '@/lib/ogImage';

export const runtime = 'edge';
export const alt = "POKR — Play free Texas Hold'em online";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return ogImageResponse(
    "Play free Texas Hold'em online",
    'Private tables, contests, and offline practice — free on pokr.site',
  );
}
