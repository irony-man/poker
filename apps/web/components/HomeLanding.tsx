import Image from 'next/image';
import Link from 'next/link';
import { HomeAuthFooter } from '@/components/HomeAuthFooter';

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
    title: 'Play Contests',
    body: "Knockout tables with no buy-in, where you play until your stack is gone, and fixed-hand games where you choose how many deals run before anyone looks at a card and buy in again whenever you need more Wuffies.",
    cta: 'Browse Contests',
    href: '/contests',
    image: '/home-knockout.png',
    imageAlt: 'Stylish player holding pocket cards at a green felt table',
    imageFirst: true,
  },
  {
    title: 'Open Tables',
    body: "Hold'em that runs the way a home game does, no set number of hands and no cap on buy-ins, so you can add Wuffies whenever your stack runs low and leave when the night feels done.",
    cta: 'Join a Table',
    href: '/join',
    image: '/poker-chip-shuffle.svg',
    imageAlt: 'POKR Wuffies stacking for a fixed-round session',
    imageFirst: false,
  },
  {
    title: 'Community and Social',
    body: 'Add friends by username, gather them into groups for the different circles you play with, and pull a group straight to a table when it is time to deal.',
    cta: 'Play with Friends',
    href: '/friends',
    image: '/home-host.png',
    imageAlt: 'Gloved hand holding a branded Wuffie token',
    imageFirst: true,
  },
  {
    title: 'Challenge 1v1',
    body: 'When you only want one opponent, open your friends list, choose the person, and send a challenge that leaves the table to the two of you and the board between you.',
    cta: 'Challenge a Friend',
    href: '/friends',
    image: '/home-challenge.png',
    imageAlt: 'Two players in a heads-up challenge',
    imageFirst: false,
  },
  {
    title: 'Offline arena',
    body: "Play Hold'em against bots with no connection. Practice lines and timing offline, then jump into live modes when you're ready.",
    cta: 'Offline',
    href: '/solo',
    image: '/home-offline.png',
    imageAlt: 'Stack of red and white Wuffies',
    imageFirst: true,
  },
];

export function HomeLanding() {
  return (
    <div className="mx-auto w-full mt-32 max-w-5xl pb-12 pt-2 sm:pb-20 sm:pt-4 lg:pt-6">
      <div className="flex flex-col gap-16 sm:gap-20 lg:gap-28">
        {FEATURES.map((feature, i) => (
          <FeatureRow key={feature.title} feature={feature} index={i} />
        ))}
      </div>

      <HomeAuthFooter />
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
            unoptimized={feature.image.endsWith('.svg')}
            className="object-contain object-center drop-shadow-[0_12px_28px_rgb(29_4_50/0.12)]"
            sizes="(max-width: 1024px) 80vw, 38vw"
            priority={index === 0}
          />
        </div>
      </div>

      <div className={`min-w-0 text-center sm:text-left ${textOrder}`}>
        <h2 className="font-display text-[clamp(1.85rem,3.8vw,2.85rem)] font-bold leading-[1.1] tracking-tight text-ink-strong">
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
