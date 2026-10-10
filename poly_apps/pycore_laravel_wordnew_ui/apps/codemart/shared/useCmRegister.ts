import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifyAuthLoginSuccess } from '../../../core/auth/AuthRequestCenter';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import type { CmRegisterPayload } from '../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../api/cmErrors';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmPasswordMinLength } from '../contexts/useCmPolicy';

export type CmRoleChoice = CmRegisterPayload['role_type'];

export interface CmRegisterDraft {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  realName: string;
  roleType: CmRoleChoice;
  registrationCode: string;
}

export type CmRegisterField = keyof CmRegisterDraft;
export type CmFieldErrors<F extends string> = Partial<Record<F, string>>;

export const CM_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CM_USERNAME_MAX = 50;
export const CM_REAL_NAME_MAX = 100;
export const CM_ROLE_CHOICES: CmRoleChoice[] = ['developer', 'client'];
const USERNAME_MIN = 3;
const EMPTY_REGISTER: CmRegisterDraft = {
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  realName: '',
  roleType: 'developer',
  registrationCode: '',
};
const SERVER_FIELD_MAP: Record<string, CmRegisterField> = {
  username: 'username',
  email: 'email',
  password: 'password',
  real_name: 'realName',
  role_type: 'roleType',
  registration_code: 'registrationCode',
};
const SERVER_FIELD_ERROR_KEYS: Partial<Record<CmRegisterField, string>> = {
  username: 'publicAuth.register.errors.usernameUnavailable',
  email: 'publicAuth.register.errors.emailUnavailable',
  password: 'publicAuth.register.errors.passwordInvalid',
  realName: 'publicAuth.register.errors.realNameRequired',
  roleType: 'publicAuth.register.errors.roleRequired',
  registrationCode: 'errors.invalid_registration_code',
};

/** Field names carrying Laravel validation messages (`data` or `errors`). */
export function cmServerFieldNames(response: APIResponse<unknown>): string[] {
  const body = response.debugInfo;
  const candidates = [body?.errors, body?.data];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return Object.keys(candidate as Record<string, unknown>);
    }
  }
  return [];
}

function validateRegister(draft: CmRegisterDraft, passwordMin: number): CmFieldErrors<CmRegisterField> {
  const errors: CmFieldErrors<CmRegisterField> = {};
  const username = draft.username.trim();
  if (username.length < USERNAME_MIN || username.length > CM_USERNAME_MAX) errors.username = 'publicAuth.register.errors.usernameLength';
  if (!CM_EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'publicAuth.errors.emailInvalid';
  if (draft.password.length < passwordMin) errors.password = 'publicAuth.errors.passwordLength';
  if (draft.passwordConfirmation !== draft.password) errors.passwordConfirmation = 'publicAuth.errors.passwordMismatch';
  const realName = draft.realName.trim();
  if (!realName) errors.realName = 'publicAuth.register.errors.realNameRequired';
  else if (realName.length > CM_REAL_NAME_MAX) errors.realName = 'publicAuth.register.errors.realNameTooLong';
  if (!CM_ROLE_CHOICES.includes(draft.roleType)) errors.roleType = 'publicAuth.register.errors.roleRequired';
  return errors;
}

export interface CmRegisterModel {
  draft: CmRegisterDraft;
  update: (field: CmRegisterField, value: string) => void;
  /** Translation keys of the field errors (some take the `min` password length). */
  fieldErrors: CmFieldErrors<CmRegisterField>;
  pending: boolean;
  error: string | null;
  authenticated: boolean;
  registeredWithoutSession: boolean;
  passwordMin: number;
  submit: () => Promise<void>;
}

/** Registration form state and flow shared by the web and mobile register screens. */
export function useCmRegister(): CmRegisterModel {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const authenticated = useAuthSession();
  const passwordMin = useCmPasswordMinLength();
  const [draft, setDraft] = useState<CmRegisterDraft>(EMPTY_REGISTER);
  const [fieldErrors, setFieldErrors] = useState<CmFieldErrors<CmRegisterField>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredWithoutSession, setRegisteredWithoutSession] = useState(false);

  const update = useCallback((field: CmRegisterField, value: string): void => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    const errors = validateRegister(draft, passwordMin);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    const registrationCode = draft.registrationCode.trim();
    const response = await cmApi.register({
      username: draft.username.trim(),
      email: draft.email.trim(),
      password: draft.password,
      password_confirmation: draft.passwordConfirmation,
      real_name: draft.realName.trim(),
      role_type: draft.roleType,
      ...(registrationCode ? { registration_code: registrationCode } : {}),
    });
    setPending(false);
    if (response.success && response.data) {
      if (!response.data.token) {
        setRegisteredWithoutSession(true);
        return;
      }
      notifyAuthLoginSuccess(response.data, null);
      navigate(response.data.is_admin ? CM_PROTECTED_ROUTE.dashboard : CM_PROTECTED_ROUTE.verification);
      return;
    }
    if (cmErrorCode(response) === 'invalid_registration_code') {
      setFieldErrors({ registrationCode: 'errors.invalid_registration_code' });
      return;
    }
    const serverErrors: CmFieldErrors<CmRegisterField> = {};
    cmServerFieldNames(response).forEach((name) => {
      const field = SERVER_FIELD_MAP[name];
      if (field) serverErrors[field] = SERVER_FIELD_ERROR_KEYS[field];
    });
    setFieldErrors(serverErrors);
    setError(cmErrorMessage(t, response, 'publicAuth.register.failed'));
  }, [draft, passwordMin, navigate, t]);

  return { draft, update, fieldErrors, pending, error, authenticated, registeredWithoutSession, passwordMin, submit };
}
