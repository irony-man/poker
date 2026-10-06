/** Visible selected-state cue so radio cards are not color-only. */
export function SelectedCheck({
  className = '',
  tone = 'default',
}: {
  className?: string;
  /** `inverse` sits on a primary-filled surface. */
  tone?: 'default' | 'inverse';
}) {
  // Not `text-sidebar`: selected choice cards flip nested `.text-sidebar` to on-chrome.
  const colors =
    tone === 'inverse' ? 'bg-on-chrome text-[rgb(var(--sidebar))]' : 'bg-sidebar text-on-chrome';
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full ${colors} shadow-sm ${className}`.trim()}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Selected</span>
    </span>
  );
}
