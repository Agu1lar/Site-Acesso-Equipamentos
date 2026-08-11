'use client';

import { useEffect } from 'react';
import { captureAttributionFirstTouch, restorePaidClickIdsToLocationSearch } from '@/lib/attribution';
import { preparePaidSearchAdsConversion } from '@/lib/google-analytics';

/**
 * Stores first-touch campaign attribution and enables essential Ads measurement for paid clicks.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttributionFirstTouch();
    restorePaidClickIdsToLocationSearch();
    preparePaidSearchAdsConversion();
  }, []);

  return null;
}
