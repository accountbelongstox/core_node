/**
 * Mesh login guide client: the Laravel beside the Headscale control server
 * (contract access.mesh.headscale guide/preauth-key/register routes), signed
 * with the client key like every Laravel call.
 */
import { DEFAULT_LARAVEL_API_ORIGIN } from '@/core/contracts/ServiceContract';
import { MESH_GUIDE_ROUTES } from '@/core/contracts/MeshDomain';
import { withClientKey } from '@/core/integrations/laravel/ClientKeySigner';
import { readLaravelResponse } from '@/core/integrations/laravel/LaravelRequest';
import { protocolFetch } from '@/core/network/ProtocolFetch';

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
  const url = `${DEFAULT_LARAVEL_API_ORIGIN}${path}`;
  const hasBody = payload !== undefined;
  const init = await withClientKey(url, {
    method,
    headers: { Accept: 'application/json', ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
    body: hasBody ? JSON.stringify(payload) : undefined,
  });
  return readLaravelResponse<LaravelEnvelope<T>>(await protocolFetch(url, init), path);
}

export const meshGuideApi = {
  guide: async (): Promise<MeshGuide> => (await request<MeshGuide>('GET', MESH_GUIDE_ROUTES.guide)).data,
  createPreauthKey: async (): Promise<MeshPreauthKey> => (await request<MeshPreauthKey>('POST', MESH_GUIDE_ROUTES.preauthKey)).data,
  register: async (authId: string): Promise<string> => (await request<null>('POST', MESH_GUIDE_ROUTES.register, { auth_id: authId })).message ?? '',
};
