import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmBrandCandidateUrl, type CmBrandCandidate, type CmBrandManifest } from './cmBrandGalleryData';

type CompareMode = 'side' | 'overlay' | 'diff';

const MODES: ReadonlyArray<{ id: CompareMode; labelKey: string }> = [
  { id: 'side', labelKey: 'brandGallery.modeSideBySide' },
  { id: 'overlay', labelKey: 'brandGallery.modeOverlay' },
  { id: 'diff', labelKey: 'brandGallery.modeDiff' },
];
const DIFF_SCALE = 3;
const INK_THRESHOLD = 150;
const DEFAULT_OPACITY = 55;
const COLOR_CANDIDATE: readonly number[] = [226, 61, 61];
const COLOR_SOURCE: readonly number[] = [52, 120, 235];
const COLOR_BOTH: readonly number[] = [70, 76, 86];

interface CmBrandCompareProps {
  candidate: CmBrandCandidate;
  manifest: CmBrandManifest;
  sourceUrl: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
}

function inkMask(image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const mask = new Uint8Array(width * height);
  if (!context) return mask;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11 < INK_THRESHOLD ? 1 : 0;
  }
  return mask;
}

const CmBrandDiffCanvas: React.FC<{ sourceUrl: string; candidateUrl: string; manifest: CmBrandManifest }> = ({ sourceUrl, candidateUrl, manifest }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation('cm');
  const [x0, y0, w, h] = manifest.forms.lockup;

  useEffect(() => {
    let active = true;
    Promise.all([loadImage(sourceUrl), loadImage(candidateUrl)])
      .then(([source, candidate]) => {
        const canvas = canvasRef.current;
        if (!active || !canvas) return;
        const width = w * DIFF_SCALE;
        const height = h * DIFF_SCALE;
        const sourceInk = inkMask(source, x0, y0, w, h, width, height);
        const candidateInk = inkMask(candidate, 0, 0, candidate.naturalWidth, candidate.naturalHeight, width, height);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return;
        const image = context.createImageData(width, height);
        for (let i = 0; i < sourceInk.length; i += 1) {
          const color = sourceInk[i] && candidateInk[i] ? COLOR_BOTH : candidateInk[i] ? COLOR_CANDIDATE : sourceInk[i] ? COLOR_SOURCE : null;
          if (color) {
            image.data[i * 4] = color[0];
            image.data[i * 4 + 1] = color[1];
            image.data[i * 4 + 2] = color[2];
            image.data[i * 4 + 3] = 255;
          }
        }
        context.putImageData(image, 0, 0);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [sourceUrl, candidateUrl, x0, y0, w, h]);

  if (failed) return <p className="cm-brand-gallery__muted">{t('brandGallery.loadFailed')}</p>;
  return (
    <div className="cm-brand-compare__stage cm-brand-compare__stage--diff" style={{ aspectRatio: `${w} / ${h}` }}>
      <canvas ref={canvasRef} className="cm-brand-compare__canvas" role="img" aria-label={t('brandGallery.modeDiff')} />
    </div>
  );
};

export const CmBrandCompare: React.FC<CmBrandCompareProps> = ({ candidate, manifest, sourceUrl }) => {
  const { t } = useTranslation('cm');
  const [mode, setMode] = useState<CompareMode>('side');
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const lockup = candidate.files.lockup;
  const candidateUrl = cmBrandCandidateUrl(candidate.id, lockup?.svg);
  const candidatePng = cmBrandCandidateUrl(candidate.id, lockup?.png);
  const [x0, y0, w, h] = manifest.forms.lockup;

  if (!candidateUrl || !candidatePng) return <p className="cm-brand-gallery__muted">{t('brandGallery.compareUnavailable')}</p>;

  const sourceStyle: React.CSSProperties = {
    width: `${(manifest.source.width / w) * 100}%`,
    left: `${(-x0 / w) * 100}%`,
    top: `${(-y0 / h) * 100}%`,
  };
  const stageStyle: React.CSSProperties = { aspectRatio: `${w} / ${h}` };
  const sourceImage = <img className="cm-brand-compare__source" src={sourceUrl} alt="" style={sourceStyle} draggable={false} />;
  const candidateImage = (extra?: React.CSSProperties) => (
    <img className="cm-brand-compare__candidate" src={candidateUrl} alt="" style={extra} draggable={false} />
  );

  return (
    <div className="cm-brand-compare">
      <div className="cm-brand-gallery__segmented" role="group" aria-label={t('brandGallery.compareTitle')}>
        {MODES.map((item) => (
          <button key={item.id} type="button" className={mode === item.id ? 'is-active' : ''} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      {mode === 'side' && (
        <div className="cm-brand-compare__pair">
          <figure>
            <div className="cm-brand-compare__stage" style={stageStyle}>{sourceImage}</div>
            <figcaption>{t('brandGallery.compareOriginal')}</figcaption>
          </figure>
          <figure>
            <div className="cm-brand-compare__stage" style={stageStyle}>{candidateImage()}</div>
            <figcaption>{t('brandGallery.compareCandidate')}</figcaption>
          </figure>
        </div>
      )}
      {mode === 'overlay' && (
        <>
          <div className="cm-brand-compare__stage" style={stageStyle}>
            {sourceImage}
            {candidateImage({ opacity: opacity / 100 })}
          </div>
          <label className="cm-brand-compare__slider">
            <span>{t('brandGallery.overlayAmount')}</span>
            <input type="range" min={0} max={100} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} />
            <output>{opacity}%</output>
          </label>
        </>
      )}
      {mode === 'diff' && (
        <>
          <CmBrandDiffCanvas sourceUrl={sourceUrl} candidateUrl={candidatePng} manifest={manifest} />
          <ul className="cm-brand-compare__legend">
            <li><i style={{ background: `rgb(${COLOR_CANDIDATE.join(' ')})` }} />{t('brandGallery.legendCandidate')}</li>
            <li><i style={{ background: `rgb(${COLOR_SOURCE.join(' ')})` }} />{t('brandGallery.legendSource')}</li>
            <li><i style={{ background: `rgb(${COLOR_BOTH.join(' ')})` }} />{t('brandGallery.legendBoth')}</li>
          </ul>
        </>
      )}
    </div>
  );
};

export default CmBrandCompare;
