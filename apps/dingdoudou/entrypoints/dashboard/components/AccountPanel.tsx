/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountStats, PinduoduoAccount } from '@/lib/types';
import { i18n, Language } from '../i18n';
import { localeFor } from '@/lib/uiI18n';
import {
  Key, LogOut, ShieldCheck, CreditCard, Gift, Users,
  ChevronDown, RefreshCw, UserCheck, Settings, Award,
  HelpCircle, Sparkles, PlusCircle, Trash2
} from 'lucide-react';

interface AccountPanelProps {
  stats: AccountStats;
  accounts: PinduoduoAccount[];
  activeAccount: PinduoduoAccount | null;
  onSelectAccount: (acc: PinduoduoAccount) => void;
  onModifyPassword: () => void;
  onLogout: () => void;
  onAdjustBalance: (newBalance: number) => void;
  onAddNewAccount: (name: string) => void;
  onDeleteAccount: (id: string) => void;
  lang: Language;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  stats,
  accounts,
  activeAccount,
  onSelectAccount,
  onModifyPassword,
  onLogout,
  onAdjustBalance,
  onAddNewAccount,
  onDeleteAccount,
  lang
}) => {
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [showRefill, setShowRefill] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [showAddAcc, setShowAddAcc] = useState(false);

  const t = i18n[lang];

  const handleRefill = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(balanceInput);
    if (!isNaN(val) && val >= 0) {
      onAdjustBalance(val);
      setShowRefill(false);
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAccName.trim()) {
      onAddNewAccount(newAccName.trim());
      setNewAccName('');
      setShowAddAcc(false);
    }
  };

  return (
    <div id="account-panel-container" className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl p-5 shadow-xl space-y-6 text-slate-800 dark:text-slate-250 transition-all duration-300">
      {/* License Metadata */}
      <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
            {stats.edition === 'DDK-FREE-FOREVER' || stats.edition === '专业永久版' ? t.edition : stats.edition}
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1 font-mono">{t.premiumLevel} V2.6</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.remainingDays}</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-end gap-1">
            {stats.remainingDays === '不限' ? t.forever : `${stats.remainingDays} ${t.days}`}
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-yellow-400 fill-yellow-400/20" />
          </p>
        </div>
      </div>

      {/* Account Balance card */}
      <div className="bg-white/60 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 rounded-xl p-4 relative overflow-hidden border border-white/50 dark:border-white/10 shadow-lg">
        <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 dark:opacity-[0.02]">
          <CreditCard className="w-24 h-24 text-blue-500" />
        </div>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-slate-505 dark:text-slate-400 font-medium">{t.balance}</p>
            <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-sans mt-0.5">
              ¥{stats.balance.toLocaleString(localeFor(lang), { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <button
            id="adjust-balance-btn"
            onClick={() => {
              setBalanceInput(stats.balance.toString());
              setShowRefill(!showRefill);
            }}
            className="text-[11px] bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/35 text-blue-600 dark:text-blue-300 border border-blue-500/20 dark:border-blue-500/30 px-2 py-1 rounded-md transition-all font-bold cursor-pointer"
          >
            {t.walletAdjust}
          </button>
        </div>

        {showRefill && (
          <form onSubmit={handleRefill} className="mt-3 pt-3 border-t border-black/5 dark:border-white/10 flex gap-2">
            <input
              type="text"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder={t.walletPlaceholder}
              className="w-full bg-white/80 dark:bg-black/40 text-slate-800 dark:text-slate-100 text-xs px-2.5 py-1.5 rounded border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-500 font-bold whitespace-nowrap cursor-pointer border-none"
            >
              {t.walletConfirm}
            </button>
          </form>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-black/5 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>{t.paymentType}: {stats.paymentType}</span>
          </div>
          <div className="flex items-center gap-1">
            <Gift className="w-3.5 h-3.5 text-amber-500" />
            <span>{t.inviteFriends}: {t.inviteRebate}</span>
          </div>
        </div>
      </div>

      {/* Account Bindings */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {t.pddAccounts}
          </span>
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            {accounts.length} / {stats.pddMaxBinds > 1000000 ? '⭐ ' + t.unlimited : stats.pddMaxBinds}
          </span>
        </div>

        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
          {accounts.map((acc) => {
            const isActive = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                onClick={() => onSelectAccount(acc)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-all ${
                  isActive
                    ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-400/40 shadow-sm'
                    : 'bg-white/40 dark:bg-white/5 border-black/5 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-black/5 dark:border-white/10 overflow-hidden relative bg-slate-200 dark:bg-black/40">
                    {acc.avatar ? (
                      <img src={acc.avatar} alt={acc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/40">
                        {acc.name[0]}
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-900" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{acc.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-450 font-mono">PDD SDK</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 scale-90 origin-right">
                    ACTIVE
                  </span>
                  {accounts.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAccount(acc.id);
                      }}
                      className="p-1 hover:bg-rose-500/10 dark:hover:bg-rose-500/25 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title={t.unbind}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Account Trigger */}
        {!showAddAcc ? (
          <button
            id="bind-account-trigger-btn"
            onClick={() => setShowAddAcc(true)}
            className="w-full py-1.5 border border-dashed border-black/20 dark:border-white/15 text-slate-600 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all font-semibold cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t.bindMore}
          </button>
        ) : (
          <form onSubmit={handleAddAccount} className="p-2 border border-black/10 dark:border-white/10 rounded-xl bg-black/5 dark:bg-black/20 space-y-2">
            <input
              type="text"
              required
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              placeholder={t.newAccPlaceholder}
              className="w-full text-xs bg-white dark:bg-black/40 text-slate-800 dark:text-slate-100 px-2 py-1.5 border border-black/10 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddAcc(false)}
                className="px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-500 cursor-pointer border-none font-bold"
              >
                {t.bind}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Constraints Upgrade Area */}
      <div className="bg-blue-500/10 dark:bg-blue-600/10 border border-blue-500/20 rounded-xl p-3.5 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1">
          <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t.systemQuota}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-white/50 dark:bg-black/30 p-2 rounded-lg border border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5">{t.maxOrders}</span>
            <span className="font-mono font-bold text-slate-805 dark:text-slate-100">{t.maxed}</span>
          </div>
          <div className="bg-white/50 dark:bg-black/30 p-2 rounded-lg border border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5">{t.multiChannels}</span>
            <span className="font-mono font-bold text-slate-805 dark:text-slate-100">{t.unlimited}</span>
          </div>
        </div>
      </div>

      {/* Safety Actions */}
      <div className="pt-2 border-t border-black/5 dark:border-white/10 grid grid-cols-2 gap-2">
        <button
          id="modify-password-btn"
          onClick={onModifyPassword}
          className="py-2 px-3 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Key className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          {t.changePassBtn}
        </button>
        <button
          id="logout-btn"
          onClick={onLogout}
          className="py-2 px-3 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-rose-500/30 dark:hover:border-rose-500/30 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-350 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          {t.logOutBtn}
        </button>
      </div>
    </div>
  );
};
