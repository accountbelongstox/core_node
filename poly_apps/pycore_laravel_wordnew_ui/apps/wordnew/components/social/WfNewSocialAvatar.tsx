import React from 'react';
import type { WfNewPresenceStatus, WfNewSocialActor } from '../../api';
import { laravelMediaUrl as mediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { WfNewAvatarView } from '../WfNewAvatarView';
import { presenceClass } from './socialPresence';

interface WfNewSocialAvatarProps {
  /** Emoji or absolute image URL. */
  src?: string | null;
  name?: string;
  size?: string;
  textClass?: string;
  borderClass?: string;
  presence?: WfNewPresenceStatus;
  /** Position / size / ring of the presence dot. */
  dotClass?: string;
}

/** Round avatar (emoji or image, first-letter fallback) with an optional presence dot. */
export const WfNewSocialAvatar: React.FC<WfNewSocialAvatarProps> = ({
  src, name, size = 'w-10 h-10', textClass = 'text-lg', borderClass = '', presence, dotClass = '-bottom-1 -right-1 w-3 h-3 border-slate-950',
}) => {
  const circle = (
    <div className={`${size} rounded-full bg-zinc-800 flex items-center justify-center ${textClass} overflow-hidden shrink-0 ${borderClass}`}>
      <WfNewAvatarView value={src || ''} fallback={(name || '?').slice(0, 1)} />
    </div>
  );
  if (!presence) return circle;
  return (
    <div className="relative shrink-0">
      {circle}
      <span className={`absolute rounded-full border-2 ${dotClass} ${presenceClass(presence)}`} />
    </div>
  );
};

/** Avatar of a post / live / comment author (root-relative image urls resolved). */
export const WfNewActorAvatar: React.FC<{ actor: WfNewSocialActor; size?: string }> = ({ actor, size }) => (
  <WfNewSocialAvatar src={mediaUrl(actor.avatar_url)} name={actor.name} size={size} />
);
