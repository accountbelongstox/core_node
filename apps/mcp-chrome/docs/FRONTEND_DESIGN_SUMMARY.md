# Frontend Design Summary

## Design Style: Bento Box Layout

### Overview

The frontend has been redesigned using a **Bento Box Layout** pattern, inspired by Japanese bento boxes. This design creates a visually organized grid system where different content sections are displayed in proportionally-sized cards.

### Design Principles

1. **Grid-Based Layout**
   - Uses CSS Grid with Tailwind CSS utilities
   - Flexible card sizing: 1x1, 2x1, 1x2, 2x2, 3x1 (full width)
   - Consistent gap spacing: `gap-4` (16px)

2. **Proportional Element Sizing**
   - **Small Cards (1x1)**: Status indicators, quick stats (~120px height)
   - **Medium Cards (2x1)**: Primary actions, forms (~140px height)
   - **Large Cards (1x2)**: Detailed information, lists (~280px height)
   - **Wide Cards (3x1)**: Full-width content, configurations

3. **Visual Hierarchy**
   - Larger cards for primary actions
   - Smaller cards for secondary information
   - Clear visual separation through shadows and borders

4. **Color System**
   - **Primary Gradient**: `from-blue-600 to-purple-600`
   - **Background**: `from-gray-50 via-blue-50/30 to-purple-50/20`
   - **Cards**: `bg-white/90 backdrop-blur-sm`
   - **Borders**: `border-gray-200/60`

5. **Typography Scale**
   - **H1**: `text-2xl` (24px) - Page titles
   - **H2**: `text-xl` (20px) - Section titles
   - **H3**: `text-lg` (18px) - Card titles
   - **Body**: `text-sm` (14px) - Regular text
   - **Caption**: `text-xs` (12px) - Secondary text

6. **Spacing System**
   - **XS**: `gap-1, p-1` (4px)
   - **SM**: `gap-2, p-2` (8px)
   - **MD**: `gap-4, p-4` (16px)
   - **LG**: `gap-6, p-6` (24px)
   - **XL**: `gap-8, p-8` (32px)

7. **Border Radius**
   - **Small**: `rounded-lg` (8px) - Buttons
   - **Medium**: `rounded-xl` (12px) - Cards
   - **Large**: `rounded-2xl` (16px) - Large containers

8. **Shadows**
   - **Standard**: `shadow-lg` - Card elevation
   - **Hover**: `hover:shadow-xl` - Interactive feedback
   - **Colored**: `shadow-blue-500/20` - Accent shadows

## Layout Structure

### Server Tab

```
┌─────────────┬─────────────────────────────┐
│   Status    │      Connection Card        │
│   (1x1)     │         (2x1)               │
├─────────────┴─────────────────────────────┤
│         MCP Config Card (3x1)              │
└────────────────────────────────────────────┘
```

### Semantic Tab

```
┌─────────────┬─────────────────────────────┐
│   Engine    │      Progress Card           │
│   Status    │         (2x1)                │
│   (1x1)     │                              │
├─────────────┴─────────────────────────────┤
│         Error Card (3x1)                   │
├─────────────┬─────────────┬─────────────┤
│   Model 1   │   Model 2   │   Model 3   │
│   (1x1)    │   (1x1)    │   (1x1)    │
└─────────────┴─────────────┴─────────────┘
```

### Data Tab

```
┌──────┬──────┬──────┬──────┐
│Pages │Size  │Tabs  │Docs  │
│(1x1) │(1x1) │(1x1) │(1x1) │
├──────┴──────┴──────┴──────┤
│   Clear Data (2x1)        │
│   Cache Management (2x1)  │
└────────────────────────────┘
```

### Debug Tab

```
┌─────────────────────────────────────────┐
│      Debug Toggle Card (3x1)            │
├──────────┬──────────┬──────────┐
│Connection│  Server  │   Logs   │
│ Status   │  Status  │          │
│  (1x1)   │  (1x1)   │  (1x1)   │
└──────────┴──────────┴──────────┘
```

## Component Sizing Guidelines

### Status Cards (1x1)
- **Height**: ~120px (flexible with `auto-rows-fr`)
- **Padding**: `p-5` or `p-6`
- **Content**: Icon + Value + Label
- **Use Case**: Quick stats, status indicators

### Action Cards (2x1)
- **Height**: ~140px (flexible)
- **Padding**: `p-6`
- **Content**: Title + Form/Button
- **Use Case**: Primary actions, input forms

### Detail Cards (1x2)
- **Height**: ~280px (flexible)
- **Padding**: `p-6`
- **Content**: Title + List/Table
- **Use Case**: Detailed information, model selection

### Full-Width Cards (3x1)
- **Height**: Auto (content-based)
- **Padding**: `p-6`
- **Content**: Complex components
- **Use Case**: Configurations, error messages

## Interactive Elements

### Buttons
- **Primary**: Gradient background (`from-blue-600 to-purple-600`)
- **Hover**: Scale effect (`hover:scale-[1.02]`)
- **Active**: Scale down (`active:scale-[0.98]`)
- **Shadow**: Enhanced on hover (`hover:shadow-xl`)

### Cards
- **Hover**: Shadow enhancement (`hover:shadow-xl`)
- **Border**: Subtle on default, enhanced on hover
- **Background**: Glass morphism (`bg-white/90 backdrop-blur-sm`)

### Input Fields
- **Border**: `border-2 border-gray-200`
- **Focus**: `focus:border-blue-500 focus:ring-2 focus:ring-blue-100`
- **Padding**: `px-4 py-2.5` or `px-4 py-3`

## Responsive Considerations

While the popup has a fixed width (1400px), the grid system:
- Adapts card sizes based on content
- Maintains aspect ratios
- Uses `auto-rows-fr` for flexible row heights
- Scales typography proportionally

## Code Quality

- ✅ All code and comments in English
- ✅ Consistent Tailwind CSS utility usage
- ✅ Semantic HTML structure
- ✅ Accessible focus states
- ✅ WCAG AA color contrast compliance

## Implementation Details

### Grid System
```html
<div class="grid grid-cols-3 gap-4 auto-rows-fr">
  <div class="col-span-1">...</div>  <!-- 1x1 card -->
  <div class="col-span-2">...</div>  <!-- 2x1 card -->
  <div class="col-span-3">...</div>  <!-- 3x1 card -->
</div>
```

### Card Base Style
```html
<div class="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6 transition-all hover:shadow-xl">
  <!-- Card content -->
</div>
```

### Button Base Style
```html
<button class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] rounded-xl font-semibold text-white transition-all duration-200 shadow-lg">
  <!-- Button content -->
</button>
```

## Benefits

1. **Visual Organization**: Clear separation of content areas
2. **Information Density**: Efficient use of screen space
3. **User Experience**: Easy to scan and navigate
4. **Consistency**: Uniform card styling across all tabs
5. **Scalability**: Easy to add new cards or sections
6. **Modern Aesthetic**: Clean, professional appearance

---

**Last Updated**: 2025-12-21  
**Design System**: Bento Box Layout with Tailwind CSS  
**Framework**: Vue 3 + TypeScript

