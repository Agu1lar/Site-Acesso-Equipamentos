'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type AnalyticsErrorBoundaryProps = {
  children: ReactNode;
};

type AnalyticsErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Prevents analytics failures (PostHog, One Tap, trackers) from breaking the page.
 */
export class AnalyticsErrorBoundary extends Component<
  AnalyticsErrorBoundaryProps,
  AnalyticsErrorBoundaryState
> {
  override state: AnalyticsErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // React requires this lifecycle hook to be an instance method.
  // eslint-disable-next-line class-methods-use-this
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.debug('Analytics bundle error:', error.message, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}
