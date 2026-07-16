import React from 'react';
import type { WfAudioFileVariant } from '../api/types/media';
import { sentenceVariantLabel } from '../utils/WfSentenceAudioPick';

export interface WfAudioVariantPickerProps {
  variants: WfAudioFileVariant[];
  selectedKey: string;
  onSelect: (variantKey: string) => void;
  trans?: (key: string) => string;
  className?: string;
}

export const WfAudioVariantPicker: React.FC<WfAudioVariantPickerProps> = ({
  variants,
  selectedKey,
  onSelect,
  trans,
  className = '',
}) => {
  if (variants.length < 2) return null;

  return (
    <div
      className={`flex flex-wrap gap-0.5 shrink-0 ${className}`}
      role="group"
      aria-label={trans?.('reader.variantPicker') ?? 'Voice variant'}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {variants.map((v) => {
        const key = v.variantKey ?? '';
        const active = key === selectedKey;
        return (
          <button
            key={key || 'primary'}
            type="button"
            title={sentenceVariantLabel(v, trans)}
            aria-pressed={active}
            onClick={() => onSelect(key)}
            className={`px-1 py-0.5 rounded text-[8px] font-mono uppercase border transition-colors ${
              active
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
                : 'border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/20'
            }`}
          >
            {sentenceVariantLabel(v, trans)}
          </button>
        );
      })}
    </div>
  );
};

export default WfAudioVariantPicker;
