import Link from 'next/link';
import { SITE_DESCRIPTION, SITE_TITLE_DEFAULT } from '@/lib/site';

export function HomeHero() {
  return (
    <header className="mx-auto w-full max-w-5xl px-4 pt-28 text-center sm:px-6 sm:py-32 lg:pt-36 lg:pb-24">
      <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-primary">
        {SITE_TITLE_DEFAULT}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg">
        {SITE_DESCRIPTION}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
        <Link
          href="/play"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-sidebar px-8 py-2.5 text-xs font-display font-bold uppercase tracking-[0.16em] text-on-chrome shadow-[0_8px_22px_rgb(var(--ds-brand-ink)/0.2)] transition duration-base ease-out hover:brightness-110 active:scale-[0.98]"
        >
          Host a table
        </Link>
        <Link
          href="/play?mode=join"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/20 bg-surface/80 px-8 py-2.5 text-xs font-display font-bold uppercase tracking-[0.16em] text-primary transition duration-base ease-out hover:border-primary/35 active:scale-[0.98]"
        >
          Join with code
        </Link>
      </div>
    </header>
  );
}
