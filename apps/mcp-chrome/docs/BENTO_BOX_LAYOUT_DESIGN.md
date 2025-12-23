# Bento Box Layout Design

## Design Philosophy

The Bento Box layout is inspired by Japanese bento boxes, where different compartments contain different items in an organized, visually appealing grid. This design approach:

- **Creates visual hierarchy** through varied card sizes
- **Improves information density** by grouping related content
- **Enhances user experience** with clear visual separation
- **Optimizes screen space** using proportional sizing

## Layout System

### Grid Structure

Using CSS Grid with Tailwind CSS, we create a flexible grid system:

```
┌─────────────┬─────────────┬─────────────┐
│   Card 1    │   Card 2    │   Card 3    │
│   (2x1)     │   (1x1)     │   (1x1)     │
├─────────────┼─────────────┴─────────────┤
│   Card 4    │        Card 5             │
│   (1x1)     │        (2x1)              │
├─────────────┼─────────────┬─────────────┤
│   Card 6    │   Card 7    │   Card 8    │
│   (1x2)     │   (1x1)     │   (1x1)     │
└─────────────┴─────────────┴─────────────┘
```

### Card Size Proportions

- **Small (1x1)**: 1 column × 1 row - Quick stats, status indicators
- **Medium (2x1)**: 2 columns × 1 row - Main actions, primary content
- **Large (1x2)**: 1 column × 2 rows - Detailed information, lists
- **Wide (2x2)**: 2 columns × 2 rows - Complex components, dashboards

## Design Principles

### 1. Visual Hierarchy
- Larger cards for primary actions
- Smaller cards for secondary information
- Consistent spacing (gap-4, gap-6)

### 2. Color System
- **Primary**: Blue gradient (from-blue-600 to-purple-600)
- **Success**: Green (emerald-500)
- **Warning**: Amber (amber-500)
- **Error**: Red (red-500)
- **Neutral**: Gray scale (gray-50 to gray-900)

### 3. Typography Scale
- **Heading 1**: text-2xl (24px) - Page titles
- **Heading 2**: text-xl (20px) - Section titles
- **Heading 3**: text-lg (18px) - Card titles
- **Body**: text-sm (14px) - Regular text
- **Caption**: text-xs (12px) - Secondary text

### 4. Spacing System
- **XS**: 4px (gap-1, p-1)
- **SM**: 8px (gap-2, p-2)
- **MD**: 16px (gap-4, p-4)
- **LG**: 24px (gap-6, p-6)
- **XL**: 32px (gap-8, p-8) 

### 5. Border Radius
- **Small**: rounded-lg (8px) - Buttons, small cards
- **Medium**: rounded-xl (12px) - Standard cards
- **Large**: rounded-2xl (16px) - Large containers

### 6. Shadows
- **Small**: shadow-sm - Subtle elevation
- **Medium**: shadow-md - Standard cards
- **Large**: shadow-lg - Prominent cards
- **XL**: shadow-xl - Floating elements

## Component Sizing

### Status Cards (1x1)
- Height: ~120px
- Padding: p-6
- Content: Icon + Value + Label

### Action Cards (2x1)
- Height: ~140px
- Padding: p-6
- Content: Title + Description + Button

### Detail Cards (1x2)
- Height: ~280px
- Padding: p-6
- Content: Title + List/Table + Actions

### Dashboard Cards (2x2)
- Height: ~280px
- Padding: p-8
- Content: Complex components, charts

## Responsive Behavior

While the popup has a fixed width (1400px), the grid adapts:
- **Gap adjustment**: gap-4 on smaller sections, gap-6 on main grid
- **Card wrapping**: Cards maintain aspect ratios
- **Content scaling**: Text and icons scale proportionally

## Implementation

Using Tailwind CSS Grid utilities:
- `grid-cols-3`: 3-column grid
- `col-span-1`: 1 column width
- `col-span-2`: 2 columns width
- `row-span-1`: 1 row height
- `row-span-2`: 2 rows height

## Accessibility

- **Focus states**: Clear focus rings (ring-2 ring-blue-500)
- **Color contrast**: WCAG AA compliant
- **Touch targets**: Minimum 44×44px for interactive elements
- **Semantic HTML**: Proper heading hierarchy

