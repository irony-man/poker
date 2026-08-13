import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export function IconAction({
  label,
  disabled,
  tone,
  onClick,
  children,
  className = '',
}: {
  label: string;
  disabled?: boolean;
  tone: 'primary' | 'ghost';
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      variant={tone}
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={className}
    >
      {children}
    </Button>
  );
}

function iconProps(className?: string) {
  return {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: ['h-4 w-4 shrink-0', className].filter(Boolean).join(' '),
    'aria-hidden': true as const,
  };
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Enter / join a shared table or contest. */
export function JoinTableIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H3" />
    </svg>
  );
}

/** 1v1 challenge — crossed swords. */
export function ChallengeIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
      <path d="m5 14 4 4" />
      <path d="m7 17-3 3" />
      <path d="m3 19 2 2" />
    </svg>
  );
}

/** Remove from friends list. */
export function RemoveFriendIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

/** Invite group of friends around a table. */
export function InviteTableIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
