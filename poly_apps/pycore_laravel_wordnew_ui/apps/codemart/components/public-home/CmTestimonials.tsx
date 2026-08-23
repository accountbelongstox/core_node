import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmPublicTestimonialData } from '../../api';

export const CmTestimonials: React.FC<{ items: CmPublicTestimonialData[] }> = ({ items }) => {
  const { t } = useTranslation('cm');
  const [activeIndex, setActiveIndex] = useState(0);
  if (items.length === 0) return null;
  const safeIndex = activeIndex % items.length;
  const item = items[safeIndex];
  const showPrevious = (): void => setActiveIndex((safeIndex - 1 + items.length) % items.length);
  const showNext = (): void => setActiveIndex((safeIndex + 1) % items.length);

  return (
    <section className="cm-testimonials">
      <div className="cm-public-container">
        <h2>{t('publicHome.testimonials.title')}</h2>
        <div className="cm-testimonials__carousel">
          <button type="button" onClick={showPrevious} aria-label={t('common.previous')}><ChevronLeft aria-hidden="true" /></button>
          <figure>
            <Quote className="cm-testimonials__quote-mark" aria-hidden="true" />
            <blockquote>{item.quote}</blockquote>
            <figcaption>
              {item.avatar_url ? <img src={item.avatar_url} alt="" /> : <span className="cm-testimonials__avatar" aria-hidden="true">{item.author_label.slice(0, 1)}</span>}
              <span><strong>{item.author_label}</strong><small>{item.role_label}</small></span>
            </figcaption>
          </figure>
          <button type="button" onClick={showNext} aria-label={t('common.next')}><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
};

export default CmTestimonials;
