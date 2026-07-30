import React, { useCallback, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { LocateFixed, Loader2, MessageSquare, UserPlus } from 'lucide-react';
import { mediaUrl } from '../../../../config/constants';
import { wfNewApi, type WfNewNearbyUser } from '../../api';

interface WfNewSocialNearbyProps {
  isLoggedIn: boolean;
  requireAuth: () => void;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  onMessage: (userId: number) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewSocialNearby: React.FC<WfNewSocialNearbyProps> = ({
  isLoggedIn, requireAuth, addToast, onMessage, trans,
}) => {
  const [users, setUsers] = useState<WfNewNearbyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);
  const [requested, setRequested] = useState<Record<number, boolean>>({});

  const refresh = useCallback(async () => {
    if (!isLoggedIn) { requireAuth(); return; }
    setLoading(true);
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location === 'denied' && permission.coarseLocation === 'denied') {
        addToast(trans('social.nearbyLocationRequired'), 'warning');
        return;
      }
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      await wfNewApi.updateSocialLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        visible: true,
      });
      setUsers(await wfNewApi.getNearbyUsers(radiusKm, 50));
    } catch {
      setUsers([]);
      addToast(trans('social.nearbyLoadFailed'), 'warning');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, requireAuth, addToast, radiusKm]);

  const stopSharing = useCallback(async () => {
    if (!isLoggedIn) { requireAuth(); return; }
    try {
      await wfNewApi.disableSocialLocation();
      setUsers([]);
      addToast(trans('social.nearbyStopped'), 'info');
    } catch {
      addToast(trans('social.nearbyLoadFailed'), 'warning');
    }
  }, [isLoggedIn, requireAuth, addToast, trans]);

  const addFriend = useCallback(async (user: WfNewNearbyUser) => {
    if (!isLoggedIn) { requireAuth(); return; }
    try {
      await wfNewApi.sendFriendRequest(user.id);
      setRequested((current) => ({ ...current, [user.id]: true }));
      addToast(trans('social.requestSent', { name: user.nickname }), 'success');
    } catch {
      addToast(trans('social.requestFailed'), 'warning');
    }
  }, [isLoggedIn, requireAuth, addToast]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/3 border border-white/5">
        <div>
          <h4 className="text-sm font-black text-slate-100">{trans('social.nearbyTitle')}</h4>
          <p className="text-[11px] text-zinc-500 font-mono">{trans('social.nearbyHint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300">
            <option value={10}>10 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
            <option value={200}>200 km</option>
          </select>
          <button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            {trans('social.nearbyRefresh')}
          </button>
          <button onClick={() => void stopSharing()} className="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold cursor-pointer">{trans('social.nearbyStop')}</button>
        </div>
      </div>

      {!loading && users.length === 0 && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.nearbyEmpty')}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {users.map((user) => (
          <div key={user.id} className="p-4 rounded-2xl bg-white/3 border border-white/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
              {user.avatar ? <img src={mediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" /> : <span>{user.nickname.slice(0, 1)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm text-slate-200 truncate">{user.nickname}</div>
              <div className="text-[10px] text-indigo-300 font-mono">{user.distance_km.toFixed(1)} km away</div>
              <div className="text-[10px] text-zinc-500 truncate">{user.native_language} → {user.learning_languages.join(', ')}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => void addFriend(user)} disabled={requested[user.id]} className="p-2 rounded-lg bg-indigo-500/15 text-indigo-300 cursor-pointer disabled:opacity-40" aria-label="Add friend"><UserPlus className="w-4 h-4" /></button>
              <button onClick={() => onMessage(user.id)} className="p-2 rounded-lg bg-sky-500/15 text-sky-300 cursor-pointer" aria-label="Message"><MessageSquare className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
