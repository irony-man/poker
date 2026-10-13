import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse } from '@/lib/ogImage';

export const runtime = 'edge';
export const alt = 'Host or join a private Texas Hold\'em table on pokr.site';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return ogImageResponse(
    'Host or join a table',
    "Private No-Limit Hold'em with an invite code — free on pokr.site",
  );
}
