import React from 'react';
import { PromotionRecordList } from './PromotionRecordList';
import { useApp } from '../contexts/AppContext';

/**
 * 推广轨迹视图
 * 现在显示推广记录列表（推广记录包含轨迹细节）
 */
export const PromotionTrackView: React.FC = () => {
  const { t } = useApp();
  return <PromotionRecordList />;
};
