import React from 'react';

/**
 * WfNewAvatarView — renders an avatar value that may be EITHER an emoji (text)
 * or an image (absolute http/https/data URL). The backend's auto-generated and
 * uploaded avatars are absolute image URLs; built-in presets are emoji. One
 * component so every avatar spot (top-right chip, profile, settings) handles
 * both without duplicating the branch.
 */

/** True when the value should render as an <img> (URL / data URL). */
export function isImageAvatar(value?: string): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('data:');
}

interface WfNewAvatarViewProps {
  /** Emoji string or absolute image URL. */
  value: string;
  /** Fallback emoji when value is empty / unrenderable. */
  fallback?: string;
  /** Extra classes applied to the rendered element. */
  className?: string;
}

export const WfNewAvatarView: React.FC<WfNewAvatarViewProps> = ({
  value,
  fallback = '🦊',
  className = '',
}) => {
  if (isImageAvatar(value)) {
    return (
      <img
        src={value}
        alt="avatar"
        className={`w-full h-full object-cover rounded-full ${className}`}
        draggable={false}
      />
    );
  }
  return <span className={`select-none ${className}`}>{value || fallback}</span>;
};
