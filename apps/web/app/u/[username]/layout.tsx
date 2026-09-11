import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username);
  return {
    title: handle,
    description: `${handle} on Pokr`,
  };
}

export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
