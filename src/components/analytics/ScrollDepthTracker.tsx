'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { persistAnalyticsEvent } from '@/lib/track-analytics-event';

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

function isScrollDepthPage(pathname: string) {
  if (pathname === '/' || pathname.endsWith('/')) {
    return true;
  }

  return (
    /\/categorias\//u.test(pathname)
    || /\/equipamentos(?:\/|$)/u.test(pathname)
    || pathname.endsWith('/orcamento')
  );
}

function scrollPercent() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop;
  const viewport = window.innerHeight;
  const height = Math.max(doc.scrollHeight - viewport, 1);
  return Math.min(100, Math.round((scrollTop / height) * 100));
}

/**
 * Tracks scroll depth milestones (25/50/75/100%) on key marketing pages.
 */
export function ScrollDepthTracker() {
  const pathname = usePathname();
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
  }, [pathname]);

  useEffect(() => {
    if (!pathname || !isScrollDepthPage(pathname)) {
      return;
    }

    const handleScroll = () => {
      const current = scrollPercent();

      for (const milestone of SCROLL_MILESTONES) {
        if (current < milestone || firedRef.current.has(milestone)) {
          continue;
        }

        firedRef.current.add(milestone);
        persistAnalyticsEvent({
          eventType: 'scroll_depth',
          origin: `scroll_${milestone}`,
          pathname,
        });
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  return null;
}
