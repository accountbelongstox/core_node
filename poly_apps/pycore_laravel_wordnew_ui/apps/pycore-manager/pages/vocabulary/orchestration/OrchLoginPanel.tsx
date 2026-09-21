/**
 * Qy-app login panel for the audio-orchestration tab. The session is stored
 * on the pycore side (auth.json in the pycore user data dir) so it survives
 * restarts; this panel only renders status + credentials form.
 */
import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, LogOut, UserCheck } from 'lucide-react';
import { pycoreApi, type OrchAuthStatus } from '@/apps/pycore-manager/api';
import { VocabBanner } from '../vocabShared';
import { ORCH_L, orchErrorMessage } from './orchShared';

const OrchLoginPanel: React.FC<{
  auth: OrchAuthStatus | null;
  onChanged: () => void;
}> = ({ auth, onChanged }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupStatus, setGroupStatus] = useState<OrchAuthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGroupStatus(null);
    if (!auth?.logged_in) return;
    setGroupsLoading(true);
    void pycoreApi.orchWordGroups(true).then((status) => {
      if (cancelled) return;
      setGroupStatus(status);
      if (!status.success && status.error) setError(orchErrorMessage(status.error, ORCH_L.groupsLoadFailed));
    }).catch((failure) => {
      if (!cancelled) setError(orchErrorMessage(failure, ORCH_L.groupsLoadFailed));
    }).finally(() => { if (!cancelled) setGroupsLoading(false); });
    return () => { cancelled = true; };
  }, [auth?.logged_in, auth?.user?.id, auth?.logged_at]);

  const selectGroup = (groupId: string) => {
    setGroupsLoading(true);
    void pycoreApi.orchSelectWordGroup(groupId).then((status) => {
      setGroupStatus(status);
      onChanged();
    }).catch((failure) => {
      setError(orchErrorMessage(failure, ORCH_L.groupsLoadFailed));
    }).finally(() => setGroupsLoading(false));
  };

  const submit = async () => {
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const r = await pycoreApi.orchAuthLogin(username.trim(), password);
      if (!r.success) {
        setError(ORCH_L.loginFailed);
        return;
      }
      setPassword('');
      onChanged();
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.loginFailed));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await pycoreApi.orchAuthLogout();
      onChanged();
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.logoutFailed));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setError(null);
    try {
      await pycoreApi.orchAuthSync(true);
      onChanged();
    } catch (e) {
      setError(orchErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.loginTitle}</h3>
        {auth?.logged_in && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <UserCheck className="w-3.5 h-3.5" /> {ORCH_L.loggedInAs} {auth.user?.username || auth.username}
          </span>
        )}
      </div>
      {error && <VocabBanner kind="error" message={error} />}
      {auth?.sync_error && (
        <div className="space-y-2">
          <VocabBanner kind="warn" message={orchErrorMessage(auth.sync_error, ORCH_L.machineSyncPending)} />
          <button type="button" disabled={busy} onClick={() => void sync()}
            className="text-xs text-sky-400 disabled:opacity-50">{ORCH_L.retrySync}</button>
        </div>
      )}
      {auth?.logged_in && (
        <div className="space-y-1">
          <label className="block text-xs text-slate-400">
            {ORCH_L.wordGroupBaseline}
            <select value={groupStatus?.word_group_id || auth.word_group_id || ''}
              disabled={groupsLoading} onChange={(event) => selectGroup(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-200">
              <option value="">{groupsLoading ? ORCH_L.checking : ORCH_L.noWordGroups}</option>
              {(groupStatus?.word_groups || auth.word_groups || []).map((group) => (
                <option key={group.gid} value={group.gid}>
                  {group.gname}{group.is_default || group.is_language_default ? ` (${ORCH_L.defaultGroup})` : ''}
                  {group.language ? ` · ${group.language}` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-slate-500">{ORCH_L.wordGroupHint}</p>
        </div>
      )}
      {auth?.logged_in ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">{ORCH_L.loginHint}</p>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" /> {ORCH_L.logout}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">
            {ORCH_L.username}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-44 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-200"
              autoComplete="username"
            />
          </label>
          <label className="text-xs text-slate-400">
            {ORCH_L.password}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              className="mt-1 block w-44 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-200"
              autoComplete="current-password"
            />
          </label>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !username.trim() || !password}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {ORCH_L.login}
          </button>
          <p className="w-full text-[11px] text-slate-500">{ORCH_L.loginHint}</p>
        </div>
      )}
    </section>
  );
};

export default OrchLoginPanel;
