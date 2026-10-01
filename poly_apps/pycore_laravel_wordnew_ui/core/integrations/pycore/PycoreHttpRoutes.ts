import rpcContract from '../../../../../config/pycore_rpc_contract.json';

/** Route table of the pycore HTTP RPC surface; paths and methods come from config/pycore_rpc_contract.json. */
type RpcRoutes = typeof rpcContract.routes;
export type PycoreRouteKey = keyof RpcRoutes;
export type PycoreRouteMethod = 'GET' | 'POST';
export type PycoreHttpRoute = string;

const ROUTE_ENTRIES = Object.entries(rpcContract.routes) as Array<[PycoreRouteKey, { path: string; method: PycoreRouteMethod }]>;

export const PYCORE_HTTP_ROUTES = Object.fromEntries(
  ROUTE_ENTRIES.map(([key, route]) => [key, route.path]),
) as { readonly [K in PycoreRouteKey]: PycoreHttpRoute };

const ROUTE_METHODS = new Map<string, PycoreRouteMethod>(ROUTE_ENTRIES.map(([, route]) => [route.path, route.method]));

export function isPycoreRouteServed(route: string): boolean {
  return ROUTE_METHODS.has(route);
}

export function pycoreRouteMethod(route: string): PycoreRouteMethod {
  return ROUTE_METHODS.get(route) ?? 'POST';
}

/** Route label of the `GET /api/status` probe. */
export const PYCORE_STATUS_ROUTE = 'status';

/**
 * Routes that fail fast instead of waiting for a reconnect: the status probe,
 * and the clip reads of a composition, which falls through to the next clip
 * source and resumes when the link is back.
 */
export const PYCORE_FAIL_FAST_ROUTES: ReadonlySet<string> = new Set([
  PYCORE_STATUS_ROUTE,
  PYCORE_HTTP_ROUTES.audioOrchResourceLookup,
  PYCORE_HTTP_ROUTES.audioOrchResourceChunk,
  PYCORE_HTTP_ROUTES.audioOrchResourceFile,
  PYCORE_HTTP_ROUTES.audioOrchResourceBundle,
]);
