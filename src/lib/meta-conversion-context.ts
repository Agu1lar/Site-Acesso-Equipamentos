import { canTrackMetaPixel } from '@/lib/meta-pixel';
import { captureMetaClickContext } from '@/lib/meta-click-context';

/** Reads matching cookies only after the visitor accepts analytics and advertising. */
export function readMetaConversionContext() {
  if (!canTrackMetaPixel() || typeof document === 'undefined') { return undefined; }
  const cookies = new Map(document.cookie.split(';').map(item => {
    const [name, ...value] = item.trim().split('=');
    return [name, value.join('=')];
  }));
  const valid = (value: string | undefined) => value && /^fb\.\d+\.\d+\.[\w.-]+$/.test(value) ? value : undefined;
  return { consent: true as const, fbp: valid(cookies.get('_fbp')), fbc: captureMetaClickContext() };
}
