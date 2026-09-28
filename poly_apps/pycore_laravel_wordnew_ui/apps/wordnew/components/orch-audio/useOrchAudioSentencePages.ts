import { useCallback, useMemo, useRef, useState } from 'react';
import { wfNewApi, type WfNewOrchAudioDetail, type WfNewOrchAudioSentence } from '../../api';

export interface OrchAudioSentencePages {
  total: number;
  perPage: number;
  pageCount: number;
  /** Loaded 1-based page numbers, ascending. */
  loadedPages: number[];
  /** Sentences of every loaded page, in position order. */
  loaded: WfNewOrchAudioSentence[];
  loadingPages: number[];
  pageOf: (position: number) => number;
  sentenceAt: (position: number) => WfNewOrchAudioSentence | undefined;
  pageSentences: (page: number) => WfNewOrchAudioSentence[];
  ensurePage: (page: number) => Promise<WfNewOrchAudioSentence[]>;
  ensureRange: (start: number, end: number) => Promise<void>;
}

/** Sentence pages of one orchestrated audio item, fetched on demand (page 1
 * arrives with the detail). Reads never block on unloaded pages. */
export function useOrchAudioSentencePages(detail: WfNewOrchAudioDetail): OrchAudioSentencePages {
  const first = detail.firstSentencePage;
  const perPage = Math.max(1, first.perPage);
  const total = first.total;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const pagesRef = useRef<Map<number, WfNewOrchAudioSentence[]>>(new Map([[1, first.items]]));
  const inflightRef = useRef<Map<number, Promise<WfNewOrchAudioSentence[]>>>(new Map());
  const [version, setVersion] = useState(0);
  const [loadingPages, setLoadingPages] = useState<number[]>([]);

  const pageOf = useCallback((position: number) => Math.floor(position / perPage) + 1, [perPage]);

  const pageSentences = useCallback((page: number) => pagesRef.current.get(page) ?? [], []);

  const sentenceAt = useCallback((position: number) => (
    pagesRef.current.get(Math.floor(position / perPage) + 1)?.[position % perPage]
  ), [perPage]);

  const ensurePage = useCallback((page: number): Promise<WfNewOrchAudioSentence[]> => {
    if (page < 1 || page > pageCount) return Promise.resolve([]);
    const loaded = pagesRef.current.get(page);
    if (loaded) return Promise.resolve(loaded);
    const pending = inflightRef.current.get(page);
    if (pending) return pending;
    setLoadingPages((pages) => [...pages, page]);
    const request = wfNewApi.getOrchAudioSentencePage(detail.item.id, page)
      .then((result) => {
        pagesRef.current.set(page, result.items);
        setVersion((value) => value + 1);
        return result.items;
      })
      .catch(() => [] as WfNewOrchAudioSentence[])
      .finally(() => {
        inflightRef.current.delete(page);
        setLoadingPages((pages) => pages.filter((value) => value !== page));
      });
    inflightRef.current.set(page, request);
    return request;
  }, [detail.item.id, pageCount]);

  const ensureRange = useCallback(async (start: number, end: number): Promise<void> => {
    const pages: number[] = [];
    for (let page = pageOf(Math.max(0, start)); page <= pageOf(Math.max(start, end)); page += 1) pages.push(page);
    await Promise.all(pages.map(ensurePage));
  }, [ensurePage, pageOf]);

  const loadedPages = useMemo(
    () => [...pagesRef.current.keys()].sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const loaded = useMemo(
    () => loadedPages.flatMap((page) => pagesRef.current.get(page) ?? []),
    [loadedPages],
  );

  return {
    total,
    perPage,
    pageCount,
    loadedPages,
    loaded,
    loadingPages,
    pageOf,
    sentenceAt,
    pageSentences,
    ensurePage,
    ensureRange,
  };
}
