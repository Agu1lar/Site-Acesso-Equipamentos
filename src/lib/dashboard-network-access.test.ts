import { describe, expect, it } from 'vitest';
import {
  isDashboardNetworkAllowed,
  resolveDashboardClientIp,
} from '@/lib/dashboard-network-access';

describe('Dashboard network access', () => {
  it('allows all networks when allowlist is absent', () => {
    expect(isDashboardNetworkAllowed(new Headers(), undefined)).toBe(true);
  });

  it('allows exact Vercel client IP', () => {
    const headers = new Headers({ 'x-vercel-forwarded-for': '201.77.171.177' });

    expect(isDashboardNetworkAllowed(headers, '201.77.171.177')).toBe(true);
  });

  it('blocks a client outside the allowlist', () => {
    const headers = new Headers({ 'x-vercel-forwarded-for': '203.0.113.20' });

    expect(isDashboardNetworkAllowed(headers, '201.77.171.177')).toBe(false);
  });

  it('prefers the Vercel header over forwarded fallback', () => {
    const headers = new Headers({
      'x-forwarded-for': '201.77.171.177',
      'x-vercel-forwarded-for': '203.0.113.20',
    });

    expect(resolveDashboardClientIp(headers)).toBe('203.0.113.20');
  });

  it('normalizes mapped IPv4 and exact host CIDR notation', () => {
    const headers = new Headers({ 'x-vercel-forwarded-for': '::ffff:201.77.171.177' });

    expect(isDashboardNetworkAllowed(headers, '201.77.171.177/32')).toBe(true);
  });

  it('blocks requests without a client IP when configured', () => {
    expect(isDashboardNetworkAllowed(new Headers(), '201.77.171.177')).toBe(false);
  });
});
