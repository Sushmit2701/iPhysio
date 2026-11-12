import { registerSW as reg } from 'virtual:pwa-register';

/** Register the service worker. autoUpdate: a new version activates on the next launch. */
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  reg({ immediate: true });
}
