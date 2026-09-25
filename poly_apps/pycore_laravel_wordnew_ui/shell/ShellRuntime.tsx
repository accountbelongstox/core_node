import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useTranslation } from '../core/i18n/UiI18n';
import { AppToaster } from '../shared/notify/notify';
import { TaskPersistenceProvider } from '../core/tasks/TaskPersistenceProvider';
import { ShellProvider } from './ShellProvider';
import { ShellCloudClipboard } from './ShellCloudClipboard';
import PromptDerivedHost from '../shared/prompt-derived/PromptDerivedHost';
import { ShellLaravelEndpointBridge } from './ShellLaravelEndpointBridge';

interface ShellRuntimeProps {
  authHost?: React.ReactNode;
  children: React.ReactNode;
}

export const ShellRouteFallback: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">
      {t('common.loading')}
    </div>
  );
};

export const ShellRuntime: React.FC<ShellRuntimeProps> = ({ authHost, children }) => (
  <TaskPersistenceProvider>
    <BrowserRouter>
      <ShellProvider>
        <ShellLaravelEndpointBridge />
        <AppToaster />
        {authHost}
        {children}
        <ShellCloudClipboard />
        <PromptDerivedHost />
      </ShellProvider>
    </BrowserRouter>
  </TaskPersistenceProvider>
);

export default ShellRuntime;
