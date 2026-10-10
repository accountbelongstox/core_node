import React from 'react';

/** Skill, stack and keyword chips. */
export const MobileTagList: React.FC<{ items: ReadonlyArray<string> | null | undefined; label?: string }> = ({ items, label }) => {
  if (!items || items.length === 0) return null;
  return (
    <ul className="cmm-tags" aria-label={label}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
};
