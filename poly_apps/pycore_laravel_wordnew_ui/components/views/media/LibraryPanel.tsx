/**
 * LibraryPanel — the thin LEFT switch of the single-explorer Media shell.
 *
 * Given the active segment it renders exactly one left-column panel:
 *   - 'files'           -> <FileTreePanel> (Static Resources tree)
 *   - 'movies'/'books'  -> <SourceListPanel> (subtitle/book source list)
 *
 * It owns no data of its own; it only adapts the shared Selection model to each
 * panel's own prop shape and lifts selection changes back up to the parent.
 *
 * Guardrails: no try/catch, no `||`/`??` — explicit ternaries only.
 */
import React from 'react';
import type { Language, FileNode } from '../../../apps/laravel-manager/uiTypes';
import type { Segment, Selection } from './mbShared';
import FileTreePanel from './FileTreePanel';
import SourceListPanel from './SourceListPanel';
import { getSource } from './resourceSources';

interface LibraryPanelProps {
  segment: Segment;
  search: string;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onPlaylist: (p: FileNode[]) => void;
  lang?: Language;
  reloadSignal: number;
  /** Opens the global login modal when an unauthenticated mutation is attempted. */
  onRequireLogin?: () => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({
  segment,
  search,
  selection,
  onSelect,
  onPlaylist,
  lang = 'en',
  reloadSignal,
  onRequireLogin,
}) => {
  // Files and Code are both file trees, differing only in their backend adapter
  // (static media vs project source). NO ||/?? in this file — explicit branching.
  const isFileTree = segment === 'files' ? true : segment === 'code';
  if (isFileTree) {
    const fileSource = segment === 'code' ? getSource('code') : getSource('files');
    const activeFileId = selection !== null && selection.kind === 'file' ? selection.file.id : null;
    return (
      <FileTreePanel
        search={search}
        activeFileId={activeFileId}
        source={fileSource}
        onSelectFile={(n) => onSelect({ kind: 'file', file: n })}
        onPlaylist={onPlaylist}
        lang={lang}
        reloadSignal={reloadSignal}
        onRequireLogin={onRequireLogin}
      />
    );
  }

  // Movies / Books are DB-backed learning sources (not file trees).
  const sourceKind = segment === 'books' ? 'books' : 'movies';
  const selectedKey = selection !== null && selection.kind === 'source' ? selection.source.source_key : null;
  return (
    <SourceListPanel
      kind={sourceKind}
      search={search}
      selectedKey={selectedKey}
      onSelect={(item) => onSelect({ kind: 'source', source: { ...item, kind: sourceKind } })}
      reloadSignal={reloadSignal}
    />
  );
};

export default LibraryPanel;
