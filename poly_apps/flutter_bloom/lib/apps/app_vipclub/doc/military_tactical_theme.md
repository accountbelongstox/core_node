# VIP Club Military Tactical Theme

This stylesheet lives at `assets/apps/app_vipclub/styles/military_tactical_theme.css`. It is registered in `pubspec.yaml`, so any Flutter code (or embedded WebView/HTML panel) can load it via the standard `rootBundle.loadString` or by referencing the asset path inside a `HtmlElementView`.

## Palette and Variables
- `--camo-*`, `--accent-*`, and `--glow-*` variables define the dark tactical palette.
- Components should rely on these CSS variables to remain coherent with the rest of the UI.

## Core Layout Primitives
- `.vipclub-app` and `.vipclub-app__grid` set the base viewport background, grid layout, and spacing.
- `.vipclub-panel`, `.card`, `.hero`, `.stat-grid`, and `.data-card` cover most dashboard containers with hover states, shadows, and responsive breakpoints (see media queries at the bottom of the file).

## Interactive Elements
- Buttons: `.btn`, plus modifiers `.btn--primary`, `.btn--secondary`, `.btn--tertiary`, `.btn--ghost`, `.btn--danger`, and `.btn--circle`. Disabled styling is handled through `.btn.is-disabled` or `:disabled`.
- Pills and badges: `.vipclub-nav__pill`, `.badge`, `.badge--alert`, `.badge--success`.
- Tabs and segmented controls: `.tab-group`, `.tab`, `.tab.is-active`.

## Cards and Widgets
- Base cards: `.card`, `.card--intel`, `.card--vip`.
- VIP overview: `.vip-status-card`, `.vip-status-card__level`, `.vip-status-card__progress`, `.vip-status-card__cta`.
- Feed/list items: `.intel-feed`, `.intel-feed__item`, `.list-ops`, `.mission-card`, `.timeline`.
- Data viz helpers: `.stat-card`, `.progress-bar`, `.chart-card`, `.chart-legend`.

## Forms and Modals
- `.form-field` plus child selectors for labels, controls, hints.
- `.toggle` block covers switches (track + thumb states).
- `.modal` components include title, content, and action bar styles.

## Usage Example (WebView / HTML Panel)
```html
<link rel="stylesheet" href="assets/apps/app_vipclub/styles/military_tactical_theme.css" />

<div class="vipclub-app">
  <section class="hero">
    <p class="hero__title">VIP COMMAND</p>
    <div class="hero__cta">
      <button class="btn btn--primary">Engage</button>
      <button class="btn btn--ghost">Briefing</button>
    </div>
  </section>
</div>
```

For Flutter `Html` widgets, bundle the CSS string and inject it into the HTML template so the same classes apply across platforms.

## Local HTML Showcase
- File: `assets/apps/app_vipclub/styles/demo_military_dashboard.html`
- Open the file in any browser (or host it with `python -m http.server`) to preview the theme with hero, mission feed, stat cards, and action buttons already wired up.
- Modify the sample markup to prototype new VIP Club layouts before porting designs into Flutter widgets.
