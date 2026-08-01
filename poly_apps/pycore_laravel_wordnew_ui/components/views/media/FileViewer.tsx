import React, { useState, useEffect, useRef, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BentoCard from '../../BentoCard';
import { FileNode, Language, StaticFileContent } from '../../../apps/laravel-manager/uiTypes';
import { getSource } from './resourceSources';
import ViewerErrorBoundary from './ViewerErrorBoundary';
import {
    Play, SkipForward, SkipBack, AlertCircle,
    FileText, Loader2, FastForward, Pencil, Download,
    Save, RotateCcw, FileType, File
} from "lucide-react";

// Heavy, type-specific viewers are loaded on demand so they (and their optional
// dependencies) only enter the bundle when a matching file is opened. A failed
// chunk degrades through ViewerErrorBoundary, never breaking the Media UI.
const CodeEditor = React.lazy(() => import('./CodeEditor'));
const EpubReader = React.lazy(() => import('./EpubReader'));

// Native HLS playback exists only on Safari/iOS. Detected once so .m3u8 sources
// fall back to hls.js (attached in an effect) on every other browser.
const SUPPORTS_NATIVE_HLS = typeof document !== 'undefined'
    ? document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== ''
    : false;

// Max size (~1.5MB) for which inline editing is allowed.
const MAX_EDITABLE_SIZE = 1.5 * 1024 * 1024;

// Small shared spinner fallback for a Suspense-loaded viewer.
const ViewerLoading: React.FC = () => (
    <div className="h-full flex items-center justify-center text-slate-500">
        <Loader2 size={28} className="animate-spin" />
    </div>
);

interface FileViewerProps {
  file: FileNode | null;
  playlist: FileNode[];
  onNavigate: (n: FileNode) => void;
  lang?: Language;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, playlist, onNavigate, lang = 'en' }) => {
  const activeFile = file;

  // Resolve the backend adapter for the active file from its source tag (set by
  // the tree adapter). All read/save/stream/download go through it, so the same
  // viewer serves static media files and project code. NO ||/?? — ternary only.
  const source = getSource(activeFile ? activeFile.sourceId : undefined);

  const [autoPlay, setAutoPlay] = useState(true);
  const [skipIntro, setSkipIntro] = useState<{ enabled: boolean; start: number; end: number }>({
    enabled: false,
    start: 0,
    end: 90
  });
  const [showFloatingControls, setShowFloatingControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Universal viewer / editor state.
  const [fileContent, setFileContent] = useState<StaticFileContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch content for textual file types (text / code / markdown) when the active
  // file changes. NO try-catch — McpV1 already normalizes errors into the response.
  useEffect(() => {
    setIsEditing(false);
    setEditValue('');
    setFileContent(null);
    setContentError(null);

    if (!activeFile) return;

    const ft = activeFile.fileType;
    const wantsContent = ft === 'text' ? true : ft === 'code' ? true : ft === 'markdown' ? true : false;
    if (!wantsContent) return;

    let cancelled = false;
    const fetchContent = async () => {
      setContentLoading(true);
      const response = await source.readContent(activeFile);
      if (cancelled) return;
      if (response.success && response.data) {
        setFileContent(response.data as StaticFileContent);
        setEditValue(response.data.content ? response.data.content : '');
      } else {
        setContentError(response.error);
      }
      setContentLoading(false);
    };
    fetchContent();

    return () => { cancelled = true; };
  }, [activeFile]);

  // HLS playback: a native <video> only plays .m3u8 on Safari/iOS. On every
  // other browser, dynamically attach hls.js (imported on demand so the
  // dependency stays optional). The native `src` is intentionally omitted for
  // HLS on these browsers so hls.js owns the media source.
  useEffect(() => {
    if (!activeFile) return;
    if (activeFile.fileType !== 'video') return;
    const lowerName = activeFile.name ? activeFile.name.toLowerCase() : '';
    const isHls = lowerName.endsWith('.m3u8');
    if (!isHls) return;
    if (SUPPORTS_NATIVE_HLS) return;
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;
    let hls: any = null;
    const src = source.streamUrl(activeFile);
    import('hls.js').then((mod) => {
      if (cancelled) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(el);
    });

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
    };
  }, [activeFile]);

  const handleDownload = (node: FileNode) => {
     const url = source.downloadUrl(node);
     window.open(url, '_blank');
  };

  // NO try-catch allowed. Save edits, then reload content from disk.
  const handleSaveContent = async () => {
     if (!activeFile) return;
     setIsSaving(true);
     const response = await source.saveContent(activeFile, editValue);
     if (response.success) {
       const reload = await source.readContent(activeFile);
       if (reload.success && reload.data) {
         setFileContent(reload.data as StaticFileContent);
         setEditValue(reload.data.content ? reload.data.content : '');
       }
       setIsEditing(false);
     } else {
       setContentError(response.error);
     }
     setIsSaving(false);
  };

  const handleCancelEdit = () => {
     setEditValue(fileContent && fileContent.content ? fileContent.content : '');
     setIsEditing(false);
  };

  // NO || allowed. Advance the parent's active file via onNavigate.
  const playNextInPlaylist = () => {
    if (playlist.length === 0) return;
    if (!activeFile) return;
    const currentIdx = playlist.findIndex(n => n.id === activeFile.id);
    if (currentIdx < playlist.length - 1) {
        onNavigate(playlist[currentIdx + 1]);
    }
  };

  const playPreviousInPlaylist = () => {
    if (playlist.length === 0) return;
    if (!activeFile) return;
    const currentIdx = playlist.findIndex(n => n.id === activeFile.id);
    if (currentIdx > 0) {
        onNavigate(playlist[currentIdx - 1]);
    }
  };

  const handleVideoEnd = () => {
    if (autoPlay) playNextInPlaylist();
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    if (!skipIntro.enabled) return;
    const currentTime = videoRef.current.currentTime;
    if (currentTime >= skipIntro.start && currentTime < skipIntro.end && currentTime < skipIntro.start + 2) {
      videoRef.current.currentTime = skipIntro.end;
    }
  };

  const currentPlaylistIndex = activeFile ? playlist.findIndex(n => n.id === activeFile.id) : -1;
  const hasNext = playlist.length > 0 && currentPlaylistIndex < playlist.length - 1;
  const hasPrevious = playlist.length > 0 && currentPlaylistIndex > 0;

  // Whether the current active file's content is editable inline.
  const isDirty = fileContent ? editValue !== fileContent.content : false;
  const canEdit = activeFile && fileContent && fileContent.isText && fileContent.size < MAX_EDITABLE_SIZE && source.canEdit && source.canWrite ? true : false;

  // Render the "Reading"/content body for a textual file (markdown / code / text).
  const renderTextualBody = () => {
    if (contentLoading) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500">
          <Loader2 size={28} className="animate-spin" />
        </div>
      );
    }
    if (contentError) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-red-400 gap-2 p-6 text-center">
          <AlertCircle size={28} />
          <p className="text-sm">{contentError}</p>
        </div>
      );
    }
    if (!fileContent) {
      return (
        <div className="h-full flex items-center justify-center text-slate-600 text-sm">No content</div>
      );
    }

    // Code files use the CodeMirror editor (the "programming" viewer): a
    // syntax-highlighted read view, and an editable surface bound to the same
    // editValue buffer that the shared Save/Cancel toolbar persists.
    if (activeFile && activeFile.fileType === 'code') {
      const codeExt = fileContent.extension ? fileContent.extension : '';
      return (
        <ViewerErrorBoundary
          key={activeFile.id}
          fileName={activeFile.name}
          downloadUrl={source.downloadUrl(activeFile)}
          label="The code editor could not be loaded."
        >
          <div className="h-full bg-black/40 border border-white/5 rounded-lg overflow-hidden">
            <Suspense fallback={<ViewerLoading />}>
              <CodeEditor
                value={isEditing ? editValue : fileContent.content}
                extension={codeExt}
                editable={isEditing}
                onChange={setEditValue}
              />
            </Suspense>
          </div>
        </ViewerErrorBoundary>
      );
    }

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          spellCheck={false}
          className="w-full h-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-200 outline-none resize-none focus:border-indigo-500/50"
        />
      );
    }

    if (activeFile && activeFile.fileType === 'markdown') {
      return (
        <div className="h-full overflow-auto bg-black/20 border border-white/5 rounded-lg p-4 prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-a:text-indigo-400 prose-code:text-amber-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent.content}
          </ReactMarkdown>
        </div>
      );
    }

    // text -> mono pre/code
    return (
      <pre className="h-full overflow-auto bg-black/40 border border-white/5 rounded-lg p-3 text-xs">
        <code className="font-mono text-slate-200 whitespace-pre">{fileContent.content}</code>
      </pre>
    );
  };

  // Decide which universal viewer to render in the preview panel for the active file.
  const renderViewer = () => {
    if (!activeFile) {
      return (
        <div className="text-slate-600 text-center p-8">
          <File size={48} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No file selected</p>
        </div>
      );
    }

    const ft = activeFile.fileType;

    if (ft === 'video') {
      // For HLS on a non-native browser, omit the native src so the hls.js
      // effect can own the media source; otherwise stream directly.
      const lowerName = activeFile.name ? activeFile.name.toLowerCase() : '';
      const useHlsJs = lowerName.endsWith('.m3u8') ? !SUPPORTS_NATIVE_HLS : false;
      const nativeSrc = useHlsJs ? undefined : source.streamUrl(activeFile);
      return (
        <>
          <video
            ref={videoRef}
            key={activeFile.id}
            controls
            autoPlay
            onEnded={handleVideoEnd}
            onTimeUpdate={handleVideoTimeUpdate}
            className="w-full h-full"
            src={nativeSrc}
          />
          {/* Floating Episode Controls - NO || allowed */}
          {showFloatingControls && (hasPrevious ? true : hasNext ? true : false) && (
            <div className="absolute bottom-20 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {hasPrevious && (
                <button
                  onClick={playPreviousInPlaylist}
                  className="p-3 bg-black/80 hover:bg-black/90 text-white rounded-full shadow-lg transition-all hover:scale-110"
                  title="Previous Episode"
                >
                  <SkipBack size={20} />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={playNextInPlaylist}
                  className="p-3 bg-black/80 hover:bg-black/90 text-white rounded-full shadow-lg transition-all hover:scale-110"
                  title="Next Episode"
                >
                  <SkipForward size={20} />
                </button>
              )}
            </div>
          )}
          {/* Skip Intro Button */}
          {skipIntro.enabled && videoRef.current && videoRef.current.currentTime >= skipIntro.start && videoRef.current.currentTime < skipIntro.end && (
            <div className="absolute top-4 right-4">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = skipIntro.end;
                  }
                }}
                className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white text-sm rounded-lg shadow-lg transition-all hover:scale-105 flex items-center gap-2"
              >
                <FastForward size={16} />
                Skip Intro
              </button>
            </div>
          )}
        </>
      );
    }

    if (ft === 'audio') {
      return (
        <audio
          key={activeFile.id}
          controls
          autoPlay
          onEnded={handleVideoEnd}
          className="w-full"
          src={source.streamUrl(activeFile)}
        />
      );
    }

    if (ft === 'image') {
      return (
        <img
          src={source.streamUrl(activeFile)}
          alt={activeFile.name}
          className="max-w-full max-h-full object-contain"
        />
      );
    }

    if (ft === 'pdf') {
      return (
        <iframe
          key={activeFile.id}
          src={source.streamUrl(activeFile)}
          className="w-full h-full bg-white"
          title={activeFile.name}
        />
      );
    }

    if (ft === 'epub') {
      return (
        <ViewerErrorBoundary
          key={activeFile.id}
          fileName={activeFile.name}
          downloadUrl={source.downloadUrl(activeFile)}
          label="The book reader could not be loaded."
        >
          <Suspense fallback={<ViewerLoading />}>
            <EpubReader url={source.streamUrl(activeFile)} />
          </Suspense>
        </ViewerErrorBoundary>
      );
    }

    if (ft ? ['markdown', 'text', 'code'].includes(ft) : false) {
      return <div className="w-full h-full p-2">{renderTextualBody()}</div>;
    }

    // doc / unknown / binary -> no inline preview, offer download.
    return (
      <div className="text-slate-500 text-center p-8 flex flex-col items-center gap-3">
        <FileType size={48} className="opacity-50" />
        <p className="text-sm">No inline preview available</p>
        <p className="text-xs font-mono text-slate-600">{activeFile.name}</p>
        <button
          onClick={() => handleDownload(activeFile)}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
        >
          <Download size={16} /> Download
        </button>
      </div>
    );
  };

  // Textual viewer types use a tall panel; media types keep the aspect-video frame.
  const isReadingType = activeFile && activeFile.fileType ? ['markdown', 'text', 'code', 'pdf', 'epub'].includes(activeFile.fileType) : false;

  return (
    <BentoCard title="Preview" icon={Play} glowing className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Viewer toolbar: edit / save / cancel for editable textual files. */}
        {canEdit && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />}
              <span className="font-mono truncate">{activeFile ? activeFile.name : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveContent}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                    title="Save"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg transition-colors border border-white/10"
                    title="Cancel"
                  >
                    <RotateCcw size={13} />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg transition-colors border border-white/10"
                  title="Edit"
                >
                  <Pencil size={13} />
                  Edit
                </button>
              )}
            </div>
          </div>
        )}

        {isReadingType ? (
          <div className="flex-1 min-h-0 bg-black/60 border border-white/10 rounded-lg overflow-hidden relative group">
            {renderViewer()}
          </div>
        ) : (
          <div className="aspect-video bg-black/60 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative group">
            {renderViewer()}
          </div>
        )}

        {activeFile && (
          <div className="text-xs space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>Name:</span>
              <span className="font-mono text-slate-300">{activeFile.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="font-mono text-slate-300">{activeFile.size ? activeFile.size : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-mono text-slate-300">{activeFile.fileType ? activeFile.fileType : 'unknown'}</span>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
              className="rounded"
            />
            <label className="text-slate-400">Auto-play next ({playlist.length} in queue)</label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showFloatingControls}
              onChange={(e) => setShowFloatingControls(e.target.checked)}
              className="rounded"
            />
            <label className="text-slate-400">Show floating episode controls</label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={skipIntro.enabled}
              onChange={(e) => setSkipIntro(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded"
            />
            <label className="text-slate-400">Auto-skip intro</label>
          </div>

          {skipIntro.enabled && (
            <div className="ml-5 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <label className="text-slate-500 w-12">Start:</label>
                <input
                  type="number"
                  min="0"
                  value={skipIntro.start}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSkipIntro(prev => ({ ...prev, start: isNaN(val) ? 0 : val }));
                  }}
                  className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-slate-300"
                />
                <span className="text-slate-500">sec</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-500 w-12">End:</label>
                <input
                  type="number"
                  min="0"
                  value={skipIntro.end}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSkipIntro(prev => ({ ...prev, end: isNaN(val) ? 0 : val }));
                  }}
                  className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-slate-300"
                />
                <span className="text-slate-500">sec</span>
              </div>
              <p className="text-[10px] text-slate-600">Skip intro from {skipIntro.start}s to {skipIntro.end}s</p>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
};

export default FileViewer;
