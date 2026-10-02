import React from 'react';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import type { WordNewAudioFileVariant } from '../api/types/media';
import { translateActive } from '../WfNewLocales';
import { sentenceVariantLabel } from '../utils/WordNewSentenceAudioPick';

export interface WordNewAudioVariantPickerProps {
  variants: WordNewAudioFileVariant[];
  selectedKey: string;
  onSelect: (variantKey: string) => void;
  trans?: (key: string) => string;
  className?: string;
}

export const WordNewAudioVariantPicker: React.FC<WordNewAudioVariantPickerProps> = ({
  variants,
  selectedKey,
  onSelect,
  trans,
  className = '',
}) => {
  if (variants.length < 2) return null;

  return (
    <div
      className={`shrink-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <SegmentedControl
        size="xs"
        ariaLabel={trans?.('reader.variantPicker') ?? translateActive('reader.variantPicker')}
        value={selectedKey}
        onChange={onSelect}
        options={variants.map((v) => ({ value: v.variantKey ?? '', label: sentenceVariantLabel(v, trans), title: sentenceVariantLabel(v, trans) }))}
      />
    </div>
  );
};

export default WordNewAudioVariantPicker;
