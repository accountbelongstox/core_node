export const CM_ROUTE_BASE = '/codemart';

export const CM_PUBLIC_ROUTE = {
  home: '/codemart',
  about: '/codemart/about',
  delivery: '/codemart/delivery-process',
  services: '/codemart/services',
  estimate: '/codemart/estimate',
  download: '/codemart/download',
  privacy: '/codemart/privacy',
  terms: '/codemart/terms',
  information: '/codemart/information',
  showcase: '/codemart/showcase',
  showcaseOpenWork: '/codemart/showcase#cm-showcase-open-tasks',
  login: '/codemart/login',
  register: '/codemart/register',
  forgotPassword: '/codemart/forgot-password',
  passwordReset: '/codemart/password-reset',
} as const;

export const CM_PROTECTED_ROUTE = {
  dashboard: '/codemart/dashboard',
  verification: '/codemart/verification',
  profile: '/codemart/profile',
  marketplace: '/codemart/marketplace',
  projects: '/codemart/projects',
  projectCreate: '/codemart/projects/new',
  wallet: '/codemart/wallet',
} as const;

const PUBLIC_PATHS: readonly string[] = Object.values(CM_PUBLIC_ROUTE).map((route) => route.split('#')[0]);

/** Whether a CodeMart path renders without a session. */
export function isCmPublicPath(to: string): boolean {
  const path = to.split(/[?#]/)[0].replace(/\/+$/, '') || CM_ROUTE_BASE;
  if (!path.startsWith(CM_ROUTE_BASE)) return true;
  return PUBLIC_PATHS.some((publicPath) => path === publicPath || (publicPath === CM_PUBLIC_ROUTE.passwordReset && path.startsWith(`${publicPath}/`)));
}
