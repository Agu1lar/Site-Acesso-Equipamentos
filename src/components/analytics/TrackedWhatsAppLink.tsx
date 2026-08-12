'use client';

import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { openTrackedWhatsApp } from '@/lib/track-whatsapp-click';

type TrackedWhatsAppLinkProps = ComponentPropsWithoutRef<'a'> & {
  origin: string;
  equipmentSlug?: string;
  equipmentName?: string;
};

/**
 * Inline WhatsApp anchor with click tracking. Opens in a new tab by default so
 * Ads conversion beacons are not cancelled by same-tab navigation to wa.me.
 */
export function TrackedWhatsAppLink(props: TrackedWhatsAppLinkProps) {
  const { origin, equipmentSlug, equipmentName, onClick, children, target, rel, href, ...rest } = props;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !href) {
      return;
    }

    event.preventDefault();
    void openTrackedWhatsApp(href, { origin, equipmentSlug, equipmentName });
  };

  return (
    <a
      {...rest}
      href={href}
      target={target ?? '_blank'}
      rel={rel ?? 'noopener noreferrer'}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
