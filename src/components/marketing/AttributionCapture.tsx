'use client';

import { useEffect } from 'react';
import { captureAttributionFirstTouch } from '@/lib/attribution';
import { enableEssentialAdsMeasurementForPaidVisit } from '@/lib/google-analytics';

/**
 * Stores first-touch campaign attribution and enables essential Ads measurement for paid clicks.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttributionFirstTouch();
    enableEssentialAdsMeasurementForPaidVisit();
  }, []);

  return null;
}
