/** Prompt Manager: a browser-side template library plus the server's task-dispatch prompt mappings. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Server } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { OpsPage, OpsStatusBar, Seg } from './opsKit';
import PromptMappings from './PromptMappings';
import PromptTemplates from './PromptTemplates';

type Source = 'templates' | 'mappings';

const PromptManagerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>('templates');
  return (
    <OpsPage>
      <Seg
        accent="fuchsia"
        value={source}
        onChange={setSource}
        options={[
          { value: 'templates', label: t('toolsOps.prompt.tab_templates'), icon: Monitor },
          { value: 'mappings', label: t('toolsOps.prompt.tab_mappings'), icon: Server },
        ]}
      />
      {source === 'templates' ? (
        <>
          <OpsStatusBar accent="fuchsia" mode="local">{t('toolsOps.prompt.templates_status')}</OpsStatusBar>
          <PromptTemplates />
        </>
      ) : (
        <PromptMappings apiMethod={tool.apiMethod} />
      )}
    </OpsPage>
  );
};

export default PromptManagerWorkbench;
