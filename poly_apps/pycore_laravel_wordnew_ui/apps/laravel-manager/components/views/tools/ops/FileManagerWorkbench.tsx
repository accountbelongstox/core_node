/** File Manager: the Server Manager's file browser panel (browse, preview, edit, download) under the ops status bar. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/apps/laravel-manager/uiTypes';
import ServerFileManagerPanel from '../../../server-manager/panels/ServerFileManagerPanel';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { OpsPage, OpsStatusBar } from './opsKit';

const FileManagerWorkbench: React.FC<ToolWorkbenchProps> = () => {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  return (
    <OpsPage>
      <OpsStatusBar accent="teal" mode="server">{t('toolsOps.files.status')}</OpsStatusBar>
      <ServerFileManagerPanel lang={lang} />
    </OpsPage>
  );
};

export default FileManagerWorkbench;
