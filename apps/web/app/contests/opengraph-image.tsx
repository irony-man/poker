import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse } from '@/lib/ogImage';

export const runtime = 'edge';
export const alt = 'Texas Hold\'em contests and tournaments on pokr.site';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return ogImageResponse(
    'Contests & tournaments',
    "Knockout freezeouts and fixed-round Hold'em — free competitive play",
  );
}
