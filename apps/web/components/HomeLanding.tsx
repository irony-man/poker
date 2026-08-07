'use client';

import Image from 'next/image';
import Link from 'next/link';

type Feature = {
  title: string;
  body: string;
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
  /** Illustration on the left at desktop width (matches zigzag layout). */
  imageFirst: boolean;
};

const FEATURES: Feature[] = [
  {
    title: 'Knockout Tournaments',
    body: "Fixed buy-in Texas Hold'em on 4- or 8-player tables. Last player standing takes it all.",
    cta: 'Contests',
    href: '/contests',
    image: '/home-knockout.png',
    imageAlt: 'Player holding cards behind colorful chip stacks',
    imageFirst: true,
  },
  {
    title: 'Fixed round table plays',
    body: "Fixed-round Hold'em with a clear buy-in. Play the session; add chips when you need them and finish when the rounds end.",
    cta: 'Contests',
    href: '/contests',
    image: '/home-rounds.png',
    imageAlt: 'Stacks of colorful poker chips',
    imageFirst: false,
  },
  {
    title: 'Host a Private Table',
    body: 'Host a private table with your friends. Custom group names. Only people you invite can sit. Share a link and start dealing.',
    cta: 'Host',
    href: '/host',
    image: '/home-host.png',
    imageAlt: 'Hand holding a poker chip',
    imageFirst: true,
  },
  {
    title: 'Challenge 1v1',
    body: 'Challenge one player to a head-to-head duel—just you, them, and the board. No full table required.',
    cta: 'Friends',
    href: '/friends',
    image: '/home-challenge.png',
    imageAlt: 'Playing cards and gold coins',
    imageFirst: false,
  },
  {
    title: 'Offline arena',
    body: "Play Hold'em against bots with no connection. Practice lines and timing offline, then jump into live modes when you're ready.",
    cta: 'Offline',
    href: '/solo',
    image: '/home-offline.png',
    imageAlt: 'Stack of red and white poker chips',
    imageFirst: true,
  },
];

export function HomeLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto w-full max-w-5xl pb-12 pt-4 sm:pb-20 sm:pt-6 lg:pt-8">
      <div className="flex flex-col gap-16 sm:gap-20 lg:gap-28">
        {FEATURES.map((feature, i) => (
          <FeatureRow key={feature.title} feature={feature} index={i} />
        ))}
      </div>

      {!signedIn && (
        <p className="lobby-fade-up lobby-fade-up-delay-3 mt-16 text-center text-sm text-ink-strong-muted sm:mt-20">
          Ready to play?{' '}
          <Link
            href="/sign-in"
            className="font-display font-semibold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          {' · '}
          <Link
            href="/sign-up"
            className="font-display font-semibold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
          >
            Create account
          </Link>
        </p>
      )}
    </div>
  );
}

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const delayClass =
    index === 0
      ? ''
      : index === 1
        ? 'lobby-fade-up-delay-1'
        : index === 2
          ? 'lobby-fade-up-delay-2'
          : 'lobby-fade-up-delay-3';

  const imageOrder = feature.imageFirst ? 'order-1' : 'order-1 lg:order-2';
  const textOrder = feature.imageFirst ? 'order-2' : 'order-2 lg:order-1';

  return (
    <section
      className={`lobby-fade-up ${delayClass} grid items-center gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16`}
    >
      <div className={`relative mx-auto w-full max-w-[20rem] sm:max-w-sm lg:max-w-none ${imageOrder}`}>
        <div className="relative aspect-square w-full sm:aspect-[5/4]">
          <Image
            src={feature.image}
            alt={feature.imageAlt}
            fill
            className="object-contain object-center drop-shadow-[0_12px_28px_rgb(29_4_50/0.12)]"
            sizes="(max-width: 1024px) 80vw, 38vw"
            priority={index === 0}
          />
        </div>
      </div>

      <div className={`min-w-0 text-center sm:text-left ${textOrder}`}>
        <h2 className="font-serif text-[clamp(1.85rem,3.8vw,2.85rem)] leading-[1.1] tracking-tight text-ink-strong">
          {feature.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[0.98rem] leading-relaxed text-ink-strong-muted sm:mx-0 sm:mt-4 sm:text-lg">
          {feature.body}
        </p>
        <Link
          href={feature.href}
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-full bg-sidebar px-8 py-2.5 text-xs font-display font-bold uppercase tracking-[0.16em] text-mushroom shadow-[0_8px_22px_rgb(29_4_50/0.2)] transition duration-base ease-out hover:brightness-110 active:scale-[0.98] sm:mt-8"
        >
          {feature.cta}
        </Link>
      </div>
    </section>
  );
}
