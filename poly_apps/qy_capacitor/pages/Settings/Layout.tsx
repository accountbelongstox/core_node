/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

export const SettingsLayout = ({ title, children }: any) => {
  const { navigate } = useContext(AppContext);
  return (
    <div className="ds-aura-bg h-full flex flex-col animate-slide-up-fade relative">
      <div className="ds-aura-overlay" />
      {/* Minimal asymmetric floating island header (v4 TopBar language) */}
      <div className="fixed top-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="ds-glass ds-glass-edge rounded-full pl-2 pr-6 py-2 flex items-center gap-3 pointer-events-auto min-w-[220px]">
          <button
            onClick={() => navigate('settings')}
            className="ds-touch-target w-10 h-10 rounded-full bg-[var(--color-surface)] hover:bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--color-text-primary)] transition-all active:scale-90"
            aria-label="Back"
          >
            <Icons.Back />
          </button>
          <h1 className="text-xs font-bold text-[var(--color-text-primary)] tracking-[0.2em] uppercase flex-1 text-center">{title}</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="relative flex-1 overflow-y-auto custom-scrollbar px-[var(--page-padding-h)] pt-32 pb-32 ds-section-gap w-full max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
};

export const SettingItem = ({ label, value, onClick, type = 'arrow', active = false }: any) => (
  <div
    onClick={onClick}
    className="ds-row p-5 flex justify-between items-center cursor-pointer ds-touch-target transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
  >
    <span className="font-medium text-[var(--color-text-primary)] text-lg tracking-wide transition-colors">{label}</span>

    <div className="flex items-center gap-3">
      {value && <span className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">{value}</span>}

      {type === 'arrow' && <div className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></div>}

      {type === 'toggle' && (
        <div
          role="switch"
          aria-checked={active}
          className={`w-12 h-7 rounded-full p-1 transition-all duration-500 ease-out shadow-inner ${active ? 'shadow-[var(--klein-grad-glow)]' : ''}`}
          style={{ background: active ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-500 ${active ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
      )}

      {type === 'radio' && (
        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 ${active ? 'border-[var(--klein-blue)] shadow-[var(--klein-glow)]' : 'border-[var(--border-highlight)]'}`}>
          <div className={`w-3 h-3 bg-[var(--klein-blue)] rounded-full transition-all duration-300 ${active ? 'scale-100' : 'scale-0'}`} />
        </div>
      )}
    </div>
  </div>
);
