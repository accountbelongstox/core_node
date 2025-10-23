import CodeMartApiBase, { type ApiResponse, type PaginatedResponse, type PaginationParams } from './codemart-api-base';
import type { User, DeveloperProfile, ClientProfile } from '../types_app_codemart';

export class UserApi extends CodeMartApiBase {
  constructor(baseUrl?: string) {
    super(baseUrl);
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.get<User>('/users/me');
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.get<User>(`/users/${id}`);
  }

  async updateUser(id: string, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.put<User>(`/users/${id}`, data);
  }

  async getDeveloperProfile(developerId: string): Promise<ApiResponse<DeveloperProfile>> {
    return this.get<DeveloperProfile>(`/developers/${developerId}/profile`);
  }

  async updateDeveloperProfile(
    developerId: string,
    profile: Partial<DeveloperProfile>
  ): Promise<ApiResponse<DeveloperProfile>> {
    return this.put<DeveloperProfile>(
      `/developers/${developerId}/profile`,
      profile
    );
  }

  async getClientProfile(clientId: string): Promise<ApiResponse<ClientProfile>> {
    return this.get<ClientProfile>(`/clients/${clientId}/profile`);
  }

  async updateClientProfile(
    clientId: string,
    profile: Partial<ClientProfile>
  ): Promise<ApiResponse<ClientProfile>> {
    return this.put<ClientProfile>(`/clients/${clientId}/profile`, profile);
  }

  async getUserStats(userId: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/users/${userId}/stats`);
  }

  async getDeveloperStats(developerId: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/developers/${developerId}/stats`);
  }

  async getClientStats(clientId: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/clients/${clientId}/stats`);
  }

  async getUserCredit(userId: string): Promise<ApiResponse<{ balance: number; usage: number }>> {
    return this.get<{ balance: number; usage: number }>(
      `/users/${userId}/credit`
    );
  }

  async addUserCredit(
    userId: string,
    amount: number,
    reason?: string
  ): Promise<ApiResponse<{ balance: number }>> {
    return this.post<{ balance: number }>(
      `/users/${userId}/credit/add`,
      { amount, reason }
    );
  }

  async deductUserCredit(
    userId: string,
    amount: number,
    reason?: string
  ): Promise<ApiResponse<{ balance: number }>> {
    return this.post<{ balance: number }>(
      `/users/${userId}/credit/deduct`,
      { amount, reason }
    );
  }

  async searchUsers(
    keyword: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<User>>> {
    const query = this.buildQuery({ keyword }, pagination);
    return this.get<PaginatedResponse<User>>('/users/search', query);
  }

  async searchDevelopers(
    filters: {
      skills?: string[];
      minRate?: number;
      maxRate?: number;
      experience?: string;
      language?: string;
    },
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<DeveloperProfile>>> {
    const query = this.buildQuery(filters, pagination);
    return this.get<PaginatedResponse<DeveloperProfile>>(
      '/developers/search',
      query
    );
  }

  async getUserReviews(
    userId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const query = this.buildQuery({}, pagination);
    return this.get<PaginatedResponse<any>>(`/users/${userId}/reviews`, query);
  }

  async getUserRating(userId: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/users/${userId}/rating`);
  }

  async getUserPortfolio(
    userId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const query = this.buildQuery({}, pagination);
    return this.get<PaginatedResponse<any>>(
      `/users/${userId}/portfolio`,
      query
    );
  }

  async addPortfolioItem(
    userId: string,
    item: {
      title: string;
      description: string;
      url?: string;
      imageUrl?: string;
      tags?: string[];
    }
  ): Promise<ApiResponse<any>> {
    return this.post<any>(`/users/${userId}/portfolio`, item);
  }

  async removePortfolioItem(
    userId: string,
    itemId: string
  ): Promise<ApiResponse<{ itemId: string }>> {
    return this.delete<{ itemId: string }>(
      `/users/${userId}/portfolio/${itemId}`
    );
  }

  async getUserConnections(
    userId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<User>>> {
    const query = this.buildQuery({}, pagination);
    return this.get<PaginatedResponse<User>>(
      `/users/${userId}/connections`,
      query
    );
  }

  async connectWithUser(userId: string, targetUserId: string): Promise<ApiResponse<any>> {
    return this.post<any>(`/users/${userId}/connections/${targetUserId}`, {});
  }

  async disconnectFromUser(
    userId: string,
    targetUserId: string
  ): Promise<ApiResponse<{ targetUserId: string }>> {
    return this.delete<{ targetUserId: string }>(
      `/users/${userId}/connections/${targetUserId}`
    );
  }

  async getUserBadges(userId: string): Promise<ApiResponse<any[]>> {
    return this.get<any[]>(`/users/${userId}/badges`);
  }

  async getDeveloperCertifications(
    developerId: string
  ): Promise<ApiResponse<any[]>> {
    return this.get<any[]>(`/developers/${developerId}/certifications`);
  }

  async addDeveloperCertification(
    developerId: string,
    cert: {
      name: string;
      issuer: string;
      issuedDate: string;
      expiryDate?: string;
      credentialUrl?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.post<any>(
      `/developers/${developerId}/certifications`,
      cert
    );
  }

  async removeDeveloperCertification(
    developerId: string,
    certId: string
  ): Promise<ApiResponse<{ certId: string }>> {
    return this.delete<{ certId: string }>(
      `/developers/${developerId}/certifications/${certId}`
    );
  }

  async getDeveloperSkills(developerId: string): Promise<ApiResponse<any[]>> {
    return this.get<any[]>(`/developers/${developerId}/skills`);
  }

  async addDeveloperSkill(
    developerId: string,
    skill: {
      name: string;
      level: 'beginner' | 'intermediate' | 'expert';
      yearsOfExperience: number;
    }
  ): Promise<ApiResponse<any>> {
    return this.post<any>(`/developers/${developerId}/skills`, skill);
  }

  async removeDeveloperSkill(
    developerId: string,
    skillId: string
  ): Promise<ApiResponse<{ skillId: string }>> {
    return this.delete<{ skillId: string }>(
      `/developers/${developerId}/skills/${skillId}`
    );
  }

  async uploadProfilePicture(userId: string, file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<{ url: string }>(
      `/users/${userId}/profile-picture`,
      {
        method: 'POST',
        body: formData,
        headers: {},
      }
    );
  }

  async getUserNotifications(
    userId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const query = this.buildQuery({}, pagination);
    return this.get<PaginatedResponse<any>>(
      `/users/${userId}/notifications`,
      query
    );
  }

  async markNotificationAsRead(
    userId: string,
    notificationId: string
  ): Promise<ApiResponse<any>> {
    return this.post<any>(
      `/users/${userId}/notifications/${notificationId}/read`,
      {}
    );
  }

  async getUserPreferences(userId: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/users/${userId}/preferences`);
  }

  async updateUserPreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<ApiResponse<any>> {
    return this.put<any>(`/users/${userId}/preferences`, preferences);
  }

  async blockUser(userId: string, targetUserId: string): Promise<ApiResponse<any>> {
    return this.post<any>(`/users/${userId}/blocked/${targetUserId}`, {});
  }

  async unblockUser(
    userId: string,
    targetUserId: string
  ): Promise<ApiResponse<any>> {
    return this.delete<any>(
      `/users/${userId}/blocked/${targetUserId}`
    );
  }

  async getBlockedUsers(userId: string): Promise<ApiResponse<User[]>> {
    return this.get<User[]>(`/users/${userId}/blocked`);
  }
}

export default UserApi;
