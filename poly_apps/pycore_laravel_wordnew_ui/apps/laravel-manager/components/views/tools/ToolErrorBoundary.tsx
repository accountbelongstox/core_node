/** Isolates one tool workbench: a failed chunk load or render error shows a reload notice instead of a blank page. */
import React, { Component } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import i18n from '@/apps/laravel-manager/i18n';

interface ToolErrorBoundaryProps {
  children: React.ReactNode;
}

interface ToolErrorBoundaryState {
  message: string | null;
}

class ToolErrorBoundary extends Component<ToolErrorBoundaryProps, ToolErrorBoundaryState> {
  state: ToolErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ToolErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{i18n.t('uiTools.workbench.failed')}</p>
        <p className="max-w-md break-words font-mono text-xs text-slate-500">{this.state.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <RotateCw className="h-4 w-4" /> {i18n.t('uiTools.workbench.reload')}
        </button>
      </div>
    );
  }
}

export default ToolErrorBoundary;
