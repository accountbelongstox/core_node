/**
 * Choose what to orchestrate from the API side: books or prompts, one tab
 * each, both rendered by the one reusable source list through an adapter.
 */
import React, { useMemo, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewContentGroup, type WfNewOrchAudioItem } from '../../api';
import type { OrchComposeSource } from '../../../../shared/orchestration/orchTypes';
import {
  WfNewOrchSourceList,
  type OrchSourceAdapter,
  type OrchSourceListItem,
} from './WfNewOrchSourceList';

export type OrchSourceChoice =
  | { source: 'vocab_book'; book: WfNewContentGroup }
  | { source: 'prompt_rewrite'; prompt: WfNewOrchAudioItem };

interface Props {
  selected: { source: OrchComposeSource; id: string } | null;
  onPick: (choice: OrchSourceChoice) => void;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const BOOK_PAGE_SIZE = 20;
const PROMPT_PAGE_SIZE = 20;

const TABS: Array<{ source: OrchComposeSource; labelKey: string; icon: typeof BookOpen }> = [
  { source: 'vocab_book', labelKey: 'orchCompose.source.books', icon: BookOpen },
  { source: 'prompt_rewrite', labelKey: 'orchCompose.source.prompts', icon: Sparkles },
];

function matches(query: string, ...texts: Array<string | undefined>): boolean {
  const needle = query.toLowerCase();
  return !needle || texts.some((text) => text?.toLowerCase().includes(needle));
}

function bookAdapter(trans: Props['trans']): OrchSourceAdapter<WfNewContentGroup> {
  return {
    pageSize: BOOK_PAGE_SIZE,
    emptyKey: 'orchCompose.source.noBooks',
    // The media books API has no text search: the page is filtered here.
    load: async (page, query) => {
      const books = await wfNewApi.getBookGroups(page, BOOK_PAGE_SIZE);
      const items: OrchSourceListItem<WfNewContentGroup>[] = books
        .filter((book) => book.sourceKey && matches(query, book.title, book.description))
        .map((book) => ({
          id: book.sourceKey ?? book.id,
          title: book.title,
          subtitle: book.description,
          meta: [
            trans('orchCompose.source.sentences', { count: book.count }),
            ...(book.language ? [book.language] : []),
          ],
          imageUrl: book.imageUrl,
          value: book,
        }));
      return { items, total: null, hasMore: books.length === BOOK_PAGE_SIZE };
    },
  };
}

function promptAdapter(trans: Props['trans']): OrchSourceAdapter<WfNewOrchAudioItem> {
  return {
    pageSize: PROMPT_PAGE_SIZE,
    emptyKey: wfNewApi.isAuthenticated() ? 'orchCompose.source.noPrompts' : 'orchAudio.loginRequired',
    load: async (page, query) => {
      const result = await wfNewApi.getOrchAudioPage({ source: 'prompt_rewrite', page, perPage: PROMPT_PAGE_SIZE, query });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.previewText,
          meta: [
            trans('orchCompose.source.sentences', { count: item.sentenceCount }),
            item.language,
            ...(item.createdAt ? [new Date(item.createdAt).toLocaleDateString()] : []),
          ],
          value: item,
        })),
        total: result.total,
        hasMore: page * PROMPT_PAGE_SIZE < result.total,
      };
    },
  };
}

export const WordNewOrchSourcePicker: React.FC<Props> = ({ selected, onPick, theme, trans }) => {
  const [tab, setTab] = useState<OrchComposeSource>(selected?.source ?? 'vocab_book');
  const books = useMemo(() => bookAdapter(trans), [trans]);
  const prompts = useMemo(() => promptAdapter(trans), [trans]);
  const selectedId = selected?.source === tab ? selected.id : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5" role="tablist">
        {TABS.map(({ source, labelKey, icon: Icon }) => (
          <button
            key={source}
            type="button"
            role="tab"
            aria-selected={tab === source}
            onClick={() => setTab(source)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
              tab === source ? theme.accentBg : 'border-white/10 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{trans(labelKey)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'vocab_book' ? (
          <WfNewOrchSourceList
            adapter={books}
            selectedId={selectedId}
            onSelect={(item) => onPick({ source: 'vocab_book', book: item.value })}
            theme={theme}
            trans={trans}
          />
        ) : (
          <WfNewOrchSourceList
            adapter={prompts}
            selectedId={selectedId}
            onSelect={(item) => onPick({ source: 'prompt_rewrite', prompt: item.value })}
            theme={theme}
            trans={trans}
          />
        )}
      </div>
    </div>
  );
};
