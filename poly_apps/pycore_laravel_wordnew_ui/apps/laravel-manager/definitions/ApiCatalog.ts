/** Composed Laravel API catalog. */
import { API_CORE_ENDPOINTS } from './ApiCatalogCore';
import { API_MANAGEMENT_ENDPOINTS } from './ApiCatalogManagement';

export const API_ENDPOINTS = [
  ...API_CORE_ENDPOINTS,
  ...API_MANAGEMENT_ENDPOINTS,
];
