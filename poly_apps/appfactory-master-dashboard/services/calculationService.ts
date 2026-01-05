/**
 * Calculation Service
 * Dynamic calculation of business metrics based on actual data
 */

import { modelService } from './modelService';
import { CustomerService, Promoter, PromotionRecord } from '../types';
import { getCommissionRateByLevel } from '../constants/modelConstants';

/**
 * Calculate CS business metrics dynamically
 */
export const calculateCSMetrics = (cs: CustomerService): {
  businessAmount: number;
  commissionAmount: number;
  totalPrice: number;
  totalDeduction: number;
  totalSettlement: number;
  settledAmount: number;
  unsettledAmount: number;
} => {
  // Get all promotion records for this CS
  const allRecords = modelService.getPromotionRecords();
  
  // Filter records where CS is involved (through assigned apps)
  const csRecords = allRecords.filter(record => {
    const app = modelService.getApps().find(a => a.id === record.appId);
    return app?.assignedCSIds?.includes(cs.id) ?? false;
  });

  // Calculate from promotion records
  let totalPrice = 0;
  let totalDeduction = 0;
  let totalSettlement = 0;
  let settledAmount = 0;
  let unsettledAmount = 0;

  csRecords.forEach(record => {
    if (record.isSettled) {
      settledAmount += record.settlement;
    } else {
      unsettledAmount += record.settlement;
    }
    totalPrice += record.totalPrice;
    totalDeduction += record.deduction;
    totalSettlement += record.settlement;
  });

  // Business amount = total settlement
  const businessAmount = totalSettlement;
  
  // Commission amount = business amount * commission rate
  const commissionRate = getCommissionRateByLevel(cs.level);
  const commissionAmount = businessAmount * (commissionRate / 100);

  return {
    businessAmount,
    commissionAmount,
    totalPrice,
    totalDeduction,
    totalSettlement,
    settledAmount,
    unsettledAmount,
  };
};

/**
 * Calculate Promoter metrics dynamically
 */
export const calculatePromoterMetrics = (promoter: Promoter): {
  totalValidCount: number;
  totalPrice: number;
  totalDeduction: number;
  totalSettlement: number;
  settledAmount: number;
  unsettledAmount: number;
} => {
  // Get all promotion records for this promoter
  const allRecords = modelService.getPromotionRecords();
  const promoterRecords = allRecords.filter(r => r.promoterId === promoter.id);

  let totalValidCount = 0;
  let totalPrice = 0;
  let totalDeduction = 0;
  let totalSettlement = 0;
  let settledAmount = 0;
  let unsettledAmount = 0;

  promoterRecords.forEach(record => {
    totalValidCount += record.validCount;
    totalPrice += record.totalPrice;
    totalDeduction += record.deduction;
    totalSettlement += record.settlement;
    
    if (record.isSettled) {
      settledAmount += record.settlement;
    } else {
      unsettledAmount += record.settlement;
    }
  });

  return {
    totalValidCount,
    totalPrice,
    totalDeduction,
    totalSettlement,
    settledAmount,
    unsettledAmount,
  };
};

/**
 * Get CS with calculated metrics
 */
export const getCSWithMetrics = (cs: CustomerService): CustomerService => {
  const metrics = calculateCSMetrics(cs);
  return {
    ...cs,
    ...metrics,
    commissionAmount: metrics.commissionAmount,
    commissionPercentage: getCommissionRateByLevel(cs.level),
  };
};

/**
 * Get Promoter with calculated metrics
 */
export const getPromoterWithMetrics = (promoter: Promoter): Promoter => {
  const metrics = calculatePromoterMetrics(promoter);
  return {
    ...promoter,
    ...metrics,
  };
};

