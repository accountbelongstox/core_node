/**
 * CodeMart Authentication and Registration API Service
 * Handles user registration, email verification, phone verification, and KYC
 */

import { CodeMartApiBase } from './codemart-api-base';

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  real_name: string;
  role_type: 'developer' | 'client';
}

export interface RegisterResponse {
  user_id: number;
  username: string;
  email: string;
  role_type: string;
  next_step: string;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

export interface RequestPhoneVerificationRequest {
  phone: string;
}

export interface PhoneVerificationResponse {
  phone: string;
  expires_in_seconds: number;
}

export interface VerifyPhoneOtpRequest {
  otp_code: string;
}

export interface KycDocumentsRequest {
  identity_type: 'ID_CARD' | 'PASSPORT' | 'DRIVING_LICENSE';
  identity_number: string;
  real_name: string;
  date_of_birth: string;
  id_front_image: File;
  id_back_image?: File;
  selfie_image: File;
}

export interface KycDocumentsResponse {
  kyc_id: number;
  verification_status: string;
  next_step: string;
}

export interface RegistrationStatusResponse {
  user_id: number;
  username: string;
  email: string;
  email_verified: boolean;
  phone_verified: boolean;
  kyc_status: string;
  roles: Record<string, string>;
  registration_complete: boolean;
}

export class AuthApi extends CodeMartApiBase {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return this.post<RegisterResponse>('/auth/register', {
      username: data.username,
      email: data.email,
      password: data.password,
      password_confirmation: data.passwordConfirmation,
      real_name: data.real_name,
      role_type: data.role_type,
    });
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<{ user_id: number; next_step: string }> {
    return this.post('/auth/verify-email', data);
  }

  async requestPhoneVerification(data: RequestPhoneVerificationRequest): Promise<PhoneVerificationResponse> {
    return this.post<PhoneVerificationResponse>(
      '/auth/request-phone-verification',
      data
    );
  }

  async verifyPhoneOtp(data: VerifyPhoneOtpRequest): Promise<{ user_id: number; next_step: string }> {
    return this.post('/auth/verify-phone-otp', data);
  }

  async resendPhoneOtp(): Promise<PhoneVerificationResponse> {
    return this.post<PhoneVerificationResponse>('/auth/resend-phone-otp', {});
  }

  async uploadKycDocuments(data: KycDocumentsRequest): Promise<KycDocumentsResponse> {
    const formData = new FormData();
    formData.append('identity_type', data.identity_type);
    formData.append('identity_number', data.identity_number);
    formData.append('real_name', data.real_name);
    formData.append('date_of_birth', data.date_of_birth);
    formData.append('id_front_image', data.id_front_image);

    if (data.id_back_image) {
      formData.append('id_back_image', data.id_back_image);
    }

    formData.append('selfie_image', data.selfie_image);

    return this.postFormData<KycDocumentsResponse>(
      '/auth/upload-kyc-documents',
      formData
    );
  }

  async getRegistrationStatus(): Promise<RegistrationStatusResponse> {
    return this.get<RegistrationStatusResponse>('/auth/registration-status');
  }

  async checkUsernameAvailable(username: string): Promise<{ available: boolean }> {
    return this.get('/auth/check-username', { username });
  }

  async checkEmailAvailable(email: string): Promise<{ available: boolean }> {
    return this.get('/auth/check-email', { email });
  }
}

export default new AuthApi();
