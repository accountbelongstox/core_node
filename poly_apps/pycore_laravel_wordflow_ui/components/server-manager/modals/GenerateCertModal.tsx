import React from 'react';
import { XCircle } from 'lucide-react';
import { Language } from '../../../types';
import { TRANSLATIONS } from '../../../constants';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';
import { Field } from '../../common';

interface GenerateCertModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  onGenerate: (domain: string, provider?: string, staging?: boolean) => void;
}

const GenerateCertModal: React.FC<GenerateCertModalProps> = ({ isOpen, lang, onClose, onGenerate }) => {
  const t = TRANSLATIONS[lang].server;

  if (!isOpen) return null;

  return (
    <Portal>
    <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
      <div className="relative bg-white dark:bg-slate-800 rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-lg">{t.ssl.generate}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <Field label={t.ssl.domain} htmlFor="cert-domain">
            <input
              type="text"
              id="cert-domain"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="example.com"
            />
          </Field>
          <Field label="Provider (Optional)" htmlFor="cert-provider">
            <select
              id="cert-provider"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">Auto</option>
              <option value="dnspod">DNSPod</option>
              <option value="cloudflare">Cloudflare</option>
            </select>
          </Field>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cert-staging"
              className="w-4 h-4"
            />
            <label htmlFor="cert-staging" className="text-sm">Use Staging Environment</label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const domain = (document.getElementById('cert-domain') as HTMLInputElement)?.value;
                const provider = (document.getElementById('cert-provider') as HTMLSelectElement)?.value;
                const staging = (document.getElementById('cert-staging') as HTMLInputElement)?.checked;
                if (domain) {
                  onGenerate(domain, provider || undefined, staging);
                }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
};

export default GenerateCertModal;
