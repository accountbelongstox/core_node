import { useEffect, useState } from 'react';

/** Height and top offset of the visible viewport (shrinks with the soft keyboard
 *  on mobile browsers and the Capacitor WebView); window size when unsupported. */
export function useWfNewVisualViewport(active: boolean): { height: number; offsetTop: number } {
  const read = () => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    return vv
      ? { height: vv.height, offsetTop: vv.offsetTop }
      : { height: typeof window !== 'undefined' ? window.innerHeight : 0, offsetTop: 0 };
  };
  const [viewport, setViewport] = useState(read);

  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const update = () => setViewport(read());
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);

  return viewport;
}
