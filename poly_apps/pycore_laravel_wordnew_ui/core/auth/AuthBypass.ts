import { authNamespaceOf, getActiveAuthNamespace } from './AuthSession';

/** Laravel APIs (namespaces) that answered the loopback debug probe: every user counts as signed in there. */
const bypassedNamespaces = new Set<string>();

export function setAuthBypass(enabled: boolean, endpoint?: string | null): void {
  const namespace = endpoint ? authNamespaceOf(endpoint) : getActiveAuthNamespace();
  if (!namespace) return;
  if (enabled) bypassedNamespaces.add(namespace);
  else bypassedNamespaces.delete(namespace);
}

export function isAuthBypassed(endpoint?: string | null): boolean {
  const namespace = endpoint ? authNamespaceOf(endpoint) : getActiveAuthNamespace();
  return namespace !== null && bypassedNamespaces.has(namespace);
}
