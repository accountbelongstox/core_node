/**
 * Choose short passages to add to a composition: agent / daily-reading articles and prompt-rewrite
 * results, one tab each, both through the one reusable source list. Several passages can be added;
 * the ones already in the composition show a check.
 */
import React, { useMemo, useState } from 'react';
import { Newspaper, Sparkles } from 'lucide-react';
import { OrchTabs } from './OrchTabs';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewAgentArticle } from '../../api';
import type { OrchComposePassageRef, OrchPassageStore } from '../../../../shared/orchestration/orchTypes';
import { WfNewOrchSourceList, type OrchSourceAdapter, type OrchSourceListItem } from './WfNewOrchSourceList';
import { matches, promptAdapter } from './WordNewOrchSourcePicker';

interface Props {
  /** `orchPassageKey` of the entries already in the composition. */
  taken: ReadonlySet<string>;
  onPick: (ref: OrchComposePassageRef) => void;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ARTICLE_PAGE_SIZE = 20;
const PREVIEW_CHARS = 140;

const TABS: Array<{ store: OrchPassageStore; labelKey: string; icon: typeof Newspaper }> = [
  { store: 'article', labelKey: 'orchCompose.passages.articles', icon: Newspaper },
  { store: 'prompt', labelKey: 'orchCompose.source.prompts', icon: Sparkles },
];

function articleRef(article: WfNewAgentArticle): OrchComposePassageRef {
  const zh = article.reference_cn?.trim();
  return {
    store: 'article',
    id: String(article.article_id ?? article.id),
    title: (article.title_en ?? article.title).trim() || article.title,
    language: (article.language ?? 'en').toLowerCase(),
    text: (article.article_en ?? '').trim(),
    ...(zh ? { textZh: zh } : {}),
  };
}

function articleAdapter(trans: Props['trans']): OrchSourceAdapter<WfNewAgentArticle> {
  return {
    pageSize: ARTICLE_PAGE_SIZE,
    emptyKey: 'orchCompose.passages.noArticles',
    // The articles API has no text search: the page is filtered here.
    load: async (page, query) => {
      const result = await wfNewApi.getAgentArticlesPage(ARTICLE_PAGE_SIZE, (page - 1) * ARTICLE_PAGE_SIZE);
      const items: OrchSourceListItem<WfNewAgentArticle>[] = result.items
        .filter((article) => (article.article_en ?? '').trim() !== '' && matches(query, article.title, article.title_cn ?? undefined, article.article_en ?? undefined))
        .map((article) => ({
          id: String(article.article_id ?? article.id),
          title: article.title_en ?? article.title,
          subtitle: (article.article_en ?? '').trim().slice(0, PREVIEW_CHARS),
          meta: [
            ...(article.word_count ? [trans('orchCompose.passages.words', { count: article.word_count })] : []),
            ...(article.reference_cn?.trim() ? [trans('orchCompose.passages.bilingual')] : []),
            ...(article.reading_date ? [new Date(article.reading_date).toLocaleDateString()] : []),
          ],
          value: article,
        }));
      return {
        items,
        total: query ? null : result.total,
        hasMore: (page - 1) * ARTICLE_PAGE_SIZE + result.items.length < result.total,
      };
    },
  };
}

export const WordNewOrchPassagePicker: React.FC<Props> = ({ taken, onPick, theme, trans }) => {
  const [tab, setTab] = useState<OrchPassageStore>('article');
  const articles = useMemo(() => articleAdapter(trans), [trans]);
  const prompts = useMemo(() => promptAdapter(trans), [trans]);
  const takenIds = useMemo(
    () => new Set([...taken].filter((key) => key.startsWith(`${tab}:`)).map((key) => key.slice(tab.length + 1))),
    [taken, tab],
  );

  return (
    <div className="space-y-2">
      <OrchTabs<OrchPassageStore>
        value={tab}
        options={TABS.map(({ store, labelKey, icon: Icon }) => ({ value: store, label: <><Icon className="h-3.5 w-3.5" />{trans(labelKey)}</> }))}
        onChange={setTab}
        theme={theme}
      />
      <div role="tabpanel">
        {tab === 'article' ? (
          <WfNewOrchSourceList
            adapter={articles}
            selectedId={null}
            selectedIds={takenIds}
            onSelect={(item) => onPick(articleRef(item.value))}
            theme={theme}
            trans={trans}
          />
        ) : (
          <WfNewOrchSourceList
            adapter={prompts}
            selectedId={null}
            selectedIds={takenIds}
            onSelect={(item) => onPick({ store: 'prompt', id: item.value.id, title: item.value.title, language: item.value.language || 'en' })}
            theme={theme}
            trans={trans}
          />
        )}
      </div>
    </div>
  );
};
