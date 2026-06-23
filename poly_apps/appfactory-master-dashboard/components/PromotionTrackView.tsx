import React from 'react';
import { PromotionRecordList } from './PromotionRecordList';
import { useApp } from '../contexts/AppContext';

/**
 * Promotion Track View
 * Now displays promotion record list (promotion records include track details)
 */
export const PromotionTrackView: React.FC = () => {
  const { t } = useApp();
  return <PromotionRecordList />;
};
