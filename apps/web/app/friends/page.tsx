'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';

/** Friends hub lives on the profile Friends tab. */
export default function FriendsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile?tab=friends');
  }, [router]);

  return <LoadingScreen label="Opening friends…" />;
}
