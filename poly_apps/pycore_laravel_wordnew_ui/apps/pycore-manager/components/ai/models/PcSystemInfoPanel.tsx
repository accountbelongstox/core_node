/**
 * PcSystemInfoPanel — CUDA / torch / onnxruntime readiness plus pycore's fixed
 * constants and static directories (one-click open).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, FolderX, Lock, RefreshCcw, Settings2, Zap } from 'lucide-react';
import { PYCORE_HTTP_ROUTES, pycoreApi, usePycoreCapability } from '@/apps/pycore-manager/api';
import { usePcDirectOnly } from '../../../hooks/usePcDirectOnly';
import type { SystemInfo } from '@/apps/pycore-manager/api';
import { usePcRefreshSignal } from '../../../hooks/usePcRefreshSignal';
import { PcDot, PcStatusPill } from '../PcStatusPill';

const PcSystemInfoPanel: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');
  const { caps } = usePycoreCapability();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cuda = caps?.cuda;

  const load = useCallback(async () => {
    try {
      const loaded = await pycoreApi.getSystemInfo();
      if (loaded?.success) setInfo(loaded);
    } catch { /* keep the last info */ }
  }, []);

  useEffect(() => { void load(); }, [load]);
  usePcRefreshSignal(refreshSignal, load);

  const directOnly = usePcDirectOnly(PYCORE_HTTP_ROUTES.capabilityStatusOpenDirectory);

  const openDirectory = async (key: string, label: string) => {
    setOpening(key);
    setNotice(null);
    try {
      const answer = await pycoreApi.openStaticDir(key);
      setNotice(answer?.success ? t('aiStatus.openedDir', { label }) : t('aiStatus.openDirFailed', { label }));
    } catch {
      setNotice(t('aiStatus.openDirFailed', { label }));
    } finally {
      setOpening(null);
    }
  };

  return (
    <section className="pc-glass p-5 space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <Settings2 className="w-4 h-4 text-indigo-500" /> {t('aiStatus.constantsDirs')}
      </h2>

      <div className="rounded-2xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" /> {t('aiStatus.cuda')}
          </span>
          <PcStatusPill
            tone={cuda?.available ? 'ok' : 'idle'}
            label={cuda?.available ? t('aiStatus.cudaReady') : caps ? t('aiStatus.cudaNoGpu') : '…'}
          />
        </div>
        <div className="space-y-1 text-[10px] font-mono text-slate-400">
          <div>{t('aiStatus.cudaVersions', { driver: cuda?.driver_version ?? '-', cuda: cuda?.cuda_version ?? '-' })}</div>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1"><PcDot tone={cuda?.torch_installed ? 'ok' : 'idle'} /> torch</span>
            <span className="inline-flex items-center gap-1"><PcDot tone={cuda?.onnxruntime_installed ? 'ok' : 'idle'} /> onnxruntime</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <Lock className="w-3 h-3" /> {t('aiStatus.constantsDirsHint')}
      </p>
      {notice && <p className="text-[11px] text-indigo-500">{notice}</p>}

      {!info ? (
        <p className="text-[11px] italic text-slate-400">{t('aiStatus.systemInfoUnavailable')}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aiStatus.constants')}</h3>
            <ul className="space-y-1.5">
              {info.constants.map((constant) => (
                <li
                  key={constant.key}
                  className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5"
                  title={constant.note}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-slate-500">{constant.key}</span>
                    <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 text-right truncate" title={constant.value}>
                      {constant.value}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{constant.note}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aiStatus.staticDirs')}</h3>
            <ul className="space-y-1.5">
              {info.directories.map((directory) => (
                <li
                  key={directory.key}
                  className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{directory.label}</span>
                      {!directory.exists && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-amber-500">
                          <FolderX className="w-3 h-3" /> {t('aiStatus.missing')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 truncate" title={directory.path}>{directory.path}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void openDirectory(directory.key, directory.label); }}
                    disabled={!directory.exists || opening === directory.key || directOnly}
                    title={directOnly ? t('common.directOnlyPicker') : directory.exists ? t('aiStatus.openDirTitle', { label: directory.label }) : t('aiStatus.dirMissing')}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition pc-glass hover:bg-indigo-500/10 text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed">
                    {opening === directory.key ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                    {t('common.open')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};

export default PcSystemInfoPanel;
