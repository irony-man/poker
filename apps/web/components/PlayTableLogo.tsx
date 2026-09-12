'use client';

import Image from 'next/image';
import { imageAssetUrl } from '@/lib/assets';
import { useUiTheme } from '@/lib/useUiTheme';

/** Brand mark for play chrome — dark logo on light ground, light logo on Glass dusk. */
export function PlayTableLogo() {
  const theme = useUiTheme();
  const onDark = theme === 'v3';

  return (
    <Image
      src={onDark ? imageAssetUrl('pokr-logo.png') : '/purple-logo.png'}
      alt="POKR"
      width={140}
      height={40}
      className={onDark ? 'play-table-logo mix-blend-screen' : 'play-table-logo'}
      priority
    />
  );
}
