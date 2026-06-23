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
import type { Language, FileNode } from '../../../types';
import type { Segment, Selection } from './mbShared';
import FileTreePanel from './FileTreePanel';
import SourceListPanel from './SourceListPanel';

interface LibraryPanelProps {
  segment: Segment;
  search: string;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onPlaylist: (p: FileNode[]) => void;
  lang?: Language;
  reloadSignal: number;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({
  segment,
  search,
  selection,
  onSelect,
  onPlaylist,
  lang = 'en',
  reloadSignal,
}) => {
  if (segment === 'files') {
    const activeFileId = selection !== null && selection.kind === 'file' ? selection.file.id : null;
    return (
      <FileTreePanel
        search={search}
        activeFileId={activeFileId}
        onSelectFile={(n) => onSelect({ kind: 'file', file: n })}
        onPlaylist={onPlaylist}
        lang={lang}
        reloadSignal={reloadSignal}
      />
    );
  }

  const selectedKey = selection !== null && selection.kind === 'source' ? selection.source.source_key : null;
  return (
    <SourceListPanel
      kind={segment}
      search={search}
      selectedKey={selectedKey}
      onSelect={(item) => onSelect({ kind: 'source', source: { ...item, kind: segment } })}
      reloadSignal={reloadSignal}
    />
  );
};

export default LibraryPanel;
