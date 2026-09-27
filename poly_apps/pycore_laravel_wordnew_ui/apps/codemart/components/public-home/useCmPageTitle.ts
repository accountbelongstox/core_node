import { useEffect } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

const DESCRIPTION_SELECTOR = 'meta[name="description"]';

/** Localized document title and meta description for a public CodeMart page. */
export function useCmPageTitle(titleKey: string, descriptionKey: string): void {
  const { t } = useTranslation('cm');
  const title = `${t(titleKey)} · ${t('brand.name')}`;
  const description = t(descriptionKey);

  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.head.querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR);
    const created = meta === null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    document.title = title;
    meta.content = description;
    return () => {
      document.title = previousTitle;
      if (created) meta?.remove();
      else if (meta) meta.content = previousDescription;
    };
  }, [title, description]);
}
