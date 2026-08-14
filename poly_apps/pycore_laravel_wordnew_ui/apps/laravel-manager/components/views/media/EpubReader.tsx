import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

/**
 * EPUB reader for the unified Media explorer ("online reading" for books).
 *
 * epubjs is imported dynamically so it is only fetched when an .epub is opened,
 * and an uninstalled/failed dependency surfaces through the parent
 * ViewerErrorBoundary rather than breaking the whole Media bundle.
 */
interface EpubReaderProps {
  /** Absolute stream URL of the .epub file. */
  url: string;
}

const EpubReader: React.FC<EpubReaderProps> = ({ url }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let book: any = null;

    setLoading(true);
    setFailed(false);

    import('epubjs')
      .then((mod) => {
        if (cancelled || !hostRef.current) {
          return;
        }
        const ePub = mod.default;
        book = ePub(url);
        const rendition = book.renderTo(hostRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
        });
        renditionRef.current = rendition;
        return rendition.display();
      })
      .then(() => {
        if (!cancelled) {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      if (book) {
        book.destroy();
      }
      renditionRef.current = null;
    };
  }, [url]);

  const goPrev = () => {
    if (renditionRef.current) {
      renditionRef.current.prev();
    }
  };

  const goNext = () => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  };

  return (
    <div className="relative h-full w-full bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white text-slate-500">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white text-red-500 text-sm px-6 text-center">
          Failed to open this book.
        </div>
      )}
      <div ref={hostRef} className="h-full w-full" />
      <button
        onClick={goPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
        title="Previous page"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={goNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
        title="Next page"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default EpubReader;
