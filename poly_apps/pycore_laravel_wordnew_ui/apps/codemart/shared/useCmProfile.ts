import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProfileResponse } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { cmJoinList, cmSplitList } from '../components/workspace/cmWorkspaceFormat';
import type { CmFeedback } from './cmFeedback';

export const CM_DEVELOPER_PROFILE_ROLES = ['developer', 'architect', 'reviewer'] as const;
export const CM_CLIENT_PROFILE_ROLE = 'client';
export const CM_CLIENT_FIELDS = ['company_name', 'industry', 'contact_person', 'contact_phone', 'company_website'] as const;
export const CM_WEBSITE_FIELD = 'company_website';
export const CM_NAME_MAX_LENGTH = 100;
export const CM_BIO_MAX_LENGTH = 2000;
const URL_PATTERN = /^https?:\/\/[^\s.]+\.[^\s]+$/i;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png'];
const BYTES_PER_KB = 1024;
export const CM_EMAIL_CHANGE_QUERY_PARAM = 'email_change_token';

export type CmClientField = typeof CM_CLIENT_FIELDS[number];

const emptyClient = (): Record<CmClientField, string> => ({ company_name: '', industry: '', contact_person: '', contact_phone: '', company_website: '' });

export interface CmProfileModel {
  profile: CmProfileResponse | null;
  loading: boolean;
  loadError: string | null;
  loadRetryable: boolean;
  reload: () => Promise<void>;
  saving: boolean;
  name: string;
  setName: (value: string) => void;
  nickname: string;
  setNickname: (value: string) => void;
  companyName: string;
  setCompanyName: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  skills: string;
  setSkills: (value: string) => void;
  client: Record<CmClientField, string>;
  setClientField: (field: CmClientField, value: string) => void;
  heldRoles: string[];
  hasDeveloperProfile: boolean;
  hasClientProfile: boolean;
  websiteInvalid: boolean;
  nameInvalid: boolean;
  save: () => Promise<void>;
}

/** Profile form: account names plus the developer and client blocks of the roles the account holds. */
export function useCmProfile(feedback: CmFeedback): CmProfileModel {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const [profile, setProfile] = useState<CmProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRetryable, setLoadRetryable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [client, setClient] = useState<Record<CmClientField, string>>(emptyClient());

  const apply = (data: CmProfileResponse): void => {
    setProfile(data);
    setName(data.user.name ?? '');
    setNickname(data.user.nickname ?? '');
    setCompanyName(data.developer?.company_name ?? '');
    setBio(data.developer?.bio ?? '');
    setSkills(cmJoinList(data.developer?.skills));
    setClient(Object.fromEntries(CM_CLIENT_FIELDS.map((field) => [field, data.client?.[field] ?? ''])) as Record<CmClientField, string>);
  };

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getProfile();
    if (response.success && response.data) {
      apply(response.data);
      setLoadError(null);
      setLoadRetryable(true);
    } else {
      setLoadError(cmErrorMessage(t, response, 'profile.loadFailed'));
      setLoadRetryable(response.status !== HTTP_FORBIDDEN && response.status !== HTTP_NOT_FOUND);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const heldRoles = Object.keys(profile?.roles ?? {});
  const hasDeveloperProfile = CM_DEVELOPER_PROFILE_ROLES.some((role) => heldRoles.includes(role));
  const hasClientProfile = heldRoles.includes(CM_CLIENT_PROFILE_ROLE);
  const websiteInvalid = client.company_website.trim() !== '' && !URL_PATTERN.test(client.company_website.trim());
  const nameInvalid = !name.trim();

  const save = async (): Promise<void> => {
    if (saving || websiteInvalid || nameInvalid) return;
    setSaving(true);
    feedback.clear();
    const payload: Record<string, unknown> = { name: name.trim(), nickname: nickname.trim() };
    if (hasDeveloperProfile) {
      payload.developer = { company_name: companyName.trim(), bio: bio.trim(), skills: cmSplitList(skills) };
    }
    if (hasClientProfile) {
      payload.client = Object.fromEntries(CM_CLIENT_FIELDS.map((field) => [field, client[field].trim()]));
    }
    const response = await cmApi.updateProfile(payload);
    setSaving(false);
    if (response.success) {
      feedback.success(t('profile.saved'));
      if (response.data?.user) apply(response.data);
      else await load();
      await refresh();
    } else {
      feedback.error(cmErrorMessage(t, response, 'profile.saveFailed'));
    }
  };

  return {
    profile,
    loading,
    loadError,
    loadRetryable,
    reload: load,
    saving,
    name,
    setName,
    nickname,
    setNickname,
    companyName,
    setCompanyName,
    bio,
    setBio,
    skills,
    setSkills,
    client,
    setClientField: (field, value) => setClient((current) => ({ ...current, [field]: value })),
    heldRoles,
    hasDeveloperProfile,
    hasClientProfile,
    websiteInvalid,
    nameInvalid,
    save,
  };
}

export interface CmAvatarUploadModel {
  avatarUrl: string | null;
  initial: string;
  /** Local preview of the chosen file, else the current avatar. */
  shown: string | null;
  file: File | null;
  setFile: (file: File | null) => void;
  acceptedTypes: string[];
  maxSizeMb: number;
  tooLarge: boolean;
  wrongType: boolean;
  progress: number | null;
  canUpload: boolean;
  upload: () => Promise<void>;
}

/** Account picture upload (`POST /profile/avatar`); the server re-encodes it through the shared avatar pipeline. */
export function useCmAvatarUpload(feedback: CmFeedback): CmAvatarUploadModel {
  const { t } = useTranslation('cm');
  const { bootstrap, refresh } = useCmBootstrap();
  const { maxKycImageKb } = useCmPolicy();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const avatarUrl = bootstrap?.user.avatar_url ?? null;
  const name = bootstrap?.user.name || bootstrap?.user.nickname || bootstrap?.user.username || '';
  const tooLarge = file !== null && file.size > maxKycImageKb * BYTES_PER_KB;
  const wrongType = file !== null && !ACCEPTED_AVATAR_TYPES.includes(file.type);
  const canUpload = file !== null && !tooLarge && !wrongType && progress === null;

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async (): Promise<void> => {
    if (!file || !canUpload) return;
    feedback.clear();
    setProgress(0);
    const response = await cmApi.uploadAvatar(file, setProgress);
    setProgress(null);
    if (response.success) {
      setFile(null);
      feedback.success(t('settings.avatar.updated'));
      await refresh();
    } else {
      feedback.error(cmErrorMessage(t, response, 'settings.avatar.failed'));
    }
  };

  return {
    avatarUrl,
    initial: name.slice(0, 1).toUpperCase(),
    shown: preview ?? avatarUrl,
    file,
    setFile,
    acceptedTypes: ACCEPTED_AVATAR_TYPES,
    maxSizeMb: Math.round(maxKycImageKb / BYTES_PER_KB),
    tooLarge,
    wrongType,
    progress,
    canUpload,
    upload,
  };
}

export interface CmEmailChangeModel {
  currentEmail: string | null;
  newEmail: string;
  setNewEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  emailValid: boolean;
  pendingEmail: string | null;
  busy: boolean;
  canSubmit: boolean;
  submit: () => Promise<boolean>;
}

/**
 * Email change with confirmation: the new address receives a one-time link
 * (`/settings?email_change_token=...`); opening it while signed in applies the change.
 */
export function useCmEmailChange(feedback: CmFeedback): CmEmailChangeModel {
  const { t } = useTranslation('cm');
  const { bootstrap, refresh } = useCmBootstrap();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const confirmedToken = useRef<string | null>(null);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const token = searchParams.get(CM_EMAIL_CHANGE_QUERY_PARAM);
  const emailValid = EMAIL_PATTERN.test(newEmail.trim());
  const canSubmit = !busy && emailValid && password !== '';

  useEffect(() => {
    if (!token || confirmedToken.current === token) return;
    confirmedToken.current = token;
    void (async () => {
      const response = await cmApi.confirmEmailChange(token);
      const next = new URLSearchParams(searchParams);
      next.delete(CM_EMAIL_CHANGE_QUERY_PARAM);
      setSearchParams(next, { replace: true });
      if (response.success && response.data) {
        setPendingEmail(null);
        feedbackRef.current.success(t('settings.email.changed', { email: response.data.email }));
        await refresh();
      } else {
        feedbackRef.current.error(cmErrorMessage(t, response, 'settings.email.confirmFailed'));
      }
    })();
  }, [token, searchParams, setSearchParams, refresh, t]);

  const submit = async (): Promise<boolean> => {
    if (!canSubmit) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.requestEmailChange(newEmail.trim(), password);
    setBusy(false);
    if (response.success && response.data) {
      setPendingEmail(response.data.pending_email);
      setPassword('');
      setNewEmail('');
      feedback.success(t('settings.email.requested', { email: response.data.pending_email, hours: response.data.expires_in_hours }));
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'settings.email.failed'));
    return false;
  };

  return { currentEmail: bootstrap?.user.email ?? null, newEmail, setNewEmail, password, setPassword, emailValid, pendingEmail, busy, canSubmit, submit };
}
