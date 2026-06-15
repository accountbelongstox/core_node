/* [v4.1-Iris] New: API Initialization Check modal. Iris gradient hero + ds-modal-panel, lucide status glyphs, ds-row lists (no raw tables), phone column max-w-md, Portal-mounted (top-most). Reference-parity with design-reference-{light,dark}.webp. */
import React, { useContext, useEffect, useState } from 'react';
import { CircleCheck, CircleX, CircleDashed, TriangleAlert } from 'lucide-react';
import { AppContext } from '../contexts/AppContext';
import { ApiCenter, InitComplianceResponse, InitComplianceSection, InitComplianceLanguage } from '../services/ApiCenter';
import { Portal, Badge, Button, Spinner, IconButton, Icons } from './UI';

interface Props {
  onClose: () => void;
}

const StatusGlyph = ({ status }: { status: string }) => {
  if (status === 'pass') {
    return <CircleCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  }
  if (status === 'fail') {
    return <CircleX className="w-4 h-4 text-red-500 flex-shrink-0" />;
  }
  if (status === 'warn') {
    return <TriangleAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  }
  return <CircleDashed className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />;
};

export const InitComplianceModal = ({ onClose }: Props) => {
  const { t } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InitComplianceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await ApiCenter.system.getInitCompliance();
    if (res.success && res.data) {
      setData(res.data);
      setLastChecked(new Date());
    } else {
      let msg = t('settings.initCheckError');
      if (res.message) {
        msg = res.message;
      } else if (res.error && res.error.message) {
        msg = res.error.message;
      }
      setError(msg);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderSection = (section: InitComplianceSection) => (
    <div key={section.key} className="ds-row p-4">
      <div className="flex items-start gap-3">
        <StatusGlyph status={section.status} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--color-text-primary)]">{section.name}</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{section.summary}</p>
          {section.items && section.items.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {section.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <StatusGlyph status={item.status} />
                  <span className="text-[var(--color-text-secondary)] flex-1 min-w-0 truncate">{item.label}</span>
                  <span className="text-[var(--color-text-tertiary)] font-mono">{String(item.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLanguage = (lang: InitComplianceLanguage) => (
    <div key={lang.lang} className="flex items-center gap-3 px-3 py-2 text-xs border-b border-[var(--border-highlight)] last:border-0">
      <span className="font-mono w-10 text-[var(--color-text-primary)]">{lang.lang}</span>
      <span className="flex-1 text-[var(--color-text-secondary)]">
        {t('settings.initCheckFormal')}: {lang.formal} · {t('settings.initCheckStaging')}: {lang.staging}
      </span>
      {!lang.promoted && (
        <Badge tone="danger">{t('settings.initCheckUnpromoted')}</Badge>
      )}
      <StatusGlyph status={lang.status} />
    </div>
  );

  return (
    <Portal>
      <div
        className="ds-modal-backdrop fixed inset-0 ds-z-modal flex items-center justify-center p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.initCheck')}
        onClick={onClose}
      >
        <div
          className="ds-modal-panel max-w-md mx-auto w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Iris gradient hero header */}
          <div
            className="p-5 relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', color: 'var(--klein-on)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-lg">{t('settings.initCheck')}</h2>
                <p className="text-sm opacity-80 mt-0.5">{t('settings.initCheckDesc')}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {data && (
                  <Badge tone={data.compliant ? 'success' : 'danger'}>
                    {data.compliant ? t('settings.initCheckCompliant') : t('settings.initCheckNonCompliant')}
                  </Badge>
                )}
                <IconButton
                  icon={<Icons.Close />}
                  onClick={onClose}
                  className="!text-[var(--klein-on)] hover:!bg-white/15"
                  aria-label="Close"
                />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 ds-section-gap">
            {loading && (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )}

            {!loading && error && (
              <div className="ds-row p-4 text-sm text-red-500">
                {t('settings.initCheckError')}: {error}
              </div>
            )}

            {!loading && !error && data && (
              <>
                <div className="space-y-3">
                  {data.sections.map(renderSection)}
                </div>

                {data.languages && data.languages.length > 0 && (
                  <div className="ds-row p-4">
                    <p className="ds-section-label mb-2">{t('settings.initCheckLanguages')}</p>
                    <div className="max-h-60 overflow-y-auto">
                      {data.languages.map(renderLanguage)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-highlight)] p-4 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {lastChecked && `${t('settings.initCheckLastChecked')} ${lastChecked.toLocaleTimeString()}`}
            </span>
            <Button variant="klein" onClick={() => void load()} disabled={loading}>
              {loading ? <Spinner size="sm" /> : t('settings.initCheckRefresh')}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
