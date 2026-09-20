import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, LoaderCircle } from 'lucide-react';
import { copyImageToSystemClipboard, copyTextToSystemClipboard } from '../../core/browser/SystemClipboard';
import './CloudClipboardLocales';

interface Props {
  text?: string;
  loadImage?: () => Promise<Blob>;
  className?: string;
}

const defaultClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-500/10 disabled:opacity-40';

export default function CloudClipboardCopyButton({ text, loadImage, className = defaultClass }: Props) {
  const { t } = useTranslation('cloudClipboard');
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const active = useRef(true);
  const inFlight = useRef(false);
  const label = loadImage ? 'copyImage' : 'copyContent';

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    const timer = status === 'contentCopied' ? setTimeout(() => setStatus(''), 2000) : null;
    if (timer) return () => clearTimeout(timer);
  }, [status]);

  const copy = async (): Promise<void> => {
    let result = '';
    if (inFlight.current) return;
    inFlight.current = true;
    setCopying(true);
    setStatus('');
    try {
      result = loadImage ? await copyImageToSystemClipboard(loadImage)
        : await copyTextToSystemClipboard(text ?? '') ? 'copied' : 'failed';
      if (active.current) setStatus(result === 'copied' ? 'contentCopied' : result === 'unsupported' ? 'imageCopyUnsupported' : 'copyFailed');
    } catch {
      if (active.current) setStatus('copyFailed');
    } finally {
      inFlight.current = false;
      if (active.current) setCopying(false);
    }
  };

  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" className={className} disabled={copying || (!loadImage && !text?.length)}
      title={t(label)} aria-label={t(label)} onClick={() => void copy()}>
      {copying ? <LoaderCircle size={14} className="animate-spin" /> : status === 'contentCopied' ? <Check size={14} /> : <Copy size={14} />}
      {t(copying ? 'copying' : status === 'contentCopied' ? 'contentCopied' : label)}
    </button>
    <span role="status" aria-live="polite" className={status === 'contentCopied' ? 'sr-only' : 'text-xs text-amber-600 dark:text-amber-400'}>
      {status ? t(status) : ''}
    </span>
  </span>;
}
