import React, { useState, useEffect } from 'react';
import { api, DbConnectionInfo, DbCredentialInfo, DbAccountCreateResult } from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../../admin/Modal';
import { useToast } from '../../admin';
import { LoadingBlock, InlineSpinner, AlertBox, EmptyState, CopyButton } from '../../common';
import { KeyRound, ShieldAlert, Eye, EyeOff, Users, UserPlus, Trash2, RotateCcw } from 'lucide-react';

export const CredentialsTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Change-password modal state. changeTarget = which account (defaults to
  // the configured superuser when opened from the action card).
  const [showChange, setShowChange] = useState(false);
  const [changeTarget, setChangeTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset-password modal state.
  const [showReset, setShowReset] = useState(false);
  // The freshly generated password, shown ONCE after a successful reset.
  const [generated, setGenerated] = useState<string | null>(null);
  const [generatedSynced, setGeneratedSynced] = useState<boolean>(true);

  // Current-password reveal (identity card).
  const [showPassword, setShowPassword] = useState(false);

  // Add-account modal state; createdAccount holds the one-time password result.
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [createdAccount, setCreatedAccount] = useState<DbAccountCreateResult | null>(null);

  // Drop-account confirm.
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const { data: info, loading, refresh: load } = useApiResource<DbCredentialInfo>(
    () => api.databaseManager.getCredentials(connection.key),
    { deps: [connection.key] }
  );

  const supported = !!info?.supports_password;

  const resetChangeForm = () => {
    setNewPassword('');
    setConfirmPassword('');
  };

  const runChange = async () => {
    if (!newPassword || newPassword !== confirmPassword) return;
    const targetUser = changeTarget ?? info?.superuser ?? undefined;
    setBusy(true);
    logInfo('db-manager', `Changing DB password for ${targetUser ?? 'superuser'}@${connection.key}…`);
    try {
      const res = await api.databaseManager.changePassword(connection.key, newPassword, targetUser);
      setShowChange(false);
      resetChangeForm();
      if (res.is_configured_account) {
        if (res.synced) {
          logSuccess('db-manager', `Password for ${res.user}@${connection.key} changed & synced`);
          toast.success('Password changed & synced to Laravel config');
        } else {
          logError('db-manager', `Password for ${res.user}@${connection.key} changed but NOT synced to Laravel config`);
          toast.error('Password changed, but Laravel config was NOT synced — connections may break until re-synced.');
        }
      } else {
        logSuccess('db-manager', `Password for account ${res.user}@${connection.key} changed`);
        toast.success(`Password changed for ${res.user}`);
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password change failed';
      logError('db-manager', `Password change for ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runAddUser = async () => {
    const username = addUsername.trim();
    if (!username) return;
    setBusy(true);
    logInfo('db-manager', `Creating DB account ${username}@${connection.key}…`);
    try {
      const res = await api.databaseManager.createAccount(
        connection.key,
        username,
        addPassword || undefined
      );
      setShowAddUser(false);
      setAddUsername('');
      setAddPassword('');
      if (res.generated) {
        // Generated password is shown once in a dedicated modal.
        setCreatedAccount(res);
      }
      logSuccess('db-manager', `Account ${res.username}@${connection.key} created${res.generated ? ' (generated password)' : ''}`);
      toast.success(`Account ${res.username} created`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Account creation failed';
      logError('db-manager', `Create account ${username}@${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runDropUser = async () => {
    if (!dropTarget) return;
    const username = dropTarget;
    setDropTarget(null);
    setBusy(true);
    logInfo('db-manager', `Dropping DB account ${username}@${connection.key}…`);
    try {
      await api.databaseManager.dropAccount(connection.key, username);
      logSuccess('db-manager', `Account ${username}@${connection.key} dropped`);
      toast.success(`Account ${username} dropped`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Account drop failed';
      logError('db-manager', `Drop account ${username}@${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runReset = async () => {
    setBusy(true);
    setShowReset(false);
    logInfo('db-manager', `Resetting root DB password for ${connection.key}…`);
    try {
      const res = await api.databaseManager.resetPassword(connection.key);
      setGenerated(res.new_password);
      setGeneratedSynced(res.synced);
      if (res.synced) {
        logSuccess('db-manager', `Root password for ${connection.key} reset & synced`);
        toast.success('Root password reset & synced to Laravel config');
      } else {
        logError('db-manager', `Root password for ${connection.key} reset but NOT synced to Laravel config`);
        toast.error('Password reset, but Laravel config was NOT synced — connections may break until re-synced.');
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password reset failed';
      logError('db-manager', `Root password reset for ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label="Loading credentials…" />;
  }

  if (!info) {
    return (
      <div className="py-4">
        <p className="text-red-600 dark:text-red-400 mb-3">Credentials unavailable</p>
        <button
          type="button"
          onClick={load}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
        >
          Retry
        </button>
      </div>
    );
  }

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className={`${commonClasses.card} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Credentials</h3>
          <StatusBadge status={info.driver} tone={driverTone(info.driver)} withDot={false} className="ml-1" />
        </div>
        <StatRow label="Connection" value={info.connection} />
        <StatRow label="Superuser" value={info.superuser ?? '—'} />
        {supported && info.password !== null && (
          <StatRow
            label="Password"
            value={
              <span className="flex items-center gap-2 font-mono">
                <span className="select-all">
                  {showPassword ? info.password || '(empty)' : '•'.repeat(Math.min(16, Math.max(8, info.password.length)))}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <CopyButton text={info.password} label="Copy" variant="outline" />
              </span>
            }
          />
        )}
        <StatRow
          label="Password auth"
          value={
            <StatusBadge
              status={supported ? 'supported' : 'not applicable'}
              tone={supported ? 'success' : 'warning'}
              withDot={false}
            />
          }
        />
        {info.secret_key && <StatRow label="Secret key" value={info.secret_key} />}
      </div>

      {/* Re-sync explainer (pgsql/mysql) */}
      {supported ? (
        <AlertBox variant="info" icon={false}>
          <span className="flex gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Changing or resetting the password also re-syncs Laravel&apos;s own config (its
              credential store) so this connection keeps working afterward. Password auth applies to{' '}
              <strong>pgsql / mysql</strong> only.
            </span>
          </span>
        </AlertBox>
      ) : (
        <AlertBox variant="warning">
          {info.note || 'This file-based database has no password; credential controls are disabled.'}
        </AlertBox>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Change password</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set a new password for <strong>{info.superuser ?? 'the user'}</strong>. Laravel&apos;s config is
            re-synced automatically.
          </p>
          <button
            type="button"
            onClick={() => {
              resetChangeForm();
              setChangeTarget(info.superuser);
              setShowChange(true);
            }}
            disabled={!supported || busy}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            <KeyRound className="w-4 h-4" />
            Change password
          </button>
        </div>

        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Reset root password</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate a fresh strong password. It is shown <strong>once</strong> — record it
            immediately.
          </p>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            disabled={!supported || busy}
            className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50`}
          >
            <ShieldAlert className="w-4 h-4" />
            Reset root password
          </button>
        </div>
      </div>

      {/* Accounts (driver-aware: pgsql roles / mysql users; sqlite has none) */}
      {supported && (
        <div className={`${commonClasses.card} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Accounts</h3>
              <span className="text-xs text-slate-400">
                {info.driver === 'pgsql' ? 'PostgreSQL roles' : 'MySQL users'} ({info.users.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddUsername('');
                setAddPassword('');
                setShowAddUser(true);
              }}
              disabled={busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
            >
              <UserPlus className="w-4 h-4" />
              Add account
            </button>
          </div>
          {info.users.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No accounts visible (catalog may require superuser privileges).
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Account</th>
                    {info.driver !== 'pgsql' && (
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Host</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Flags</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {info.users.map((u) => {
                    const isConfigured = u.name === info.superuser;
                    return (
                      <tr
                        key={`${u.name}@${u.host ?? ''}`}
                        className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-3 py-2 font-mono text-[13px] text-slate-700 dark:text-slate-300">
                          {u.name}
                          {isConfigured && (
                            <StatusBadge status="laravel" tone="info" withDot={false} className="ml-2" />
                          )}
                        </td>
                        {info.driver !== 'pgsql' && (
                          <td className="px-3 py-2 font-mono text-[13px] text-slate-500">{u.host ?? '—'}</td>
                        )}
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            {u.super && <StatusBadge status="super" tone="warning" withDot={false} />}
                            <StatusBadge
                              status={u.can_login ? 'login' : 'no-login'}
                              tone={u.can_login ? 'success' : 'error'}
                              withDot={false}
                            />
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              resetChangeForm();
                              setChangeTarget(u.name);
                              setShowChange(true);
                            }}
                            disabled={busy}
                            className="px-2 py-1 text-xs rounded text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                          >
                            Change password
                          </button>
                          <button
                            type="button"
                            onClick={() => setDropTarget(u.name)}
                            disabled={busy || isConfigured}
                            title={isConfigured ? 'Laravel connects as this account — cannot drop' : `Drop ${u.name}`}
                            className="ml-1 px-2 py-1 text-xs rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                          >
                            Drop
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Change-password modal */}
      <Modal
        isOpen={showChange}
        onClose={() => {
          setShowChange(false);
          resetChangeForm();
        }}
        title="Change password"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowChange(false);
                resetChangeForm();
              }}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runChange}
              disabled={!passwordsMatch || busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} disabled:opacity-50`}
            >
              Change &amp; sync
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            New password for <strong>{changeTarget ?? info.superuser ?? 'the user'}</strong> on{' '}
            <strong>{connection.name}</strong>.
            {(changeTarget ?? info.superuser) === info.superuser
              ? ' This also re-syncs Laravel’s config.'
              : ' This account is not the one Laravel connects as — its credential store is untouched.'}
          </p>
          <Field label="New password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={`${commonClasses.input} w-full`}
            />
          </Field>
          <Field
            label="Confirm password"
            error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match.' : undefined}
          >
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={`${commonClasses.input} w-full`}
            />
          </Field>
        </div>
      </Modal>

      {/* Reset confirm modal */}
      <Modal
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        title="Reset root password"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowReset(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runReset}
              disabled={busy}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white disabled:opacity-50`}
            >
              Reset &amp; generate
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Generate a new strong password for <strong>{info.superuser ?? 'the root user'}</strong> on{' '}
          <strong>{connection.name}</strong> and re-sync Laravel&apos;s config?
          <span className="block mt-2 text-red-600 dark:text-red-400">
            The current password stops working immediately. The new one is shown only once.
          </span>
        </p>
      </Modal>

      {/* Generated-password reveal modal (shown once) */}
      <Modal
        isOpen={generated !== null}
        onClose={() => setGenerated(null)}
        title="New password — store it now"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenerated(null)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              I&apos;ve stored it
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <AlertBox variant="error">
            <span>
              Store this password now — it will <strong>not be shown again</strong>.
            </span>
          </AlertBox>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-sm break-all select-all">
              {generated}
            </code>
            {generated && <CopyButton text={generated} label="Copy" variant="outline" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {generatedSynced
              ? 'This password was synced to Laravel’s credential store, so connections keep working.'
              : 'WARNING: this password was NOT synced to Laravel’s credential store — re-sync manually or connections will break.'}
          </p>
        </div>
      </Modal>

      {/* Add-account modal */}
      <Modal
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title="Add account"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runAddUser}
              disabled={!addUsername.trim() || busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} disabled:opacity-50`}
            >
              Create account
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {info.driver === 'pgsql' ? (
              <>Creates a PostgreSQL <strong>LOGIN role</strong> with privileges on database{' '}
              <strong>{connection.database}</strong> (table-level grants stay with the operator).</>
            ) : (
              <>Creates a MySQL user <strong>@localhost</strong> with ALL privileges on schema{' '}
              <strong>{connection.database}</strong>.</>
            )}
          </p>
          <Field label="Username">
            <input
              type="text"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="letters, digits, _ or -"
              className={`${commonClasses.input} w-full font-mono`}
            />
          </Field>
          <Field label="Password" hint="Leave empty to auto-generate a strong one.">
            <input
              type="password"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              className={`${commonClasses.input} w-full`}
            />
          </Field>
        </div>
      </Modal>

      {/* Created-account one-time password reveal */}
      <Modal
        isOpen={createdAccount !== null}
        onClose={() => setCreatedAccount(null)}
        title="Account created — store the password now"
        size="sm"
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setCreatedAccount(null)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              I stored it
            </button>
          </div>
        }
      >
        {createdAccount && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Generated password for <strong className="font-mono">{createdAccount.username}</strong> —
              shown <strong>once</strong>, it is not retrievable again.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm break-all">
              <span className="flex-1 select-all">{createdAccount.password}</span>
              <CopyButton text={createdAccount.password} label="Copy" variant="outline" />
            </div>
          </div>
        )}
      </Modal>

      {/* Drop-account confirm */}
      <Modal
        isOpen={dropTarget !== null}
        onClose={() => setDropTarget(null)}
        title="Drop account"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDropTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runDropUser}
              disabled={busy}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white disabled:opacity-50`}
            >
              Drop account
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Drop database account <strong className="font-mono">{dropTarget}</strong> on{' '}
          <strong>{connection.name}</strong>? Objects it owns may block the drop; this cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Root view ───────────────────────────────
// Status was merged into the Tables tab (compact StatusStrip above the browser).
