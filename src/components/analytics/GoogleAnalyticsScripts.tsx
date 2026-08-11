import Script from 'next/script';
import { getGaMeasurementId, getGoogleAdsId, getGtagBootstrapId } from '@/lib/google-analytics';

/**
 * Loads gtag.js with Consent Mode defaults (denied until user accepts analytics).
 * Configures GA4 and/or Google Ads when env vars are set.
 */
export function GoogleAnalyticsScripts() {
  const bootstrapId = getGtagBootstrapId();
  const gaId = getGaMeasurementId();
  const adsId = getGoogleAdsId();
  if (!bootstrapId) {
    return null;
  }

  const configLines = [
    gaId ? `gtag('config', '${gaId}', { send_page_view: false });` : null,
    adsId ? `gtag('config', '${adsId}');` : null,
  ]
    .filter(Boolean)
    .join('\n          ');

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${bootstrapId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          try {
            if (window.localStorage.getItem('acesso_cookie_consent') === 'analytics') {
              gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'denied'
              });
            } else {
              var search = window.location.search || '';
              var paidAds = /[?&](gclid|gbraid|wbraid|gad_source)=/.test(search);
              if (!paidAds) {
                try {
                  var raw = window.sessionStorage.getItem('acesso_attribution');
                  if (raw) {
                    var attr = JSON.parse(raw);
                    paidAds = !!(attr && (attr.gclid || attr.gbraid || attr.wbraid));
                  }
                } catch (e2) {}
              }
              if (paidAds) {
                gtag('consent', 'update', {
                  ad_storage: 'granted',
                  ad_user_data: 'granted',
                  ad_personalization: 'denied'
                });
              }
            }
          } catch (e) {}
          gtag('js', new Date());
          ${configLines}
        `}
      </Script>
    </>
  );
}
