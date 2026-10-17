import { HOME_FAQ_ITEMS } from '@/lib/site';

export function HomeFaq() {
  return (
    <section
      className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:px-6 sm:pb-24"
      aria-labelledby="home-faq-heading"
    >
      <h2
        id="home-faq-heading"
        className="font-display text-center text-2xl font-bold tracking-tight text-primary sm:text-3xl"
      >
        Frequently asked questions
      </h2>
      <ul className="mt-8 flex flex-col gap-3">
        {HOME_FAQ_ITEMS.map((item) => (
          <li key={item.question}>
            <details className="group rounded-2xl border border-primary/10 bg-surface/60 px-4 py-3 sm:px-5">
              <summary className="cursor-pointer list-none font-medium text-primary marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.question}
                  <span
                    className="text-muted transition group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{item.answer}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
