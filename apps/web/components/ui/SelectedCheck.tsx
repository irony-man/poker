/** Visible selected-state cue so radio cards are not color-only. */
export function SelectedCheck({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full bg-sidebar text-mushroom shadow-sm ${className}`.trim()}
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
