/** Stable persisted type for an endpoint resolved from the current page URL. */
export const CURRENT_URL_TYPE = 'current-url';

/** Match the stable type or a host-qualified runtime endpoint identity. */
export function isCurrentUrlId(id: string | null | undefined): boolean {
  return id === CURRENT_URL_TYPE
    || (typeof id === 'string' && id.startsWith(`${CURRENT_URL_TYPE}:`));
}
