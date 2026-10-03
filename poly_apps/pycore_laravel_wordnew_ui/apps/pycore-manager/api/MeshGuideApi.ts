/**
 * Mesh login guide client: the Laravel beside the Headscale control server
 * (contract access.mesh.headscale guide/preauth-key/register routes), signed
 * with the client key when the build carries one, else with the user login of
 * THAT Laravel API (its own session; a 401 opens the shared login for it).
 */
import { DEFAULT_LARAVEL_API_ORIGIN } from '@/core/contracts/ServiceContract';
import { MESH_GUIDE_ROUTES } from '@/core/contracts/MeshDomain';
import { withClientKey } from '@/core/integrations/laravel/ClientKeySigner';
import { readSessionResponse } from '@/core/integrations/laravel/LaravelRequest';
import { getAuthHeader } from '@/core/auth/AuthSession';
import { protocolFetch } from '@/core/network/ProtocolFetch';

/** The Laravel API that serves the mesh guide (and whose login the guide needs). */
export const MESH_GUIDE_API_ORIGIN = DEFAULT_LARAVEL_API_ORIGIN;

export interface MeshGuideNode {
  name: string;
  ip_addresses: string[];
  online: boolean;
  last_seen: string | null;
}

export interface MeshGuide {
  login_server: string;
  mesh_domain: string;
  user: string;
  key_expiration: string;
  mobile_clients: { android: string; ios: string };
  nodes: MeshGuideNode[];
}

export interface MeshPreauthKey {
  key: string;
  expiration: string | null;
}

interface LaravelEnvelope<T> {
  data: T;
  message?: string;
}

async function request<T>(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<LaravelEnvelope<T>> {
  const url = `${MESH_GUIDE_API_ORIGIN}${path}`;
  const hasBody = payload !== undefined;
  const authHeader = getAuthHeader(MESH_GUIDE_API_ORIGIN);
  const init = await withClientKey(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: hasBody ? JSON.stringify(payload) : undefined,
  });
  return readSessionResponse<LaravelEnvelope<T>>(await protocolFetch(url, init), path, MESH_GUIDE_API_ORIGIN);
}

export const meshGuideApi = {
  guide: async (): Promise<MeshGuide> => (await request<MeshGuide>('GET', MESH_GUIDE_ROUTES.guide)).data,
  createPreauthKey: async (): Promise<MeshPreauthKey> => (await request<MeshPreauthKey>('POST', MESH_GUIDE_ROUTES.preauthKey)).data,
  register: async (authId: string): Promise<string> => (await request<null>('POST', MESH_GUIDE_ROUTES.register, { auth_id: authId })).message ?? '',
};
