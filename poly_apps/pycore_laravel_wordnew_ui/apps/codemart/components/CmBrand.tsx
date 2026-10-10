import React from 'react';
import { CmLogo } from './CmLogo';

const LOCKUP_HEIGHT = 42;
const COMPACT_LOCKUP_HEIGHT = 32;
const MARK_HEIGHT = 32;

export interface CmBrandProps {
  inverse?: boolean;
  compact?: boolean;
}

export const CmBrand: React.FC<CmBrandProps> = ({ inverse = false, compact = false }) => (
  <span className={`cm-brand ${inverse ? 'cm-brand--inverse' : ''}`}>
    <CmLogo form="lockup" height={compact ? COMPACT_LOCKUP_HEIGHT : LOCKUP_HEIGHT} className="cm-brand__lockup" />
    <CmLogo form="mark" height={MARK_HEIGHT} className="cm-brand__mark-only" />
  </span>
);

export default CmBrand;
