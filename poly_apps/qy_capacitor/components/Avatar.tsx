/* [v4.1-Iris] Shared avatar with consistent fallback. Verified against
   public/design-reference-{light,dark}.webp — token-colored, no inline hex,
   no emoji, dark/light parity. */
import React, { useState } from 'react';
import { User } from 'lucide-react';

/**
 * Unified avatar renderer.
 *
 * - Source resolution is the canonical `avatar_url || avatar` pattern.
 * - When no source is available, OR the image fails to load (broken / missing
 *   file on the server), it degrades gracefully to an in-app fallback:
 *   a token-colored initial when a name is known, otherwise a lucide `User`
 *   chip. No external services, no hardcoded hex — uses `--klein-*` tokens
 *   only so dark/light parity holds.
 *
 * This is intentionally implemented outside the FROZEN UI.tsx so it can be
 * reused everywhere an avatar is shown.
 */
export interface AvatarProps {
  /** Primary source (resolved server URL). */
  src?: string | null;
  /** Legacy / fallback source (relative avatar path). */
  fallbackSrc?: string | null;
  /** Display name used for the initial fallback and alt text. */
  name?: string | null;
  alt?: string;
  /** Extra classes applied to the outer round container (sizing, borders). */
  className?: string;
}

function initialOf(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  fallbackSrc,
  name,
  alt,
  className = '',
}) => {
  const resolved = src || fallbackSrc || '';
  const [failed, setFailed] = useState(false);

  const showImage = !!resolved && !failed;
  const letter = initialOf(name);

  return (
    <div
      className={`overflow-hidden flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] ${className}`}
    >
      {showImage ? (
        <img
          src={resolved}
          alt={alt || name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : letter ? (
        <span className="font-bold leading-none select-none text-[1em]">
          {letter}
        </span>
      ) : (
        <User className="w-1/2 h-1/2" strokeWidth={2} aria-hidden="true" />
      )}
    </div>
  );
};

export default Avatar;
