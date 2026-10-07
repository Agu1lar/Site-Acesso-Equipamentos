import { posthog } from 'posthog-js';

let initialized = false;

/**
 * Initializes PostHog in the browser when public key is configured.
 */
export function initPostHog() {
  if (typeof window === 'undefined' || initialized) {
    return;
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return;
  }

  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true,
      },
    });

    initialized = true;
  } catch (error) {
    console.debug('PostHog init failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Returns the PostHog client when initialized.
 */
export function getPostHog() {
  if (!initialized) {
    return null;
  }
  return posthog;
}
