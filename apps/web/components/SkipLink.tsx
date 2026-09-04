/** Visually hidden until focused — WCAG 2.4.1 bypass blocks. */
export function SkipLink({ href = '#main-content' }: { href?: string }) {
  return (
    <a href={href} className="skip-link">
      Skip to content
    </a>
  );
}
