/* [v4.1-Iris] WfUI — shared Iris primitives for the wordflow end.
 * Ported from poly_apps/qy_capacitor/components/UI.tsx. Self-contained: no
 * imports from qy_capacitor. Keeps the `.ds-*` class usage so all primitives
 * resolve from wf-iris-components.css + themes/iris.css. Consume these
 * everywhere — never re-implement their markup inline. */
import React from 'react';
import { createPortal } from 'react-dom';

export const Icons = {
  Home: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Book: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  Library: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
  User: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Settings: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Play: () => <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>,
  Pause: () => <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
  Rewind: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>,
  ChevronRight: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  ChevronLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  Back: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Moon: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  Chart: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Lock: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Cloud: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
  Globe: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Sound: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  X: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Loader: () => <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
  Sun: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Bell: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  Filter: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.879a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
};

/** Dot-matrix arrow (5×5 grid, retro tech). Use with ds-btn-bento. */
export const IconsDotMatrix = {
  ArrowRight: () => (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <rect x="8" y="4" width="2" height="2" /><rect x="10" y="6" width="2" height="2" />
      <rect x="12" y="8" width="2" height="2" /><rect x="14" y="6" width="2" height="2" />
      <rect x="16" y="4" width="2" height="2" /><rect x="14" y="10" width="2" height="2" />
      <rect x="16" y="12" width="2" height="2" />
    </svg>
  ),
};

export const Card = ({ children, className = '', onClick, media, mediaClassName = '', glow = false }: any) => {
  // Cursor-follow specular spotlight — updates CSS vars consumed by .ds-card-spot.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--card-mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--card-my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div
      onClick={onClick}
      onMouseMove={onMove}
      className={`ds-card ds-card-spot rounded-[var(--radius-card)] p-6 relative overflow-hidden group ${glow ? 'ds-card-glow' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* v4.0 transparent-media (magazine PNG) slot */}
      {media && (
        <div className={`ds-media-frame mb-4 aspect-[4/3] ${mediaClassName}`}>
          {media}
        </div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export const Button = ({ children, variant = 'primary', className = '', onClick, disabled, loading = false, icon, showSparkles = false, showPlay = false }: any) => {
  const base = "font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 active:scale-[0.98]";
  const radiusClass = variant === 'pill' ? 'rounded-full' : variant === 'bento' ? '' : 'rounded-[var(--radius-button)]';
  const isDisabled = disabled || loading;

  const styles: any = {
    // v4.0: primary is the Klein-blue anchor (no ad-hoc bg-blue-600). Same
    // token surface as `ds-btn-klein`; keeps the primary shimmer overlay below.
    primary: "ds-btn w-full py-4 rounded-[var(--radius-button)] bg-[var(--klein-blue)] text-[var(--klein-on)] border border-[var(--klein-ring)] shadow-[var(--klein-glow)] hover:bg-[var(--klein-blue-strong)] disabled:hover:bg-[var(--klein-blue)]",
    klein: "ds-btn-klein w-full py-4",
    grad: "ds-btn-grad w-full py-4 text-white",
    pill: "ds-btn-pill w-full py-4 text-white",
    bento: "ds-btn-bento w-full min-h-[3.25rem]",
    fluid: "ds-btn-fluid w-full py-4 text-white",
    secondary: "ds-btn ds-glass-edge w-full py-4 backdrop-blur-[var(--blur-md)] text-slate-700 dark:text-white hover:bg-white/20 border border-white/20 dark:border-white/10 rounded-[var(--radius-button)]",
    outline: "bg-transparent w-full py-4 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[var(--radius-button)]",
    danger: "ds-btn w-full py-4 bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] rounded-[var(--radius-button)]",
    ghost: "bg-transparent w-full py-4 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-[var(--radius-button)]"
  };

  if (variant === 'bento') {
    return (
      <button onClick={onClick} disabled={isDisabled} className={`${styles.bento} ${className}`}>
        <span className="ds-btn-bento-accent">
          {loading
            ? <span className="h-5 w-5 rounded-full border-2 border-current/40 border-t-current animate-spin" />
            : <IconsDotMatrix.ArrowRight />}
        </span>
        <span className="ds-btn-bento-label">
          {children}
        </span>
      </button>
    );
  }

  return (
    <button onClick={onClick} disabled={isDisabled} aria-busy={loading} className={`${base} ${radiusClass} ${styles[variant] || styles.primary} ${className}`}>
      {loading && (
        <span className="relative z-10 flex-shrink-0 h-5 w-5 rounded-full border-2 border-current/40 border-t-current animate-spin" />
      )}
      {!loading && icon && (
        <span className="relative z-10 flex-shrink-0 [&_svg]:w-5 [&_svg]:h-5">{icon}</span>
      )}
      {!loading && showSparkles && variant === 'pill' && (
        <span className="relative z-10 flex-shrink-0 text-white/95">
          <Icons.Sparkles />
        </span>
      )}
      {!loading && showPlay && variant === 'fluid' && (
        <span className="relative z-10 flex-shrink-0">
          <Icons.Play />
        </span>
      )}
      <span className="relative z-10">{children}</span>
      {variant === 'primary' && !showSparkles && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"></div>
      )}
    </button>
  );
};

/* ============================================================================
 * v4.0 shared primitives — maximally reused, token-driven, dark/light-correct.
 * All colors come from the Iris tokens (which carry `html.dark` overrides) —
 * no hex, no bg-blue-*.
 * ========================================================================== */

const SPINNER_SIZE: Record<string, { box: number; thick: number }> = {
  sm: { box: 20, thick: 2.5 },
  md: { box: 32, thick: 3 },
  lg: { box: 48, thick: 4 },
};

/** Conic-gradient Klein loading spinner with a chromatic glow. */
export const Spinner = ({ size = 'md', className = '' }: any) => {
  const s = SPINNER_SIZE[size] || SPINNER_SIZE.md;
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`ds-spinner ${className}`}
      style={{ width: s.box, height: s.box, ['--ds-spinner-thick' as any]: `${s.thick}px` }}
    />
  );
};

/** Centered full-area loading state — spinner over a soft breathing aura. */
export const LoadingState = ({ label, className = '' }: any) => (
  <div className={`flex flex-col items-center justify-center py-16 gap-5 ${className}`}>
    <div className="relative flex items-center justify-center">
      <span className="ds-loading-aura absolute w-12 h-12 opacity-50" aria-hidden />
      <Spinner size="lg" />
    </div>
    {label && (
      <p className="text-sm font-medium text-[var(--color-text-secondary)] animate-pulse">{label}</p>
    )}
  </div>
);

/** Dashed empty state. Consumes `.ds-empty`. icon floats inside a glass halo;
 *  icon/title/description/action. */
export const EmptyState = ({ icon, title, description, action, className = '' }: any) => (
  <div className={`ds-empty flex flex-col items-center justify-center text-center px-6 py-14 gap-4 ${className}`}>
    {icon && (
      <div className="relative flex items-center justify-center">
        <span className="ds-loading-aura absolute w-14 h-14 opacity-25" aria-hidden />
        <span className="ds-empty-icon relative flex items-center justify-center w-16 h-16 rounded-full ds-glass ds-glass-edge text-[var(--klein-blue)] [&_svg]:w-8 [&_svg]:h-8">
          {icon}
        </span>
      </div>
    )}
    {title && <p className="font-bold text-[var(--color-text-primary)]">{title}</p>}
    {description && <p className="text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

const ICONBTN_VARIANT: Record<string, string> = {
  ghost: 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--klein-blue-soft)]',
  glass: 'ds-glass ds-glass-edge text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  grad: 'ds-fab-grad',
};

/** Round icon button (≥ --touch-min). variant: ghost | glass | grad. `active`
 *  paints the Klein-soft state + ring. Pass an Icons.* element. */
export const IconButton = ({ icon, onClick, label, active = false, variant = 'ghost', className = '', disabled }: any) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`ds-iconbtn ds-touch-target p-2 disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? 'text-[var(--klein-blue)] bg-[var(--klein-blue-soft)] ring-1 ring-[var(--klein-ring)]/50 shadow-[var(--klein-glow)]'
        : ICONBTN_VARIANT[variant] || ICONBTN_VARIANT.ghost
    } ${className}`}
  >
    {icon}
  </button>
);

/** Standard back button (IconButton + Icons.Back). */
export const BackButton = ({ onClick, label = 'Back', className = '' }: any) => (
  <IconButton icon={<Icons.Back />} onClick={onClick} label={label} className={className} />
);

/** Sticky glass page header. left/right are optional slots; pass `onBack` to
 *  auto-render a BackButton. `accentTitle` gradient-clips the title; `subtitle`
 *  adds a secondary line. */
export const PageHeader = ({ title, subtitle, onBack, left, right, center, accentTitle = false, className = '' }: any) => (
  <header
    className={`ds-pageheader sticky top-0 ds-z-sticky flex items-center gap-3 px-5 py-3 backdrop-blur-xl bg-[var(--color-surface)]/75 border-b border-[var(--border-highlight)] shadow-[0_6px_24px_-12px_rgba(76,70,140,0.25)] ${className}`}
  >
    {onBack ? <BackButton onClick={onBack} /> : left}
    {center
      ? <div className="flex-1 flex justify-center">{center}</div>
      : (
        <div className="flex-1 min-w-0">
          <h1 className={`text-lg font-extrabold truncate leading-tight ${accentTitle ? 'ds-text-grad' : 'text-[var(--color-text-primary)]'}`}>{title}</h1>
          {subtitle && <p className="text-xs text-[var(--color-text-secondary)] truncate">{subtitle}</p>}
        </div>
      )}
    {right && <div className="flex items-center gap-1">{right}</div>}
  </header>
);

const BADGE_TONE: Record<string, string> = {
  neutral: 'border border-[var(--border-highlight)] bg-white/40 dark:bg-white/[0.06] text-[var(--color-text-secondary)] shadow-sm',
  klein: 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] border border-[var(--klein-ring)]/40 shadow-[var(--klein-glow)]',
  grad: 'text-white border border-white/25 shadow-[var(--klein-grad-glow)]',
  success: 'bg-emerald-500/12 text-emerald-500 border border-emerald-500/25 shadow-[0_4px_14px_rgba(16,185,129,0.18)]',
  danger: 'bg-red-500/12 text-red-500 border border-red-500/25 shadow-[0_4px_14px_rgba(239,68,68,0.18)]',
};

/** Glass pill badge/tag. tone: neutral | klein | grad | success | danger.
 *  `dot` shows a leading status dot; `pulse` makes it breathe; `icon` is an
 *  optional leading element (e.g. an Icons.* glyph). */
export const Badge = ({ children, tone = 'neutral', dot = false, pulse = false, icon, className = '' }: any) => (
  <span
    className={`ds-badge ${pulse ? 'ds-badge-pulse' : ''} ${BADGE_TONE[tone] || BADGE_TONE.neutral} ${className}`}
    style={tone === 'grad' ? { background: 'var(--klein-gradient)' } : undefined}
  >
    {dot && <span className="ds-badge-dot" aria-hidden />}
    {icon && <span className="flex-shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</span>}
    {children}
  </span>
);

/** Gradient progress bar — glow + shimmer sweep, springy fill. value/max
 *  clamped 0–100%. `size`: sm | md | lg. `showLabel` adds an inline % readout.
 *  Back-compat: `className` styles the track, `barClassName` the fill. */
export const ProgressBar = ({ value = 0, max = 100, size = 'sm', showLabel = false, className = '', barClassName = '' }: any) => {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const baseH = size === 'lg' ? 'h-3' : size === 'md' ? 'h-2' : 'h-1.5';
  const track = (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      className={`ds-progress w-full ${baseH} ${className}`}
    >
      <div className={`ds-progress-fill ${barClassName}`} style={{ width: `${pct}%` }} />
    </div>
  );
  if (!showLabel) return track;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">{track}</div>
      <span className="text-xs font-bold text-[var(--klein-blue)] tabular-nums w-9 text-right">
        {Math.round(pct)}%
      </span>
    </div>
  );
};

/** Glass modal / bottom-sheet with a springy entrance. position: 'center' |
 *  'bottom'. Bottom sheets show a grab handle. Pass `title` to render a header
 *  with a close button. Renders nothing when `open` is false. */
export const Sheet = ({ open, onClose, children, title, position = 'center', className = '', panelClassName = '' }: any) => {
  if (!open) return null;
  const bottom = position === 'bottom';
  const align = bottom ? 'items-end' : 'items-center justify-center';
  const panelRadius = bottom ? 'rounded-t-[calc(var(--radius-card)+10px)]' : '';
  const enter = bottom ? 'ds-sheet-bottom' : 'ds-sheet-center';
  return (
    <Portal>
      <div
        className={`fixed inset-0 ds-z-modal flex ${align} ds-modal-backdrop ds-backdrop-in ${className}`}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`ds-modal-panel relative ${enter} ${bottom ? 'w-full pb-safe' : 'max-w-md w-[calc(100%-2rem)]'} ${panelRadius} p-6 ${panelClassName}`}
          onClick={(e: any) => e.stopPropagation()}
        >
          {bottom && <div className="ds-sheet-handle" aria-hidden />}
          {title && (
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] truncate">{title}</h3>
              <IconButton icon={<Icons.X />} onClick={onClose} label="Close" />
            </div>
          )}
          {children}
        </div>
      </div>
    </Portal>
  );
};

/** Metric cell (value over label). `accent` gradient-clips the value; `icon`
 *  shows a gradient chip; `trend` (+/- number or 'up'/'down') adds a colored
 *  delta; `card` wraps it in a hoverable glass card. */
export const Stat = ({ value, label, icon, trend, accent = false, card = false, className = '' }: any) => {
  const trendUp = trend === 'up' || (typeof trend === 'number' && trend > 0);
  const trendDown = trend === 'down' || (typeof trend === 'number' && trend < 0);
  const body = (
    <>
      {icon && (
        <span className="ds-bento-chip flex-shrink-0 w-10 h-10 [&_svg]:w-5 [&_svg]:h-5" aria-hidden>{icon}</span>
      )}
      <div className="flex flex-col min-w-0">
        <span className={`text-2xl font-extrabold leading-none ${accent ? 'ds-text-grad' : 'text-[var(--color-text-primary)]'}`}>
          {value}
        </span>
        <span className="flex items-center gap-1.5 mt-1">
          {label && <span className="text-xs text-[var(--color-text-secondary)] truncate">{label}</span>}
          {trend != null && trend !== '' && (
            <span className={`inline-flex items-center gap-0.5 text-[0.68rem] font-bold ${
              trendUp ? 'text-emerald-500' : trendDown ? 'text-red-500' : 'text-[var(--color-text-tertiary)]'
            }`}>
              {trendUp ? '▲' : trendDown ? '▼' : ''}
              {typeof trend === 'number' ? Math.abs(trend) : ''}
            </span>
          )}
        </span>
      </div>
    </>
  );
  return (
    <div className={`${card ? 'ds-card p-4' : ''} flex ${icon ? 'items-center gap-3' : 'flex-col'} ${className}`}>
      {body}
    </div>
  );
};

/** Uppercase section label (consumes `.ds-section-label`) with a gradient accent
 *  bar. `accent={false}` drops the bar; optional right action. */
export const SectionLabel = ({ children, action, accent = true, className = '' }: any) => (
  <div className={`flex items-center justify-between gap-3 ${className}`}>
    <span className="flex items-center gap-2 min-w-0">
      {accent && <span className="ds-label-accent" aria-hidden />}
      <span className="ds-section-label truncate">{children}</span>
    </span>
    {action}
  </div>
);

/* -------- v4.1 Iris primitives (reference-faithful) ----------------------- */

/** Bold section heading with optional leading gradient chip, subtitle, and a
 *  right "See all" action whose chevron slides on hover. */
export const SectionTitle = ({ title, subtitle, icon, onMore, moreLabel = 'See all', action, className = '' }: any) => (
  <div className={`flex items-center justify-between gap-3 ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      {icon && <span className="ds-title-chip" aria-hidden>{icon}</span>}
      <div className="min-w-0">
        <h2 className="ds-section-title truncate">{title}</h2>
        {subtitle && <p className="ds-section-sub truncate">{subtitle}</p>}
      </div>
    </div>
    {action ?? (onMore && (
      <button type="button" className="ds-link-more flex items-center gap-0.5 flex-shrink-0 [&_svg]:w-4 [&_svg]:h-4" onClick={onMore}>
        {moreLabel}
        <Icons.ChevronRight />
      </button>
    ))}
  </div>
);

/** Circular colored icon tile (games / quick actions). `grad` fills with the
 *  Klein gradient; `badge` shows a corner count; `bg` overrides the fill. */
export const IconTile = ({ icon, label, onClick, bg, grad = false, badge, className = '' }: any) => (
  <button type="button" onClick={onClick} className={`group flex flex-col items-center gap-2 ${className}`}>
    <span className="relative">
      <span
        className={`ds-icon-tile ${grad ? 'ds-icon-tile-grad' : ''}`}
        style={!grad && bg ? { background: bg } : undefined}
      >
        {icon}
      </span>
      {badge != null && badge !== '' && <span className="ds-icon-tile-badge">{badge}</span>}
    </span>
    {label && (
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors truncate max-w-[72px]">
        {label}
      </span>
    )}
  </button>
);

/** Gradient circular FAB (search filter / accent action). Size in px. `pulse`
 *  adds an attention ring; `badge` shows a corner count. */
export const FabGrad = ({ icon, onClick, label, size = 44, pulse = false, badge, className = '' }: any) => (
  <span className="relative inline-flex flex-shrink-0">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`ds-fab-grad ${pulse ? 'ds-fab-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {icon}
    </button>
    {badge != null && badge !== '' && <span className="ds-corner-badge">{badge}</span>}
  </span>
);

/** Bento card with corner gradient icon-chip. Whole card is the click target.
 *  `tone='grad'` makes it a gradient hero tile; `cta` adds a hover-reveal
 *  chevron affordance with that label. */
export const BentoTile = ({ title, description, chipIcon, onClick, tone = 'glass', cta, className = '', children }: any) => {
  const grad = tone === 'grad';
  return (
    <div
      onClick={onClick}
      className={`ds-bento flex flex-col ${grad ? 'text-white border-white/20' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={grad ? { background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={`text-base font-bold leading-tight ${grad ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>{title}</h3>
        {chipIcon && (
          <span className={`ds-bento-chip flex-shrink-0 ${grad ? '!bg-white/20 !shadow-none' : ''}`}>{chipIcon}</span>
        )}
      </div>
      {description && (
        <p className={`text-sm mt-4 leading-snug ${grad ? 'text-white/85' : 'text-[var(--color-text-secondary)]'}`}>{description}</p>
      )}
      {children}
      {(cta || onClick) && (
        <span className={`ds-bento-arrow mt-3 text-sm font-semibold gap-1 ${grad ? '!text-white' : ''}`}>
          {cta} <Icons.ChevronRight />
        </span>
      )}
    </div>
  );
};

/* -------- v4.1 stacking primitives (portal + popover) -------------------- */

/** Renders children into <body> (escapes all ancestor stacking/overflow). */
export const Portal = ({ children }: any) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

/** Anchored popover panel. Controlled (`open` + `onClose`). Portals to <body>,
 *  position:fixed from the anchor's rect, flips above when low on space, closes
 *  on outside-click + Escape, sits at `--z-popover`. */
export const Popover = ({ open, onClose, anchorRef, children, align = 'end', gap = 8, className = '', panelClassName = '' }: any) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const a = anchorRef?.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ph = panelRef.current?.offsetHeight ?? 0;
      const openUp = ph > 0 && r.bottom + ph + gap > vh && r.top - ph - gap > 0;
      const next: React.CSSProperties = openUp
        ? { bottom: Math.max(8, vh - r.top + gap) }
        : { top: Math.min(r.bottom + gap, vh - 8) };
      const pw = panelRef.current?.offsetWidth ?? 0;
      const desiredLeft = align === 'start' ? r.left : r.right - pw;
      const maxLeft = Math.max(8, vw - pw - 8);
      next.left = Math.min(Math.max(8, desiredLeft), maxLeft);
      next.maxWidth = 'calc(100vw - 16px)';
      next.maxHeight = `calc(100vh - ${(openUp ? vh - r.top : r.bottom) + 16}px)`;
      setStyle(next);
    };
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, align, gap, anchorRef]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef?.current?.contains(t)) return;
      onClose?.();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      className={`ds-pop-panel ${className} ${panelClassName}`}
      style={{ ...(style || { visibility: 'hidden' }), overflowY: 'auto' }}
    >
      {children}
    </div>,
    document.body
  );
};
