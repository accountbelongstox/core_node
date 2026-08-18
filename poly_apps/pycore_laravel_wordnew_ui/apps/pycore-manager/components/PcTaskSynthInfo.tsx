/**
 * Engine + generation command strip for in-flight / finished speech tasks.
 */
import React from 'react';

interface PcTaskSynthInfoProps {
  engine?: string | null;
  synthCommand?: string | null;
  processing?: boolean;
}

export const PcTaskSynthInfo: React.FC<PcTaskSynthInfoProps> = ({
  engine,
  synthCommand,
  processing,
}) => {
  if (!engine && !synthCommand && !processing) return null;
  return (
    <div className="space-y-2">
      {engine ? (
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-0.5">
            {processing ? 'Generating engine' : 'Engine'}
          </div>
          <div className="text-sm font-mono text-slate-800 dark:text-slate-200">{engine}</div>
        </div>
      ) : processing ? (
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-0.5">
            Generating engine
          </div>
          <div className="text-sm text-slate-500 italic">Resolving TTS engine…</div>
        </div>
      ) : null}
      {synthCommand ? (
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-0.5">
            Generation command
          </div>
          <pre className="p-3 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
            {synthCommand}
          </pre>
        </div>
      ) : processing ? (
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-0.5">
            Generation command
          </div>
          <div className="text-sm text-slate-500 italic">Waiting for synthesis to start…</div>
        </div>
      ) : null}
    </div>
  );
};

function pickStringField(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

export function extractSynthCommand(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const obj = source as Record<string, unknown>;
  const direct = pickStringField(obj, 'synth_command');
  if (direct) return direct;
  const words = obj.words;
  if (Array.isArray(words) && words.length > 0) {
    const first = words[0];
    if (first && typeof first === 'object') {
      return pickStringField(first as Record<string, unknown>, 'synth_command');
    }
  }
  return null;
}

export function extractEngine(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const obj = source as Record<string, unknown>;
  const direct = pickStringField(obj, 'engine') ?? pickStringField(obj, 'provider');
  if (direct) return direct;
  const words = obj.words;
  if (Array.isArray(words) && words.length > 0) {
    const first = words[0];
    if (first && typeof first === 'object') {
      const row = first as Record<string, unknown>;
      return pickStringField(row, 'engine') ?? pickStringField(row, 'provider');
    }
  }
  return null;
}
