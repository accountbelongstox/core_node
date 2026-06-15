/* [v4.1-Iris] WfErrorBoundary — wordflow-level error boundary.
 * Catches render/lifecycle crashes anywhere in the wordflow route tree so a
 * single broken page shows a friendly Iris-styled card instead of blanking the
 * whole sub-app. Sits ABOVE WfAppProvider (so provider crashes are caught
 * too) but below the shell, so i18n resolves via useShell().lang +
 * WfLanguageCenter.translate — no WfApp context required. */
import React from 'react';
import { useShell } from '../../shell/ShellContext';
import { translate } from './WfLanguageCenter';

interface WfErrorBoundaryInnerProps {
  /** Shell-language-bound translation helper (passed in by the wrapper). */
  t: (key: string, replacements?: Record<string, string | number>) => string;
  children?: React.ReactNode;
}

interface WfErrorBoundaryState {
  error: Error | null;
}

class WfErrorBoundaryInner extends React.Component<WfErrorBoundaryInnerProps, WfErrorBoundaryState> {
  /* This workspace ships react 19 without @types/react (React.Component is
   * inferred from JS via allowJs), so inherited members are untyped — declare
   * `props` explicitly for tsc. */
  declare props: Readonly<WfErrorBoundaryInnerProps>;

  state: WfErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WfErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[WfErrorBoundary] wordflow page crashed:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { t } = this.props;
    return (
      <div className="ds-page min-h-screen flex items-center justify-center px-4">
        <div className="ds-glass ds-glass-edge w-full max-w-md rounded-3xl p-8 text-center shadow-lg">
          <div
            className="ds-fab-grad mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            aria-hidden
          >
            !
          </div>
          <h1 className="mb-2 text-lg font-bold text-[var(--color-text-primary,inherit)]">
            {t('errorBoundary.title')}
          </h1>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {t('errorBoundary.description')}
          </p>
          <p className="mb-6 break-words rounded-xl bg-slate-100/70 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {error.message || String(error)}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="ds-fab-grad inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-8 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:opacity-90 active:scale-95"
          >
            {t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    );
  }
}

/** Function wrapper: binds t() to the shell language for the class boundary. */
export const WfErrorBoundary: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { lang } = useShell();
  const t = React.useCallback(
    (key: string, replacements?: Record<string, string | number>) =>
      translate(lang, key, replacements),
    [lang]
  );
  return <WfErrorBoundaryInner t={t}>{children}</WfErrorBoundaryInner>;
};

export default WfErrorBoundary;
