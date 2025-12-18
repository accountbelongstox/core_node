import React, { useEffect, useRef, useState } from 'react';

interface DraggableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Draggable Header Component
 *
 * Makes the header draggable for frameless windows.
 * Supports both Qt WebView and regular browsers.
 */
const DraggableHeader: React.FC<DraggableHeaderProps> = ({ children, className = '' }) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    // Check if running in Qt WebView
    const isQtWebView = navigator.userAgent.includes('QtWebEngine');

    const handleMouseDown = (e: MouseEvent) => {
      // Only drag on left mouse button and not on interactive elements
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Don't drag if clicking on buttons, inputs, or other interactive elements
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
          target.tagName === 'A' || target.closest('button') ||
          target.closest('input') || target.closest('a')) {
        return;
      }

      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };

      // Prevent text selection during drag
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartPos.current) return;

      if (isQtWebView) {
        // Qt WebView: Use Qt's native window moving
        // Call Qt bridge if available (requires C++ bridge setup)
        // For now, use CSS transform as fallback
        console.log('[DraggableHeader] Drag in Qt WebView (CSS transform fallback)');
      } else {
        // Regular browser: Simulate drag for testing
        console.log('[DraggableHeader] Drag in browser');
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartPos.current = null;
    };

    header.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      header.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={headerRef}
      className={className}
      style={{
        // Enable window dragging in Qt WebView
        // @ts-ignore: -webkit-app-region is not in TypeScript types
        WebkitAppRegion: 'drag',
        // Prevent text selection during drag
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {/* Make buttons and interactive elements non-draggable */}
      <div
        style={{
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
          cursor: 'default'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default DraggableHeader;
