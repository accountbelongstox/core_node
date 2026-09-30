import React, { useEffect, useState } from 'react';
import { Check, Plus, RefreshCw, Server } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  wordNewPycoreLink,
  type WordNewPycoreCandidate,
  type WordNewPycoreLinkSnapshot,
} from '../../integrations/WordNewPycoreLink';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const STATE_DOT: Record<WordNewPycoreLinkSnapshot['state'], string> = {
  idle: 'bg-zinc-500',
  probing: 'bg-amber-400 animate-pulse',
  online: 'bg-emerald-400',
  offline: 'bg-rose-400',
};

function probeLabel(candidate: WordNewPycoreCandidate, trans: Props['trans']): string {
  const probe = candidate.probe;
  if (!probe) return trans('orchCompose.link.unprobed');
  if (probe.state === 'up') return trans('orchCompose.link.up', { ms: probe.ms ?? 0 });
  return trans(`orchCompose.link.state.${probe.state}`);
}

export function useWordNewPycoreLink(): WordNewPycoreLinkSnapshot {
  const [snapshot, setSnapshot] = useState(() => wordNewPycoreLink.getSnapshot());
  useEffect(() => {
    const unsubscribe = wordNewPycoreLink.subscribe(setSnapshot);
    void wordNewPycoreLink.ensure();
    return unsubscribe;
  }, []);
  return snapshot;
}

/** Online pycore used for cache reads: discovered entries, their probe, the selection. */
export const WordNewPycoreLinkPanel: React.FC<Props> = ({ theme, trans }) => {
  const snapshot = useWordNewPycoreLink();
  const [entry, setEntry] = useState('');
  const [entryError, setEntryError] = useState(false);

  const addEntry = (): void => {
    const ok = wordNewPycoreLink.choose(entry);
    setEntryError(!ok);
    if (ok) setEntry('');
  };

  return (
    <section className={`space-y-3 rounded-2xl border border-white/5 p-4 ${theme.cardClass}`}>
      <header className="flex items-center gap-2">
        <Server className="h-4 w-4 text-indigo-300" />
        <h3 className="flex-1 text-sm font-bold text-zinc-100">{trans('orchCompose.link.title')}</h3>
        <span className={`h-2 w-2 rounded-full ${STATE_DOT[snapshot.state]}`} aria-hidden />
        <span className="text-[11px] font-mono text-zinc-400">{trans(`orchCompose.link.summary.${snapshot.state}`)}</span>
        <button
          type="button"
          onClick={() => { void wordNewPycoreLink.refresh(); }}
          disabled={snapshot.state === 'probing'}
          className="rounded-lg border border-white/10 p-1.5 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          aria-label={trans('orchCompose.link.reprobe')}
          title={trans('orchCompose.link.reprobe')}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${snapshot.state === 'probing' ? 'animate-spin' : ''}`} />
        </button>
      </header>
      <p className="text-[11px] leading-relaxed text-zinc-500">{trans('orchCompose.link.hint')}</p>
      {snapshot.candidates.length === 0 ? (
        <p className="text-xs font-mono text-zinc-500">{trans('orchCompose.link.none')}</p>
      ) : (
        <ul className="space-y-1.5">
          {snapshot.candidates.map((candidate) => {
            const selected = candidate.url === snapshot.selectedUrl;
            return (
              <li key={candidate.url}>
                <button
                  type="button"
                  onClick={() => wordNewPycoreLink.choose(candidate.url)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    selected ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/5 hover:bg-white/5'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-zinc-200">{candidate.label}</span>
                    <span className="block truncate font-mono text-[10px] text-zinc-500">{candidate.url}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                    {trans(`orchCompose.link.kind.${candidate.kind}`)}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-400">{probeLabel(candidate, trans)}</span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addEntry();
        }}
      >
        <input
          value={entry}
          onChange={(event) => { setEntry(event.target.value); setEntryError(false); }}
          placeholder={trans('orchCompose.link.addPlaceholder')}
          aria-invalid={entryError}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-400/50"
        />
        <button type="submit" disabled={!entry.trim()} className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${theme.accentBg}`}>
          <Plus className="h-3.5 w-3.5" />{trans('orchCompose.link.add')}
        </button>
      </form>
      {entryError && <p className="text-[11px] text-rose-300">{trans('orchCompose.link.addInvalid')}</p>}
    </section>
  );
};
