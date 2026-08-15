import { Button } from '@/components/ui/Button';
import { choiceOptionClass, choiceTrackClass } from '@/components/ui/choiceStyles';
import type { CopyTheme } from '@/lib/api';

const LOOKS: { id: CopyTheme; label: string }[] = [
  { id: 'v1', label: 'Classic' },
  { id: 'v2', label: 'Arcade' },
];

export function CopyThemeSwitcher({
  value,
  disabled,
  onChange,
  onCopyFromOther,
}: {
  value: CopyTheme;
  disabled?: boolean;
  onChange: (theme: CopyTheme) => void;
  onCopyFromOther: () => void;
}) {
  const otherLabel = value === 'v2' ? 'Classic' : 'Arcade';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className={choiceTrackClass('segmented', 'w-full max-w-xs')} role="radiogroup" aria-label="Look">
        {LOOKS.map((look) => {
          const selected = value === look.id;
          return (
            <button
              key={look.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(look.id)}
              className={choiceOptionClass('segmented', selected)}
            >
              {look.label}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={onCopyFromOther}
        className="min-h-9 px-4 text-xs"
      >
        Copy from {otherLabel}
      </Button>
    </div>
  );
}
