import { useEffect, useState } from 'react';
import { ensureStatic, peekStatic, type WfNewStaticKind } from '../runtime-store/WfNewStaticCache';

const REMOTE_URL_RE = /^https?:\/\//i;

/**
 * The device library's copy of a remote static file (runtime-store/WfNewStaticCache): a held file is shown from the
 * device, a missing one is fetched once and kept. Undefined while the lookup runs; the remote URL itself when the
 * file cannot be kept (no CORS, offline). Local values (data:, blob:, bundled assets) pass through unchanged.
 */
export function useWfNewStaticUrl(url: string | null | undefined, kind: WfNewStaticKind = 'image'): string | undefined {
  const remote = url && REMOTE_URL_RE.test(url) ? url : null;
  const [resolved, setResolved] = useState<{ remote: string; local: string } | null>(() => {
    const local = remote ? peekStatic(remote) : undefined;
    return remote && local ? { remote, local } : null;
  });

  useEffect(() => {
    if (!remote) return undefined;
    const held = peekStatic(remote);
    if (held) {
      setResolved({ remote, local: held });
      return undefined;
    }
    let alive = true;
    void ensureStatic(remote, kind)
      .catch(() => null)
      .then((local) => {
        if (alive) setResolved({ remote, local: local ?? remote });
      });
    return () => { alive = false; };
  }, [remote, kind]);

  if (!url) return undefined;
  if (!remote) return url;
  return resolved?.remote === remote ? resolved.local : undefined;
}
