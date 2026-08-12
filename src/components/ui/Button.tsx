'use client';

import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { openTrackedWhatsApp } from '@/lib/track-whatsapp-click';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'whatsapp' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  href?: string;
  /** PostHog origin when variant is whatsapp with href */
  whatsappOrigin?: string;
  equipmentSlug?: string;
  equipmentName?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  secondary: 'bg-neutral-900 text-white hover:bg-neutral-800',
  outline:
    'border border-neutral-200 bg-surface text-neutral-800 hover:border-neutral-400 hover:bg-background-muted',
  whatsapp: 'bg-cta-whatsapp text-white font-bold shadow-md hover:bg-cta-whatsapp-hover hover:shadow-lg',
  ghost: 'text-neutral-700 hover:bg-neutral-100',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  href,
  whatsappOrigin,
  equipmentSlug,
  equipmentName,
  children,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if (href) {
    const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (variant === 'whatsapp' && whatsappOrigin) {
        event.preventDefault();
        void openTrackedWhatsApp(href, {
          origin: whatsappOrigin,
          equipmentSlug,
          equipmentName,
        });
      }
    };

    return (
      <a
        className={classes}
        href={href}
        onClick={variant === 'whatsapp' && whatsappOrigin ? handleAnchorClick : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        target={href.startsWith('http') ? '_blank' : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
