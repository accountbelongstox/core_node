/* [v4.1-Iris] Edit Profile — ported from
 * poly_apps/qy_capacitor/pages/Profile/ProfileEdit.tsx. Self-contained:
 * useWfApp() for user/setUser/t, react-router useNavigate + wfPath() for nav.
 * Persists via wordflowApi.request('/user/profile', PUT) when the backend
 * accepts it; on any failure it falls back to an optimistic local setUser() so
 * the form never crashes. Avatar uploads for real via POST /user/avatar
 * (multipart FormData — request() skips the JSON Content-Type for FormData).
 * Every call is try/caught. Reference-faithful Iris look. */
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Icons, Button, BackButton, Spinner, Sheet, SectionTitle, ProgressBar } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

// ---- Password change modal -------------------------------------------------
interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (oldPassword: string, newPassword: string) => void;
  t: (key: string, r?: Record<string, string | number>) => string;
}

const PasswordChangeModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onConfirm, t }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(t('profile.allFieldsRequired') || 'All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordsNotMatch') || 'Passwords do not match.');
      return;
    }
    onConfirm(oldPassword, newPassword);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const inputCls =
    'w-full p-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] outline-none text-[var(--color-text-primary)] transition-all';

  return (
    <Sheet open={isOpen} onClose={onClose} position="center" panelClassName="animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('profile.changePassword') || 'Change Password'}</h2>
        <button onClick={onClose} className="ds-touch-target p-2 hover:bg-[var(--color-surface)] rounded-lg text-[var(--color-text-secondary)]" aria-label="Close">
          <Icons.Close />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('profile.currentPassword') || 'Current Password'}</label>
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={inputCls} placeholder={t('profile.enterCurrentPassword') || 'Enter current password'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('profile.newPassword') || 'New Password'}</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder={t('profile.enterNewPassword') || 'Enter new password'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('profile.confirmNewPassword') || 'Confirm New Password'}</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} placeholder={t('profile.confirmPassword') || 'Confirm password'} />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel') || 'Cancel'}</Button>
        <Button variant="klein" onClick={handleSubmit} className="flex-1">{t('common.confirm') || 'Confirm'}</Button>
      </div>
    </Sheet>
  );
};

// ---- Form input ------------------------------------------------------------
interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
}

const FormInput: React.FC<FormInputProps> = ({ label, value, onChange, placeholder, type = 'text', disabled = false, rows, maxLength }) => {
  const isTextarea = rows !== undefined;
  const baseCls = `w-full p-3 rounded-[var(--radius-button)] border transition-all outline-none ${
    disabled
      ? 'bg-[var(--color-surface-variant)] border-[var(--border-highlight)] cursor-not-allowed text-[var(--color-text-tertiary)]'
      : 'bg-[var(--color-surface)] border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] text-[var(--color-text-primary)]'
  }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>
        {maxLength && <span className="text-xs text-[var(--color-text-tertiary)]">{value.length} / {maxLength}</span>}
      </div>
      {isTextarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} disabled={disabled} className={`${baseCls} resize-none`} placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} disabled={disabled} className={baseCls} placeholder={placeholder} />
      )}
    </div>
  );
};

const WfProfileEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, t } = useWfApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extended profile fields are not on the typed User — read via a loose view.
  const ux: Record<string, any> = (user as any) || {};

  const [formData, setFormData] = useState({
    nickname: user?.nickname || '',
    name: user?.name || user?.username || '',
    email: user?.email || '',
    bio: ux.bio || '',
    location: ux.location || '',
    phone: ux.phone || '',
    age: String(ux.age ?? ''),
    gender: ux.gender || '',
    birthday: ux.birthday || '',
    city: ux.city || '',
    education: ux.education || '',
    occupation: ux.occupation || '',
    native_language: user?.native_language || '',
    religion: ux.religion || '',
    website: ux.website || '',
    github: ux.github || '',
    wechat: ux.wechat || '',
    weibo: ux.weibo || '',
    qq: ux.qq || '',
  });

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || user?.avatar || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Avatar: real multipart upload to POST /user/avatar (mirrors the original
  // ApiCenter.user.updateAvatar). The local data-URL preview is shown
  // immediately; on failure the previous avatar is restored.
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('profile.selectImageFile') || 'Please select an image file.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile.imageTooLarge') || 'Image is too large (max 5MB).');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    setError('');
    setUploadProgress(10);

    // Instant local preview while the upload runs.
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ''));
    reader.readAsDataURL(file);

    // Simulated progress (fetch gives no upload progress events).
    const progressInterval = window.setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await wordflowApi.request<{ avatar_url?: string }>('/user/avatar', {
        method: 'POST',
        body: form,
      });
      window.clearInterval(progressInterval);
      setUploadProgress(100);
      const avatarUrl = res?.avatar_url;
      if (avatarUrl) {
        if (user) setUser({ ...user, avatar_url: avatarUrl } as any);
        setAvatarPreview(avatarUrl);
      } else if (user) {
        // Backend accepted but returned no URL — keep the local preview on the user.
        setUser({ ...user, avatar_url: avatarPreview } as any);
      }
      setSuccess(t('profile.avatarUploadedSuccess') || 'Avatar uploaded.');
      setTimeout(() => {
        setSuccess('');
        setUploadProgress(0);
      }, 2000);
    } catch (err) {
      console.error('[WfProfileEdit] avatar upload failed:', err);
      window.clearInterval(progressInterval);
      setError(t('profile.uploadFailed') || 'Upload failed.');
      setAvatarPreview(user?.avatar_url || user?.avatar || '');
      setTimeout(() => {
        setError('');
        setUploadProgress(0);
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    setLoading(true);
    setError('');
    try {
      await wordflowApi.request('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ old_password: oldPassword, password: newPassword, password_confirmation: newPassword }),
      });
      setSuccess(t('profile.passwordChangedSuccess') || 'Password changed.');
      setShowPasswordModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error('[WfProfileEdit] password change failed:', e);
      setError(t('profile.updateFailed') || 'Update failed. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Best-effort backend persist. The backend returns { user } in its data
      // envelope (already unwrapped by request()).
      const res = await wordflowApi.request<{ user?: any }>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      const nextUser = res?.user ?? (user ? { ...user, ...formData } : null);
      if (nextUser) setUser(nextUser as any);
      setSuccess(t('profile.changesSavedSuccess') || 'Changes saved.');
      setTimeout(() => navigate(wfPath('profile')), 1200);
    } catch (e) {
      console.error('[WfProfileEdit] save failed, applying local fallback:', e);
      // Graceful local fallback so edits are never lost on a backend hiccup.
      if (user) setUser({ ...user, ...formData } as any);
      setSuccess(t('profile.changesSavedLocally') || 'Saved locally (offline).');
      setTimeout(() => navigate(wfPath('profile')), 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-28">

      {/* Header */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate(wfPath('profile'))} label={t('common.cancel') || 'Cancel'} />
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('profile.editProfile') || 'Edit Profile'}</h1>
        </div>
        <p className="text-[var(--color-text-secondary)]">Update your profile information</p>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Avatar */}
        <Card>
          <div className="flex flex-col items-center">
            <div className="relative group mb-4">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-28 h-28 rounded-full border border-[var(--border-highlight)] object-cover" />
              ) : (
                <div className="w-28 h-28 rounded-full border border-[var(--border-highlight)] flex items-center justify-center text-3xl font-bold bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                  {(user?.name || user?.username || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--klein-blue)]/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <Icons.Edit />
                <span className="text-xs text-[var(--klein-on)] mt-1">Upload</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--color-text-secondary)]">Uploading...</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{uploadProgress}%</span>
                </div>
                <ProgressBar value={uploadProgress} />
              </div>
            )}

            {!loading && (
              <p className="text-sm text-[var(--color-text-secondary)] text-center">
                Click avatar to upload<br />
                <span className="text-xs opacity-75">Max 5MB • JPG, PNG, GIF</span>
              </p>
            )}
          </div>
        </Card>

        {/* Status */}
        {error && (
          <Card className="!border-red-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white flex-shrink-0"><Icons.X /></div>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          </Card>
        )}
        {success && (
          <Card className="!border-emerald-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white flex-shrink-0"><Icons.Check /></div>
              <p className="text-emerald-500 text-sm">{success}</p>
            </div>
          </Card>
        )}

        {/* Basic information */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.basicInfo') || 'Basic Information'} className="px-1" />
          <Card>
            <div className="space-y-4">
              <FormInput label={t('profile.usernameReadonly') || 'Username (read-only)'} value={user?.username || ''} onChange={() => {}} disabled />
              <FormInput label={t('profile.nickname') || 'Nickname'} value={formData.nickname} onChange={(v) => handleInputChange('nickname', v)} placeholder={t('profile.enterNickname') || 'Enter nickname'} maxLength={20} />
              <FormInput label={t('profile.displayName') || 'Display Name'} value={formData.name} onChange={(v) => handleInputChange('name', v)} placeholder={t('profile.enterName') || 'Enter name'} maxLength={50} />
              <FormInput label={t('profile.email') || 'Email'} value={formData.email} onChange={(v) => handleInputChange('email', v)} placeholder={t('profile.enterEmail') || 'Enter email'} type="email" />
              <FormInput label={t('profile.bio') || 'Bio'} value={formData.bio} onChange={(v) => handleInputChange('bio', v)} placeholder={t('profile.aboutYourself') || 'Tell us about yourself'} rows={3} maxLength={200} />
            </div>
          </Card>
        </div>

        {/* Personal details */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.personalInfo') || 'Personal Details'} className="px-1" />
          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput label={t('profile.phone') || 'Phone'} value={formData.phone} onChange={(v) => handleInputChange('phone', v)} placeholder={t('profile.phoneNumber') || 'Phone number'} type="tel" />
                <FormInput label={t('profile.age') || 'Age'} value={formData.age} onChange={(v) => handleInputChange('age', v)} placeholder={t('profile.yourAge') || 'Your age'} type="number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('profile.gender') || 'Gender'}</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full p-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] outline-none text-[var(--color-text-primary)] transition-all"
                  >
                    <option value="">{t('profile.selectGender') || 'Select gender'}</option>
                    <option value="male">{t('profile.male') || 'Male'}</option>
                    <option value="female">{t('profile.female') || 'Female'}</option>
                    <option value="other">{t('profile.other') || 'Other'}</option>
                  </select>
                </div>
                <FormInput label={t('profile.birthday') || 'Birthday'} value={formData.birthday} onChange={(v) => handleInputChange('birthday', v)} type="date" />
              </div>
            </div>
          </Card>
        </div>

        {/* Location & work */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.locationWork') || 'Location & Work'} className="px-1" />
          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput label={t('profile.location') || 'Location'} value={formData.location} onChange={(v) => handleInputChange('location', v)} placeholder={t('profile.countryRegion') || 'Country / region'} />
                <FormInput label={t('profile.city') || 'City'} value={formData.city} onChange={(v) => handleInputChange('city', v)} placeholder={t('profile.yourCity') || 'Your city'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label={t('profile.education') || 'Education'} value={formData.education} onChange={(v) => handleInputChange('education', v)} placeholder={t('profile.educationLevel') || 'Education level'} />
                <FormInput label={t('profile.occupation') || 'Occupation'} value={formData.occupation} onChange={(v) => handleInputChange('occupation', v)} placeholder={t('profile.yourOccupation') || 'Your occupation'} />
              </div>
            </div>
          </Card>
        </div>

        {/* Language & culture */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.languageCulture') || 'Language & Culture'} className="px-1" />
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label={t('profile.nativeLanguage') || 'Native Language'} value={formData.native_language} onChange={(v) => handleInputChange('native_language', v)} placeholder={t('profile.yourNativeLanguage') || 'Your native language'} />
              <FormInput label={t('profile.religion') || 'Religion'} value={formData.religion} onChange={(v) => handleInputChange('religion', v)} placeholder={t('profile.religionOptional') || 'Religion (optional)'} />
            </div>
          </Card>
        </div>

        {/* Social links */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.socialLinks') || 'Social Links'} className="px-1" />
          <Card>
            <div className="space-y-4">
              <FormInput label={t('profile.website') || 'Website'} value={formData.website} onChange={(v) => handleInputChange('website', v)} placeholder={t('profile.yourWebsite') || 'Your website'} type="url" />
              <FormInput label={t('profile.github') || 'GitHub'} value={formData.github} onChange={(v) => handleInputChange('github', v)} placeholder={t('profile.githubUsername') || 'GitHub username'} />
              <div className="grid grid-cols-3 gap-3">
                <FormInput label={t('profile.wechat') || 'WeChat'} value={formData.wechat} onChange={(v) => handleInputChange('wechat', v)} placeholder={t('profile.wechatId') || 'WeChat ID'} />
                <FormInput label={t('profile.weibo') || 'Weibo'} value={formData.weibo} onChange={(v) => handleInputChange('weibo', v)} placeholder={t('profile.weiboHandle') || 'Weibo handle'} />
                <FormInput label={t('profile.qq') || 'QQ'} value={formData.qq} onChange={(v) => handleInputChange('qq', v)} placeholder={t('profile.qqNumber') || 'QQ number'} />
              </div>
            </div>
          </Card>
        </div>

        {/* Security */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.security') || 'Security'} className="px-1" />
          <div onClick={() => setShowPasswordModal(true)} className="ds-row p-5 cursor-pointer ds-touch-target flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-full flex items-center justify-center text-[var(--klein-blue)]"><Icons.Lock /></div>
              <span className="font-semibold text-[var(--color-text-primary)]">{t('profile.changePassword') || 'Change Password'}</span>
            </div>
            <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 pb-8">
          <Button variant="secondary" onClick={() => navigate(wfPath('profile'))} className="flex-1" disabled={saving || loading}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="klein" onClick={handleSave} className="flex-1 relative" disabled={saving || loading}>
            {saving ? (
              <span className="flex items-center gap-2"><Spinner size="sm" />{t('profile.savingChanges') || 'Saving…'}</span>
            ) : (
              t('common.save') || 'Save'
            )}
          </Button>
        </div>
      </div>

      <PasswordChangeModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onConfirm={handlePasswordChange} t={t} />
    </div>
  );
};

export default WfProfileEditPage;
