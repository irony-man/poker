import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from './Button';
import { cn } from '@/lib/cn';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size, title, children, className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size ?? (children ? 'md' : 'icon')}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'flex min-w-0 flex-row items-center justify-center gap-2 whitespace-nowrap',
        className,
      )}
      {...props}
    >
      {icon}
      {children ? <span className="min-w-0 truncate">{children}</span> : null}
    </Button>
  );
});
