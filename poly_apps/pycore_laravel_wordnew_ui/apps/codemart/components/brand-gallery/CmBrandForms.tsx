import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import {
  CM_BRAND_FORMS,
  CM_BRAND_SIZES,
  cmBrandCandidateUrl,
  fitEdge,
  type CmBrandCandidate,
  type CmBrandForm,
  type CmBrandManifest,
} from './cmBrandGalleryData';

const FORM_KEYS: Record<CmBrandForm, { label: string; hint: string }> = {
  mark: { label: 'brandGallery.formMark', hint: 'brandGallery.formMarkHint' },
  lockup: { label: 'brandGallery.formLockup', hint: 'brandGallery.formLockupHint' },
  text: { label: 'brandGallery.formText', hint: 'brandGallery.formTextHint' },
};

interface CmBrandFormsProps {
  candidate: CmBrandCandidate;
  manifest: CmBrandManifest;
}

const FormStrip: React.FC<{ candidate: CmBrandCandidate; form: CmBrandForm; aspect: number; dark: boolean }> = ({ candidate, form, aspect, dark }) => {
  const { t } = useTranslation('cm');
  const files = candidate.files[form];
  const file = files ? (dark ? files.white ?? files.png : files.svg ?? files.png) : undefined;
  const url = cmBrandCandidateUrl(candidate.id, file);
  if (!url) return null;
  return (
    <div className={`cm-brand-forms__strip ${dark ? 'is-dark' : 'is-light'}`} role="group" aria-label={t(dark ? 'brandGallery.backgroundDark' : 'brandGallery.backgroundLight')}>
      {CM_BRAND_SIZES.map((size) => {
        const edge = fitEdge(aspect, size);
        return (
          <figure key={size}>
            <img src={url} alt="" width={edge.width} height={edge.height} loading="lazy" decoding="async" draggable={false} />
            <figcaption>{t('brandGallery.sizeLabel', { size })}</figcaption>
          </figure>
        );
      })}
    </div>
  );
};

export const CmBrandForms: React.FC<CmBrandFormsProps> = ({ candidate, manifest }) => {
  const { t } = useTranslation('cm');
  return (
    <div className="cm-brand-forms">
      {CM_BRAND_FORMS.map((form) => {
        const [, , w, h] = manifest.forms[form];
        const aspect = candidate.kind === 'raster' ? 1 : w / h;
        const available = Boolean(candidate.files[form]);
        return (
          <section key={form} className="cm-brand-forms__form">
            <h4>{t(FORM_KEYS[form].label)}</h4>
            <p className="cm-brand-gallery__muted">{t(FORM_KEYS[form].hint)}</p>
            {available ? (
              <>
                <FormStrip candidate={candidate} form={form} aspect={aspect} dark={false} />
                <FormStrip candidate={candidate} form={form} aspect={aspect} dark />
              </>
            ) : (
              <p className="cm-brand-gallery__muted">{t('brandGallery.formMissing')}</p>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default CmBrandForms;
