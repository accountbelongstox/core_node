/**
 * Source-specific part of an expanded orchestration task. Book tasks carry
 * their book in the row header; text-input sources (prompt_rewrite) list the
 * inline sentences the audio is generated from plus their origin reference.
 * Audio fill state of those sentences comes from the task's owner lane views
 * (OrchTaskLaneProgress).
 */
import React from 'react';
import type { OrchTask } from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';
import { orchTaskUsesBook } from './orchSources';

function formatRefValue(key: string, value: unknown): string {
  if (key === 'ts' && typeof value === 'number') return new Date(value * 1000).toLocaleString();
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

const OrchTextSentences: React.FC<{ task: OrchTask }> = ({ task }) => {
  const sentences = task.sentences || [];
  const refEntries = Object.entries(task.source_ref || {}).filter(([, value]) => value !== null && value !== '');
  return (
    <div className="space-y-1">
      {refEntries.length > 0 && (
        <p className="text-[10px] font-mono text-slate-500 break-all">
          {refEntries.map(([key, value]) => `${key}: ${formatRefValue(key, value)}`).join(' · ')}
        </p>
      )}
      <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.sourceItems} ({sentences.length})</p>
      {sentences.length === 0 && <p className="text-[11px] text-slate-500">{ORCH_L.noSourceItems}</p>}
      <div className="max-h-60 overflow-y-auto rounded-lg bg-slate-950/60 border border-slate-800 p-2 space-y-1">
        {sentences.map((sentence) => (
          <div key={sentence.seq} className="text-[11px] text-slate-200 break-words">
            <span className="mr-1 font-mono text-slate-600">{sentence.seq}</span>
            {sentence.text}
            {Object.entries(sentence.languages || {})
              .filter(([language, text]) => language !== sentence.language && text && text !== sentence.text)
              .map(([language, text]) => (
                <p key={language} className="ml-4 text-[10px] text-slate-500">{language}: {text}</p>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const OrchSourceDetail: React.FC<{ task: OrchTask | null }> = ({ task }) => {
  if (!task || orchTaskUsesBook(task)) return null;
  return <OrchTextSentences task={task} />;
};

export default OrchSourceDetail;
