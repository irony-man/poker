'use client';

import Image from 'next/image';
import Link from 'next/link';

export function HomeLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex w-full flex-col gap-0">
      {/* Hero fills first viewport */}
      <section className="lobby-fade-up grid min-h-[calc(100dvh-5.5rem)] items-center gap-10 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-2 lg:gap-14">
        <div className="min-w-0">
          <h1 className="font-serif text-[clamp(2.4rem,5.5vw,4.25rem)] leading-[1.02] tracking-tight text-ink-strong">
            Private tables.
            <br />
            Real stakes.
            <br />
            No fluff.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-strong-muted sm:text-lg">
            POKR is No-Limit Texas Hold&apos;em for home games — host a private cash table, jump in
            with a code, grind public seats, or practice offline against bots.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/host" className="btn-primary min-h-11 px-6 inline-flex items-center">
              Host a table
            </Link>
            <Link
              href="/public"
              className="inline-flex min-h-11 items-center rounded-md border border-sidebar/25 bg-transparent px-6 py-2.5 font-display font-semibold uppercase tracking-wider text-ink-strong transition hover:border-sidebar/50 hover:bg-sidebar/5"
            >
              Browse public
            </Link>
            {!signedIn && (
              <Link
                href="/sign-in"
                className="inline-flex min-h-11 items-center px-3 text-sm font-display font-semibold uppercase tracking-wider text-ink-strong-muted underline-offset-4 hover:text-ink-strong hover:underline"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
        <div className="relative hidden min-h-[18rem] overflow-hidden rounded-xl bg-sidebar/5 sm:block lg:min-h-[28rem]">
          <Image
            src="/home-table.png"
            alt="Poker table with chips and cards"
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      <section className="lobby-fade-up lobby-fade-up-delay-1 border-t border-sidebar/10 py-14 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <h2 className="font-serif text-3xl tracking-tight text-ink-strong sm:text-4xl lg:text-5xl">
              Host private cash games
            </h2>
            <p className="mt-4 max-w-lg text-ink-strong-muted leading-relaxed text-base sm:text-lg">
              Pick stakes, seats, and optional bots. Share a short room code so friends sit at your
              table — no casino lobby, just your night.
            </p>
            <Link
              href="/host"
              className="mt-6 inline-block text-sm font-display font-bold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
            >
              Open host controls →
            </Link>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-sidebar/5 lg:aspect-[5/3]">
            <Image
              src="/home-cards.png"
              alt="Playing cards on a felt table"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="lobby-fade-up lobby-fade-up-delay-2 border-t border-sidebar/10 py-14 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-2 aspect-[16/10] overflow-hidden rounded-xl bg-sidebar/5 lg:order-1 lg:aspect-[5/3]">
            <Image
              src="/home-contest.png"
              alt="Tournament style poker scene"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <h2 className="font-serif text-3xl tracking-tight text-ink-strong sm:text-4xl lg:text-5xl">
              Join by code or public seat
            </h2>
            <p className="mt-4 max-w-lg text-ink-strong-muted leading-relaxed text-base sm:text-lg">
              Enter an invite, spectate a friend, or scan open public tables. Friends who are already
              seated show up so you can jump into their game.
            </p>
            <div className="mt-6 flex flex-wrap gap-5">
              <Link
                href="/join"
                className="text-sm font-display font-bold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
              >
                Join with code →
              </Link>
              <Link
                href="/public"
                className="text-sm font-display font-bold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
              >
                Public tables →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="lobby-fade-up lobby-fade-up-delay-3 border-t border-sidebar/10 py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-ink-strong sm:text-4xl lg:text-5xl">
              Contests &amp; offline arena
            </h2>
            <p className="mt-4 max-w-lg text-ink-strong-muted leading-relaxed text-base sm:text-lg">
              Run structured contests with registration, or fire up local bots with no server — same
              engine, solo practice whenever you want.
            </p>
            <div className="mt-6 flex flex-wrap gap-5">
              <Link
                href="/contests"
                className="text-sm font-display font-bold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
              >
                Contests →
              </Link>
              <Link
                href="/solo"
                className="text-sm font-display font-bold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
              >
                Play offline →
              </Link>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                t: 'Blinds & deal',
                b: 'Small and big blinds post, then each player gets two hole cards.',
              },
              {
                t: 'Streets',
                b: 'Preflop → flop (3) → turn → river. Act when the timer lights your seat.',
              },
              {
                t: 'Actions',
                b: 'Fold, check, call, bet/raise, or go all-in. The pot grows with every bet.',
              },
              {
                t: 'Table tools',
                b: 'Host starts hands, sit out to skip, chat and voice, top up when broke.',
              },
            ].map((item) => (
              <div key={item.t} className="hud-panel p-4 sm:p-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-sidebar">
                  {item.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-strong-muted">{item.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
