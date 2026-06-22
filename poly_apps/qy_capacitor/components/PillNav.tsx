import React from 'react';

/**
 * v4.0 Pill horizontal category menu (segmented, horizontally scrollable).
 *
 * Canonical replacement for category/filter/segment rows and `<select>`s.
 * Selected = Klein-blue fill; unselected = outline. Styles come from the
 * design-system base classes `ds-pill-nav` / `ds-pill-chip` (index.css),
 * so dark/light parity and tokens are inherited automatically.
 *
 * Example:
 *   <PillNav
 *     items={[{ id: 'all', label: 'All' }, { id: 'tshirts', label: 'T-Shirts' }]}
 *     activeId={cat}
 *     onChange={setCat}
 *   />
 */
export interface PillNavItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface PillNavProps {
  items: PillNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export const PillNav: React.FC<PillNavProps> = ({
  items,
  activeId,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Categories',
}) => {
  return (
    <div
      className={`ds-pill-nav ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`ds-pill-chip ${isActive ? 'is-active' : ''}`}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default PillNav;
