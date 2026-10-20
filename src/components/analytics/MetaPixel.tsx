'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { captureMetaPageView, canTrackMetaPixel } from '@/lib/meta-pixel';

/** Load Meta only after consent, and record client-side marketing navigation. */
export function MetaPixel() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    captureMetaPageView(pathname);
    setReady(canTrackMetaPixel());
  }, [pathname]);

  if (!ready || !canTrackMetaPixel()) { return null; }
  return (
    <Script
      id="acesso-meta-pixel"
      src="https://connect.facebook.net/en_US/fbevents.js"
      strategy="afterInteractive"
    />
  );
}
