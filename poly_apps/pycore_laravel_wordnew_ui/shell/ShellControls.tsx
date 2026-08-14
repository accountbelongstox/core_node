/**
 * Floating shell control dock. Sits above every end (collapsed to a single
 * button by default) so it never clobbers an end's own chrome. Provides:
 * home, end switch, AI chat, dark toggle, language, and theme override.
 *
 * The toggle button floats on the RIGHT edge, vertically centered by default.
 * It is draggable: drag it anywhere and it MAGNET-SNAPS back to the right edge
 * on release (free vertical position, persisted; horizontal always returns to
 * the right edge). The expanded panel opens downward, or upward when the button
 * sits in the lower half of the viewport, so it never overflows off-screen.
 *
 * Geometry is defined in shellChrome.ts — end-local top-right chrome (e.g.
 * pycore PcTopBar) reserves shellDockRightGutterPx() to avoid overlapping
 * Apps / Home / Laravel Manager / theme / language when this panel is open.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Home, Bot, Sun, Moon, Languages, Palette, X, Sparkles } from 'lucide-react';
import { useShell } from './ShellContext';
import { END_META, SHELL_LANGUAGES, ThemeId } from './shellTypes';
import {
  SHELL_DOCK_INSET_PX, SHELL_DOCK_BUTTON_PX,
  SHELL_DOCK_PANEL_GAP_PX, SHELL_DOCK_PANEL_WIDTH_PX, SHELL_DOCK_Z_INDEX,
} from './shellChrome';
import { StorageManager } from '../core/persistence';
import { ShellStorageKeys as StorageKeys } from './ShellStorageKeys';

/** Pointer travel (px) beyond which a press counts as a drag, not a tap. */
const DRAG_THRESHOLD_PX = 4;

/** Default Y = vertically centered. */
function defaultDockY(): number {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return Math.max(SHELL_DOCK_INSET_PX, Math.round(h / 2 - SHELL_DOCK_BUTTON_PX / 2));
}

/** Clamp a top-Y so the button stays fully on-screen with the standard inset. */
function clampDockY(y: number): number {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxY = h - SHELL_DOCK_BUTTON_PX - SHELL_DOCK_INSET_PX;
  return Math.min(Math.max(y, SHELL_DOCK_INSET_PX), Math.max(SHELL_DOCK_INSET_PX, maxY));
}

export const ShellControls: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { end, dark, toggleDark, lang, setLang, themeOverride, setThemeOverride, openChat } = useShell();
  const [open, setOpen] = useState(false);

  // Committed vertical position (px from top). Horizontal is always the right edge.
  const [dockY, setDockY] = useState<number>(() => {
    const saved = Number(StorageManager.getRaw(StorageKeys.DOCK_Y));
    return Number.isFinite(saved) && saved > 0 ? clampDockY(saved) : defaultDockY();
  });
  // Live drag offset while a pointer-drag is in progress (null = not dragging).
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  // Transient horizontal offset that animates back to 0 (the right-edge magnet).
  const [snapX, setSnapX] = useState(0);
  const dragRef = useRef<{ px: number; py: number; startY: number; moved: boolean } | null>(null);

  // Keep the button on-screen when the viewport resizes.
  useEffect(() => {
    const onResize = () => setDockY((y) => clampDockY(y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // After a drag, ease the horizontal offset back to 0 (snap to the right edge).
  useEffect(() => {
    if (snapX === 0) return;
    const r = requestAnimationFrame(() => setSnapX(0));
    return () => cancelAnimationFrame(r);
  }, [snapX]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, startY: dockY, moved: false };
    setDrag({ dx: 0, dy: 0 });
  }, [dockY]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) d.moved = true;
    setDrag({ dx, dy });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }

    if (d.moved) {
      // Commit the vertical move into `dockY` immediately (no double-count), and
      // hand the horizontal offset to `snapX` so it eases back to the right edge.
      const dy = drag?.dy ?? 0;
      const dx = drag?.dx ?? 0;
      const newY = clampDockY(d.startY + dy);
      setDockY(newY);
      StorageManager.setRaw(StorageKeys.DOCK_Y, String(newY));
      setSnapX(dx);
    } else {
      // A tap (no real movement) toggles the panel.
      setOpen((v) => !v);
    }
    setDrag(null);
  }, [drag]);

  const dragging = drag !== null;
  // Open upward when the button lives in the lower half so the panel stays visible.
  const openUp = dockY > ((typeof window !== 'undefined' ? window.innerHeight : 800) / 2);
  const panelOffset = SHELL_DOCK_BUTTON_PX + SHELL_DOCK_PANEL_GAP_PX;

  return (
    <div
      className="fixed"
      style={{
        top: dockY,
        right: SHELL_DOCK_INSET_PX,
        width: SHELL_DOCK_BUTTON_PX,
        height: SHELL_DOCK_BUTTON_PX,
        zIndex: SHELL_DOCK_Z_INDEX,
      }}
    >
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-200"
        style={{
          width: SHELL_DOCK_BUTTON_PX,
          height: SHELL_DOCK_BUTTON_PX,
          touchAction: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
          // Live-follow the pointer while dragging; ease the horizontal offset
          // back to 0 on release (the right-edge magnet). Vertical is committed
          // straight into `top`, so only X animates here.
          transform: drag
            ? `translate(${drag.dx}px, ${drag.dy}px)`
            : (snapX ? `translateX(${snapX}px)` : undefined),
          transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        title="Shell controls (drag to move — snaps to the right edge)"
      >
        {open ? <X className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
      </button>

      {open && !dragging && (
        <div
          className="absolute rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-2xl p-3 space-y-3 text-sm"
          style={{
            // w-60 — keep in sync with SHELL_DOCK_PANEL_WIDTH_PX
            width: SHELL_DOCK_PANEL_WIDTH_PX,
            right: 0,
            ...(openUp ? { bottom: panelOffset } : { top: panelOffset }),
          }}
        >
          {/* Ends */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Apps</div>
            <button
              onClick={() => { navigate('/'); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 ${end === 'home' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}
            >
              <Home className="w-4 h-4" /> Home
            </button>
            {/* 'wordnew' is the word-end identity wordnew reuses for its theme; the
                dedicated "WordNew 🚀" button below is its single list entry, so skip it here. */}
            {(Object.keys(END_META) as (keyof typeof END_META)[]).filter((id) => id !== 'wordnew').map((id) => (
              <button
                key={id}
                onClick={() => { navigate(END_META[id].path); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 ${(end === id && !location.pathname.startsWith('/wordnew')) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <span className="w-4 h-4 rounded-full" style={{ background: 'var(--shell-accent, #6366f1)' }} />
                {END_META[id].label}
              </button>
            ))}
            <button
              onClick={() => { navigate('/wordnew'); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 ${location.pathname.startsWith('/wordnew') ? 'text-fuchsia-600 dark:text-fuchsia-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}
            >
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-fuchsia-400 to-indigo-500 animate-pulse animate-duration-1000" />
              WordNew
            </button>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          {/* AI chat — on wordnew this lives in WordNewTopBar's right-side icons
              instead of this floating dock, so it is hidden here for that end. */}
          {end !== 'wordnew' && (
            <button
              onClick={() => { openChat(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200"
            >
              <Bot className="w-4 h-4" /> AI Chat
            </button>
          )}

          {/* Dark toggle */}
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Language */}
          <label className="flex items-center gap-2 px-2 text-slate-700 dark:text-slate-200">
            <Languages className="w-4 h-4" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="flex-1 bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1"
            >
              {SHELL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>

          {/* Theme override */}
          <label className="flex items-center gap-2 px-2 text-slate-700 dark:text-slate-200">
            <Palette className="w-4 h-4" />
            <select
              value={themeOverride ? themeOverride : 'auto'}
              onChange={(e) => setThemeOverride(e.target.value === 'auto' ? null : (e.target.value as ThemeId))}
              className="flex-1 bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1"
            >
              <option value="auto">Auto (per app)</option>
              <option value="nexus">Nexus</option>
              <option value="pycore">Pycore</option>
              <option value="iris">Iris</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

export default ShellControls;
