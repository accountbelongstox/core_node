import { BaseAPI } from '../../../../core/api-libs/laravel/transport/BaseAPI';
import { LARAVEL_API_ROUTE } from '../../../../core/api-libs/laravel/transport/ApiContract';

export interface InviteCode {
  id: number;
  code: string;
  type: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface InviteCodeUsage {
  id: number;
  invite_code_id: number;
  user_id: number;
  device_id: string | null;
  used_at: string;
  ip_address: string | null;
  user_agent: string | null;
  user?: {
    id: number;
    username: string;
  };
}

export interface ValidateInviteCodeResponse {
  valid: boolean;
  data?: {
    type: string;
    role_level: number;
    role_name: string;
  };
  message: string;
}

export class InviteCodeAPI extends BaseAPI {
  async listPublic(): Promise<InviteCode[]> {
    const response = await this.get<InviteCode[]>(LARAVEL_API_ROUTE.inviteCodes.public);
    return response.data ?? [];
  }

  async validate(code: string): Promise<ValidateInviteCodeResponse> {
    const response = await this.post<ValidateInviteCodeResponse>(LARAVEL_API_ROUTE.inviteCodes.validate, { code });
    if (!response.data) throw new Error(response.error || 'Invite code validation failed');
    return response.data;
  }

  async redeemSuperCode(code: string): Promise<any> {
    const response = await this.post(LARAVEL_API_ROUTE.inviteCodes.redeemSuperCode, { code });
    return response;
  }
}
