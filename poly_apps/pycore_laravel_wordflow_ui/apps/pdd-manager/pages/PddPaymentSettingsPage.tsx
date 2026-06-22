/**
 * PddPaymentSettingsPage — Alipay / WeChat gateway toggles + write-only secret
 * fields (GET/POST /payment-settings) and a package price editor (GET/POST
 * /packages). Secrets are never returned from the backend; their inputs are
 * write-only (blank = keep current). Strings via the `pdd` namespace.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, CreditCard, Package as PackageIcon, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../../core/api';
import type {
  PddPaymentSettingsPublic, PddPaymentSettingsSave, PddPackage,
} from '../../../core/api/modules/PddAdminAPI';

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30';
const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

const PddPaymentSettingsPage: React.FC = () => {
  const { t } = useTranslation('pdd');
  const [settings, setSettings] = useState<PddPaymentSettingsPublic | null>(null);
  const [packages, setPackages] = useState<PddPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyG, setBusyG] = useState(false);
  const [busyP, setBusyP] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Gateway form state
  const [alipayEnabled, setAlipayEnabled] = useState(false);
  const [alipayAppId, setAlipayAppId] = useState('');
  const [alipayPrivateKey, setAlipayPrivateKey] = useState('');
  const [alipayPublicKey, setAlipayPublicKey] = useState('');
  const [wechatEnabled, setWechatEnabled] = useState(false);
  const [wechatMchId, setWechatMchId] = useState('');
  const [wechatAppId, setWechatAppId] = useState('');
  const [wechatApiV3, setWechatApiV3] = useState('');
  const [wechatCertSerial, setWechatCertSerial] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api.pddAdmin.getPaymentSettings(),
        api.pddAdmin.listPackages(),
      ]);
      setSettings(s);
      setPackages(p);
      if (s) {
        setAlipayEnabled(s.alipay.enabled);
        setAlipayAppId(s.alipay.app_id || '');
        setWechatEnabled(s.wechat.enabled);
        setWechatMchId(s.wechat.mch_id || '');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 2500); };

  const saveGateways = async () => {
    setBusyG(true);
    try {
      const payload: PddPaymentSettingsSave = {
        alipay: {
          enabled: alipayEnabled,
          app_id: alipayAppId || undefined,
          private_key: alipayPrivateKey || undefined,
          public_key: alipayPublicKey || undefined,
        },
        wechat: {
          enabled: wechatEnabled,
          mch_id: wechatMchId || undefined,
          app_id: wechatAppId || undefined,
          api_v3_key: wechatApiV3 || undefined,
          cert_serial: wechatCertSerial || undefined,
        },
      };
      const updated = await api.pddAdmin.savePaymentSettings(payload);
      setSettings(updated);
      // Clear write-only secret fields after a successful save.
      setAlipayPrivateKey(''); setAlipayPublicKey('');
      setWechatApiV3(''); setWechatCertSerial('');
      flash(t('payment.gatewaysSaved'));
    } catch (e: any) {
      flash(e?.message || 'Error');
    } finally {
      setBusyG(false);
    }
  };

  const savePackages = async () => {
    setBusyP(true);
    try {
      const saved = await api.pddAdmin.savePackages(packages);
      setPackages(saved);
      flash(t('payment.packagesSaved'));
    } catch (e: any) {
      flash(e?.message || 'Error');
    } finally {
      setBusyP(false);
    }
  };

  const updatePkg = (idx: number, patch: Partial<PddPackage>) => {
    setPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const ConfiguredBadge: React.FC<{ ok: boolean }> = ({ ok }) => (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {ok ? t('payment.configured') : t('payment.notConfigured')}
    </span>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('payment.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('payment.subtitle')}</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </header>

      {notice && (
        <div className="mb-4 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-4 py-3 text-sm">{notice}</div>
      )}

      {/* Gateways */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-500" /> {t('payment.gateways')}</h2>
        <p className="text-xs text-slate-400 mb-4">{t('payment.secretHint')}</p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Alipay */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('payment.alipay')}</h3>
              <ConfiguredBadge ok={!!settings?.alipay.configured} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-3 cursor-pointer">
              <input type="checkbox" checked={alipayEnabled} onChange={(e) => setAlipayEnabled(e.target.checked)} className="rounded" />
              {t('payment.enabled')}
            </label>
            <div className="space-y-3">
              <div><label className={labelCls}>{t('payment.appId')}</label><input value={alipayAppId} onChange={(e) => setAlipayAppId(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>{t('payment.privateKey')}</label><input type="password" autoComplete="new-password" value={alipayPrivateKey} onChange={(e) => setAlipayPrivateKey(e.target.value)} placeholder="••••••" className={inputCls} /></div>
              <div><label className={labelCls}>{t('payment.publicKey')}</label><input type="password" autoComplete="new-password" value={alipayPublicKey} onChange={(e) => setAlipayPublicKey(e.target.value)} placeholder="••••••" className={inputCls} /></div>
            </div>
          </div>

          {/* WeChat */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('payment.wechat')}</h3>
              <ConfiguredBadge ok={!!settings?.wechat.configured} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-3 cursor-pointer">
              <input type="checkbox" checked={wechatEnabled} onChange={(e) => setWechatEnabled(e.target.checked)} className="rounded" />
              {t('payment.enabled')}
            </label>
            <div className="space-y-3">
              <div><label className={labelCls}>{t('payment.mchId')}</label><input value={wechatMchId} onChange={(e) => setWechatMchId(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>{t('payment.appId')}</label><input value={wechatAppId} onChange={(e) => setWechatAppId(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>{t('payment.apiV3Key')}</label><input type="password" autoComplete="new-password" value={wechatApiV3} onChange={(e) => setWechatApiV3(e.target.value)} placeholder="••••••" className={inputCls} /></div>
              <div><label className={labelCls}>{t('payment.certSerial')}</label><input type="password" autoComplete="new-password" value={wechatCertSerial} onChange={(e) => setWechatCertSerial(e.target.value)} placeholder="••••••" className={inputCls} /></div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={saveGateways} disabled={busyG} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition">
            {busyG && <Loader2 className="w-4 h-4 animate-spin" />}
            {busyG ? t('common.saving') : t('payment.saveGateways')}
          </button>
        </div>
      </section>

      {/* Packages */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><PackageIcon className="w-4 h-4 text-indigo-500" /> {t('payment.packages')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2 font-medium">{t('payment.pkgCode')}</th>
                <th className="px-3 py-2 font-medium">{t('payment.pkgName')}</th>
                <th className="px-3 py-2 font-medium">{t('payment.pkgPriceMonth')}</th>
                <th className="px-3 py-2 font-medium">{t('payment.pkgPriceYear')}</th>
                <th className="px-3 py-2 font-medium">{t('payment.pkgMaxOrders')}</th>
                <th className="px-3 py-2 font-medium">{t('payment.pkgMaxAccounts')}</th>
                <th className="px-3 py-2 font-medium text-center">{t('payment.pkgEnabled')}</th>
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">{loading ? t('common.loading') : t('common.noData')}</td></tr>
              ) : packages.map((p, idx) => (
                <tr key={p.code} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.code}</td>
                  <td className="px-3 py-2"><input value={p.name} onChange={(e) => updatePkg(idx, { name: e.target.value })} className={`${inputCls} min-w-[120px]`} /></td>
                  <td className="px-3 py-2"><input type="number" value={p.price_month} onChange={(e) => updatePkg(idx, { price_month: Number(e.target.value) })} className={`${inputCls} w-24`} /></td>
                  <td className="px-3 py-2"><input type="number" value={p.price_year} onChange={(e) => updatePkg(idx, { price_year: Number(e.target.value) })} className={`${inputCls} w-24`} /></td>
                  <td className="px-3 py-2"><input type="number" value={p.max_orders} onChange={(e) => updatePkg(idx, { max_orders: Number(e.target.value) })} className={`${inputCls} w-20`} /></td>
                  <td className="px-3 py-2"><input type="number" value={p.max_pdd_accounts} onChange={(e) => updatePkg(idx, { max_pdd_accounts: Number(e.target.value) })} className={`${inputCls} w-20`} /></td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={p.enabled} onChange={(e) => updatePkg(idx, { enabled: e.target.checked })} className="rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={savePackages} disabled={busyP} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition">
            {busyP && <Loader2 className="w-4 h-4 animate-spin" />}
            {busyP ? t('common.saving') : t('payment.savePackages')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default PddPaymentSettingsPage;
