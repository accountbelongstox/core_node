/**
 * Data Helper Utilities
 * Centralized data access and combination utilities
 * All data should come from central data sources (constants.ts)
 */

import { MOCK_APPS, MOCK_CS, MOCK_TECH, MOCK_PROMOTERS } from '../constants';
import { AppInstance, CustomerService, TechMember, Promoter } from '../types';

/**
 * Get app by ID from central data source
 */
export const getAppById = (appId: string): AppInstance | undefined => {
  return MOCK_APPS.find(app => app.id === appId);
};

/**
 * Get app name by ID from central data source
 */
export const getAppNameById = (appId: string): string => {
  const app = getAppById(appId);
  return app?.name ?? 'Unknown App';
};

/**
 * Get customer service by ID from central data source
 */
export const getCSById = (csId: string): CustomerService | undefined => {
  return MOCK_CS.find(cs => cs.id === csId);
};

/**
 * Get customer service name by ID from central data source
 */
export const getCSNameById = (csId: string): string => {
  const cs = getCSById(csId);
  return cs?.name ?? 'Unknown CS';
};

/**
 * Get tech member by ID from central data source
 */
export const getTechById = (techId: string): TechMember | undefined => {
  return MOCK_TECH.find(tech => tech.id === techId);
};

/**
 * Get tech member name by ID from central data source
 */
export const getTechNameById = (techId: string): string => {
  const tech = getTechById(techId);
  return tech?.name ?? 'Unknown Tech';
};

/**
 * Get promoter by ID from central data source
 */
export const getPromoterById = (promoterId: string): Promoter | undefined => {
  return MOCK_PROMOTERS.find(promoter => promoter.id === promoterId);
};

/**
 * Get promoter name by ID from central data source
 */
export const getPromoterNameById = (promoterId: string): string => {
  const promoter = getPromoterById(promoterId);
  return promoter?.name ?? 'Unknown Promoter';
};

/**
 * Get multiple apps by IDs from central data source
 */
export const getAppsByIds = (appIds: string[]): AppInstance[] => {
  return MOCK_APPS.filter(app => appIds.includes(app.id));
};

/**
 * Get multiple CS by IDs from central data source
 */
export const getCSByIds = (csIds: string[]): CustomerService[] => {
  return MOCK_CS.filter(cs => csIds.includes(cs.id));
};

/**
 * Translate request status
 */
export const translateRequestStatus = (status: string, t: (key: string) => string): string => {
  const statusMap: Record<string, string> = {
    'pending': t('appGeneration.statusPending'),
    'in_progress': t('appGeneration.statusInProgress'),
    'completed': t('appGeneration.statusCompleted'),
    'failed': t('appGeneration.statusFailed'),
  };
  return statusMap[status] ?? status;
};

