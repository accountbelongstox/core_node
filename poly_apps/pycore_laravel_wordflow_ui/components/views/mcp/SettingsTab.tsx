import React from 'react';
import { commonClasses } from '../../../styles/theme';
import { TRANSLATIONS } from '../../../constants';
import type { Language } from '../../../types';

/** MCP Settings tab (placeholder). Self-contained — derives its own strings. */
const SettingsTab: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].mcp;
  return (
    <div className={`${commonClasses.card} p-6`}>
      <h3 className="text-lg font-semibold mb-4">{t.settings.title}</h3>
      <p className="text-slate-500">{t.settings.coming_soon}</p>
    </div>
  );
};

export default SettingsTab;
