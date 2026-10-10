import type { ComponentType } from 'react';

/**
 * Mobile screens one work package provides, keyed by the id of the web page
 * they replace. A page without a mobile screen keeps rendering its web page
 * inside the mobile frame.
 */
export interface CmMobileScreenMap {
  /** Key: CM_PAGES id, or `project-detail`. */
  workspace: Record<string, ComponentType>;
  /** Key: CM_PUBLIC_PAGES id; rendered inside the signed-out frame. */
  public: Record<string, ComponentType>;
  /** Key: CM_ADMIN_ROUTES id; rendered inside the signed-in frame behind the administrator gate. */
  admin: Record<string, ComponentType>;
}
