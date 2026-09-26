import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmPublicIllustration } from './CmPublicBlocks';
import type { CmPublicImageName } from './cmPublicImages';

const HERO_ROTATION_MS = 7000;
const HERO_SLIDES: ReadonlyArray<{ titleKey: string; subtitleKey: string; altKey: string; variant: string; image: CmPublicImageName }> = [
  { titleKey: 'publicHome.hero.slide1Title', subtitleKey: 'publicHome.hero.slide1Subtitle', altKey: 'publicHome.hero.slide1Alt', variant: 'delivery', image: 'hero-delivery' },
  { titleKey: 'publicHome.hero.slide2Title', subtitleKey: 'publicHome.hero.slide2Subtitle', altKey: 'publicHome.hero.slide2Alt', variant: 'milestones', image: 'hero-marketplace' },
  { titleKey: 'publicHome.hero.slide3Title', subtitleKey: 'publicHome.hero.slide3Subtitle', altKey: 'publicHome.hero.slide3Alt', variant: 'specialists', image: 'hero-escrow' },
];

export interface CmHeroProps {
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onRegister?: () => void;
}

export const CmHero: React.FC<CmHeroProps> = ({ onPrimaryAction, onSecondaryAction, onRegister }) => {
  const { t } = useTranslation('cm');
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !rotationEnabled || hovered) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, HERO_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [hovered, rotationEnabled]);

  const showPrevious = (): void => {
    setActiveIndex((current) => (current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };
  const showNext = (): void => {
    setActiveIndex((current) => (current + 1) % HERO_SLIDES.length);
  };
  const activeSlide = HERO_SLIDES[activeIndex];

  return (
    <section
      className="cm-hero"
      data-variant={activeSlide.variant}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('common.heroRegion')}
      onFocusCapture={() => setRotationEnabled(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="cm-hero__grid" aria-hidden="true" />
      <div className="cm-hero__orb cm-hero__orb--one" aria-hidden="true" />
      <div className="cm-hero__orb cm-hero__orb--two" aria-hidden="true" />
      <button
        type="button"
        className="cm-hero__rotation"
        onClick={() => setRotationEnabled((current) => !current)}
        aria-label={rotationEnabled ? t('common.stopRotation') : t('common.startRotation')}
      >
        {rotationEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <button type="button" className="cm-hero__arrow cm-hero__arrow--previous" onClick={showPrevious} aria-label={t('common.previous')}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <div
        className="cm-public-container cm-hero__content"
        role="group"
        aria-roledescription="slide"
        aria-label={t('common.slidePosition', { number: activeIndex + 1, total: HERO_SLIDES.length })}
        aria-live={rotationEnabled && !hovered ? 'off' : 'polite'}
      >
        <div className="cm-hero__copy">
          <p className="cm-hero__eyebrow">{t('publicHome.eyebrow')}</p>
          <h1 key={`${activeIndex}-title`}>{t(activeSlide.titleKey)}</h1>
          <p key={`${activeIndex}-subtitle`} className="cm-hero__subtitle">{t(activeSlide.subtitleKey)}</p>
          <div className="cm-hero__actions">
            <button type="button" className="cm-public-button cm-public-button--primary" onClick={onPrimaryAction}>
              {t('publicHome.hero.primaryAction')}
            </button>
            <button type="button" className="cm-public-button cm-public-button--outline" onClick={onSecondaryAction}>
              {t('publicHome.hero.secondaryAction')}
            </button>
            {onRegister && (
              <button type="button" className="cm-public-button cm-public-button--ghost" onClick={onRegister}>
                {t('nav.register')}
              </button>
            )}
          </div>
        </div>
        <div className="cm-hero__media" key={`${activeIndex}-media`}>
          <CmPublicIllustration name={activeSlide.image} altKey={activeSlide.altKey} eager />
        </div>
      </div>
      <button type="button" className="cm-hero__arrow cm-hero__arrow--next" onClick={showNext} aria-label={t('common.next')}>
        <ChevronRight aria-hidden="true" />
      </button>
      <div className="cm-hero__pagination">
        {HERO_SLIDES.map((slide, index) => (
          <button
            type="button"
            key={slide.variant}
            className={index === activeIndex ? 'is-active' : ''}
            onClick={() => setActiveIndex(index)}
            aria-label={t('common.goToSlide', { number: index + 1 })}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  );
};

export default CmHero;
