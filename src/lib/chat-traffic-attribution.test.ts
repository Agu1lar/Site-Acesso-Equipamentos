import { describe, expect, it } from 'vitest';
import { buildChatTrafficAttribution as build } from './chat-traffic-attribution';
describe('chat traffic evidence', () => {
  it('links Google clicks without disclosing their IDs', () => {
    const value = build({ gclid: 'private-click' });
    expect(value.channel).toBe('googleAds');
    expect(value.google_click_linked).toBe(true);
    expect(JSON.stringify(value)).not.toContain('private-click');
  });
  it('requires paid medium for Meta', () => {
    expect(build({ utmSource: 'facebook', utmMedium: 'paid_social' }).channel).toBe('metaAds');
    expect(build({ utmSource: 'facebook', referrer: 'https://facebook.com' }).channel).toBe('organic');
  });
  it('separates search, direct and external referrals', () => {
    expect(build({ referrer: 'https://www.google.com/' }).channel).toBe('organic');
    expect(build({ landingPage: '/' }).channel).toBe('direct');
    expect(build({ referrer: 'https://partner.example/' }).channel).toBe('referral');
  });
});
