/** Output format + quality controls shared by the image workbenches that export a raster file. */
import React from 'react';
import { Field, Segmented, Slider, useMediaT } from './MediaKit';
import { supportsEncoding, type ImageMime } from './imageOps';

export const FORMAT_LABELS: Record<ImageMime, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP' };
export const DEFAULT_QUALITY = 0.92;
const QUALITY_MIN = 1;
const QUALITY_MAX = 100;

interface Props {
  format: ImageMime;
  quality: number;
  onFormat: (format: ImageMime) => void;
  onQuality: (quality: number) => void;
  formats?: readonly ImageMime[];
}

export const ALL_FORMATS: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/webp'];

export const ImageOutputControls: React.FC<Props> = ({ format, quality, onFormat, onQuality, formats = ALL_FORMATS }) => {
  const m = useMediaT();
  return (
    <>
      <Field label={m('output.format')}>
        <Segmented
          value={format}
          onChange={onFormat}
          ariaLabel={m('output.format')}
          options={formats.map((value) => ({ value, label: FORMAT_LABELS[value], disabled: !supportsEncoding(value) }))}
        />
      </Field>
      {format !== 'image/png' && (
        <Field label={m('output.quality')}>
          <Slider value={Math.round(quality * 100)} min={QUALITY_MIN} max={QUALITY_MAX} onChange={(v) => onQuality(v / 100)} format={(v) => `${v}%`} ariaLabel={m('output.quality')} />
        </Field>
      )}
    </>
  );
};
