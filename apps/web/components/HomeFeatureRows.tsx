import Image from 'next/image';
import Link from 'next/link';
import type { HomeLandingFeature } from '@/lib/api';
import { resolvePublicImage } from '@/lib/assets';

export function HomeFeatureRows({ features }: { features: HomeLandingFeature[] }) {
  return (
    <div className="flex flex-col gap-16 sm:gap-20 lg:gap-28">
      {features.map((feature, i) => (
        <FeatureRow key={`${feature.title}-${i}`} feature={feature} index={i} />
      ))}
    </div>
  );
}

function FeatureRow({ feature, index }: { feature: HomeLandingFeature; index: number }) {
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
      <div
        className={`relative mx-auto w-full max-w-[20rem] sm:max-w-sm lg:max-w-none ${imageOrder}`}
      >
        <div className="relative aspect-square w-full sm:aspect-[5/4]">
          <Image
            src={resolvePublicImage(feature.image)}
            alt={feature.imageAlt}
            fill
            unoptimized={feature.image.endsWith('.svg')}
            className="object-contain object-center drop-shadow-[0_12px_28px_rgb(var(--ds-brand-ink)/0.12)]"
            sizes="(max-width: 1024px) 80vw, 38vw"
            priority={index === 0}
          />
        </div>
      </div>

      <div className={`min-w-0 text-center sm:text-left ${textOrder}`}>
        <h2 className="font-display text-[clamp(1.85rem,3.8vw,2.85rem)] font-bold leading-[1.1] tracking-tight text-primary">
          {feature.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[0.98rem] leading-relaxed text-muted sm:mx-0 sm:mt-4 sm:text-lg">
          {feature.body}
        </p>
        <Link
          href={feature.href}
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-full bg-sidebar px-8 py-2.5 text-xs font-display font-bold uppercase tracking-[0.16em] text-on-chrome shadow-[0_8px_22px_rgb(var(--ds-brand-ink)/0.2)] transition duration-base ease-out hover:brightness-110 active:scale-[0.98] sm:mt-8"
        >
          {feature.cta}
        </Link>
      </div>
    </section>
  );
}
