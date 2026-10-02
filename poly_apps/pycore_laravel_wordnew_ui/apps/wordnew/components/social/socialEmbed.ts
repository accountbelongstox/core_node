/** Convert a watch/share url into an embeddable iframe src for whitelisted hosts. */
export function embedUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith('/embed/')) return raw;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // Bilibili
    if (host === 'bilibili.com' || host === 'player.bilibili.com') {
      if (u.pathname.startsWith('/video/')) {
        const bvid = u.pathname.split('/')[2];
        if (bvid) return `https://player.bilibili.com/player.html?bvid=${bvid}`;
      }
      return raw; // already a player url
    }
    // Vimeo
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'player.vimeo.com') return raw;
  } catch {
    return null;
  }
  return null;
}
