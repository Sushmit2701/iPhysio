import { useEffect, useState } from 'react';

/** Tiny hash router: #/tab or #/tab/arg. Hash routing works on GitHub Pages without rewrites. */
export interface Route {
  tab: string;
  arg?: string;
}
const parse = (): Route => {
  const [tab, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { tab: tab || 'today', arg: arg ? decodeURIComponent(arg) : undefined };
};
export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => setR(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
export function go(tab: string, arg?: string, replace = false) {
  const h = `#/${tab}${arg ? '/' + encodeURIComponent(arg) : ''}`;
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
  window.scrollTo(0, 0);
}
