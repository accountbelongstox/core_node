import { CM_PAGES } from '../../cmPages';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE, CM_ROUTE_BASE, cmWorkspacePath } from '../../components/public-home/cmPublicRoutes';

/** Route a path to its CM_PAGES entry (exact path, or a child like `projects/12`). */
export function mobilePageForPath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || CM_ROUTE_BASE;
  return CM_PAGES
    .filter((page) => path === cmWorkspacePath(page.path) || path.startsWith(`${cmWorkspacePath(page.path)}/`))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

/** Paths that are a top-level destination: the app bar shows the menu button there and Android back leaves the app. */
export function isMobileRootPath(pathname: string, rootPaths: readonly string[]): boolean {
  const path = pathname.replace(/\/+$/, '') || CM_ROUTE_BASE;
  return rootPaths.includes(path) || path === CM_PUBLIC_ROUTE.home;
}

export const MOBILE_HOME_PATH = CM_PROTECTED_ROUTE.dashboard;
export const MOBILE_WELCOME_PATH = CM_PUBLIC_ROUTE.home;
