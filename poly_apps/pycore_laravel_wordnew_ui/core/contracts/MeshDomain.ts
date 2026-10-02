/**
 * Mesh VPN MagicDNS domains (contract access.mesh): every provider's tailnet
 * domain template, matched for any provider and expanded for the default one.
 *
 * Aligned adapters:
 * - pycore/pyfoundations/service_contract.py (mesh_domain)
 * - poly_apps/laravel_main/app/Support/ServiceContract.php (tailnetDomainOf)
 * - scripts/shells/linux/common/mesh_common.sh / win_common/MeshCommon.ps1
 *
 * Plain functions only: imported by the Vite config (node) and the browser bundle.
 */
import contractDocument from '../../../../config/service_contract.json';

type MeshProvider = 'headscale' | 'tailscale';

const MESH = contractDocument.access.mesh;
const ROOT_DOMAINS: string[] = contractDocument.access.root_domains;
const DEFAULT_REGION: string = contractDocument.access.default_api_region_prefix;
const API_LABEL: string = contractDocument.access.tailnet.api_label;
const DNS_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const MESH_PROVIDERS: MeshProvider[] = ['headscale', 'tailscale'];

/** Placeholder in contract URL entries for the active tailnet domain. */
export const MESH_DOMAIN_PLACEHOLDER = '{mesh_domain}';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function labelPattern(label: string): string {
  if (label === '{root}') return `(?:${ROOT_DOMAINS.map(escapeRegExp).join('|')})`;
  if (/^\{\w+\}$/.test(label)) return DNS_LABEL;
  return escapeRegExp(label);
}

/** `[api.]<machine>.<tailnet domain>` for every provider's domain template. */
const TAILNET_HOST_PATTERNS: RegExp[] = MESH_PROVIDERS.map((provider) => new RegExp(
  `^(?:${escapeRegExp(API_LABEL)}\\.)?${DNS_LABEL}\\.(${MESH[provider].domain_labels.map(labelPattern).join('\\.')})$`,
));

/** The tailnet domain of a `[api.]<machine>.<tailnet domain>` host of any mesh provider; '' otherwise. */
export function tailnetDomainOf(hostname: string): string {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  for (const pattern of TAILNET_HOST_PATTERNS) {
    const match = pattern.exec(host);
    if (match) return match[1];
  }
  return '';
}

/** A provider's MagicDNS domain; '' while a live-only label ({tailnet}) is unknown. */
export function meshDomain(provider: MeshProvider = MESH.provider_default as MeshProvider, region: string = DEFAULT_REGION): string {
  const known: Record<string, string> = {
    region,
    root: ROOT_DOMAINS[MESH.headscale.root_domain_index],
  };
  const labels = MESH[provider].domain_labels.map((label) => (
    /^\{\w+\}$/.test(label) ? known[label.slice(1, -1)] ?? '' : label
  ));
  return labels.every(Boolean) ? labels.join('.') : '';
}

/** A contract URL on the live tailnet domain, else on the default provider's domain. */
export function resolveMeshUrl(url: string, liveTailnet: string): string {
  return url.split(MESH_DOMAIN_PLACEHOLDER).join(liveTailnet || meshDomain());
}

/** Vite allowedHosts entries (leading dot = every subdomain) for the live and default tailnet domains. */
export function meshAllowedHostSuffixes(liveTailnet: string): string[] {
  const tailscaleSuffix = MESH.tailscale.domain_labels.filter((label) => !/^\{\w+\}$/.test(label)).join('.');
  return [...new Set([liveTailnet, meshDomain(), tailscaleSuffix].filter(Boolean).map((domain) => `.${domain}`))];
}
