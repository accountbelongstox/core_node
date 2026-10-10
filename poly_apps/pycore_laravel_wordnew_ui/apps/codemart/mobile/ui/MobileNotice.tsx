import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;

export const MobileNotice: React.FC<{ tone?: keyof typeof ICONS; children: React.ReactNode; action?: React.ReactNode }> = ({ tone = 'info', children, action }) => {
  const Icon = ICONS[tone];
  return (
    <div className="cmm-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <p>{children}</p>
      {action}
    </div>
  );
};
