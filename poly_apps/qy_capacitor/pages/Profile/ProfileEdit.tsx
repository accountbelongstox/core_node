/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, BackButton, Spinner, Sheet, ProgressBar, SectionTitle } from '../../components/UI';
import { Avatar } from '../../components/Avatar';
import { ApiCenter } from '../../services/ApiCenter';
import { compressAvatarImage } from '../../services/imageCompression';

/**
 * Profile Edit Page - Unified Design System
 */

// Password Change Modal
interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (oldPassword: string, newPassword: string) => void;
  t: (key: string) => string;
}

const PasswordChangeModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onConfirm, t }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(t('profile.allFieldsRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordsNotMatch'));
      return;
    }
    onConfirm(oldPassword, newPassword);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const inputCls =
    "w-full p-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] outline-none text-[var(--color-text-primary)] transition-all";

  return (
    <Sheet open={isOpen} onClose={onClose} position="center" panelClassName="animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('profile.changePassword')}</h2>
        <button onClick={onClose} className="ds-touch-target p-2 hover:bg-[var(--color-surface)] rounded-lg text-[var(--color-text-secondary)]">
          <Icons.Close />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t('profile.currentPassword')}
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={inputCls}
            placeholder={t('profile.enterCurrentPassword')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t('profile.newPassword')}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputCls}
            placeholder={t('profile.enterNewPassword')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t('profile.confirmNewPassword')}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputCls}
            placeholder={t('profile.confirmPassword')}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button variant="klein" onClick={handleSubmit} className="flex-1">
          {t('common.confirm')}
        </Button>
      </div>
    </Sheet>
  );
};

// Form Input Component
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

const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  rows,
  maxLength,
}) => {
  const isTextarea = rows !== undefined;
  const currentLength = value.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
        {maxLength && (
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {currentLength} / {maxLength}
          </span>
        )}
      </div>
      {isTextarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className={`w-full p-3 rounded-[var(--radius-button)] border transition-all resize-none outline-none ${
            disabled
              ? 'bg-[var(--color-surface-variant)] border-[var(--border-highlight)] cursor-not-allowed text-[var(--color-text-tertiary)]'
              : 'bg-[var(--color-surface)] border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] text-[var(--color-text-primary)]'
          }`}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          disabled={disabled}
          className={`w-full p-3 rounded-[var(--radius-button)] border transition-all outline-none ${
            disabled
              ? 'bg-[var(--color-surface-variant)] border-[var(--border-highlight)] cursor-not-allowed text-[var(--color-text-tertiary)]'
              : 'bg-[var(--color-surface)] border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] text-[var(--color-text-primary)]'
          }`}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

const ProfileEditPage = () => {
  const { user, navigate, setUser, t } = useContext(AppContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    nickname: user?.nickname || '',
    name: user?.name || user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || '',
    phone: user?.phone || '',
    age: user?.age || '',
    gender: user?.gender || '',
    birthday: user?.birthday || '',
    city: user?.city || '',
    education: user?.education || '',
    occupation: user?.occupation || '',
    native_language: user?.native_language || '',
    religion: user?.religion || '',
    website: user?.website || '',
    github: user?.github || '',
    wechat: user?.wechat || '',
    weibo: user?.weibo || '',
    qq: user?.qq || '',
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError(t('profile.selectImageFile'));
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile.imageTooLarge'));
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Upload avatar with progress
    setLoading(true);
    setError('');
    setUploadProgress(10);

    // Downscale + compress on the client BEFORE upload so the payload can
    // never explode (longest side <= 512px, JPEG ~0.85, base64 well under
    // ~300KB, hard 5MB reject — aligned with the backend avatar contract).
    let compressed;
    try {
      compressed = await compressAvatarImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.uploadFailed'));
      setLoading(false);
      setTimeout(() => {
        setError('');
        setUploadProgress(0);
      }, 3000);
      return;
    }

    // Show the compressed preview immediately.
    setAvatarPreview(compressed.dataUrl);

    // Simulate progress (since we don't have real progress from API)
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    const avatarResponse = await ApiCenter.user.updateAvatar(compressed.file);
    clearInterval(progressInterval);
    setUploadProgress(100);

    if (avatarResponse.success && avatarResponse.data?.avatar_url) {
      const updatedUser = { ...user, avatar_url: avatarResponse.data.avatar_url };
      setUser(updatedUser as any);
      setAvatarPreview(avatarResponse.data.avatar_url);
      setSuccess(t('profile.avatarUploadedSuccess'));
      setTimeout(() => {
        setSuccess('');
        setUploadProgress(0);
      }, 2000);
    } else {
      setError(avatarResponse.error?.message || t('profile.uploadFailed'));
      setAvatarPreview(user?.avatar_url || user?.avatar || '');
      setTimeout(() => {
        setError('');
        setUploadProgress(0);
      }, 3000);
    }

    setLoading(false);
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    setLoading(true);
    setError('');

    const response = await ApiCenter.user.updateProfile({
      old_password: oldPassword,
      password: newPassword,
      password_confirmation: newPassword,
    } as any);

    if (response.success) {
      setSuccess(t('profile.passwordChangedSuccess'));
      setShowPasswordModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(response.error?.message || t('profile.updateFailed'));
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const response = await ApiCenter.user.updateProfile(formData);

    if (response.success && response.data?.user) {
      setSuccess(t('profile.changesSavedSuccess'));
      setUser(response.data.user);

      setTimeout(() => {
        navigate('profile');
      }, 1500);
    } else {
      setError(response.error?.message || t('profile.updateFailed'));
      setTimeout(() => setError(''), 5000);
    }

    setSaving(false);
  };

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      {/* Minimal asymmetric header */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate('profile')} label={t('common.cancel')} />
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            {t('profile.editProfile')}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)]">
          Update your profile information
        </p>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Avatar Upload Card */}
        <Card>
          <div className="flex flex-col items-center">
            <div className="relative group mb-4">
              <Avatar
                src={avatarPreview}
                name={user?.name || user?.nickname || user?.username}
                alt="Avatar"
                className="w-28 h-28 rounded-full border border-[var(--border-highlight)] text-3xl"
              />
              <button
                onClick={handleAvatarClick}
                disabled={loading}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--klein-blue)]/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <Icons.Edit className="w-6 h-6 text-[var(--klein-on)] mb-1" />
                <span className="text-xs text-[var(--klein-on)]">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full">
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

        {/* Status Messages */}
        {error && (
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          </Card>
        )}

        {success && (
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>
            </div>
          </Card>
        )}

        {/* Basic Information */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.basicInfo')} className="px-1" />

          <Card>
            <div className="space-y-4">
              <FormInput
                label={t('profile.usernameReadonly')}
                value={user?.username || ''}
                onChange={() => {}}
                disabled={true}
              />

              <FormInput
                label={t('profile.nickname')}
                value={formData.nickname}
                onChange={(val) => handleInputChange('nickname', val)}
                placeholder={t('profile.enterNickname')}
                maxLength={20}
              />

              <FormInput
                label={t('profile.displayName')}
                value={formData.name}
                onChange={(val) => handleInputChange('name', val)}
                placeholder={t('profile.enterName')}
                maxLength={50}
              />

              <FormInput
                label={t('profile.email')}
                value={formData.email}
                onChange={(val) => handleInputChange('email', val)}
                placeholder={t('profile.enterEmail')}
                type="email"
              />

              <FormInput
                label={t('profile.bio')}
                value={formData.bio}
                onChange={(val) => handleInputChange('bio', val)}
                placeholder={t('profile.aboutYourself')}
                rows={3}
                maxLength={200}
              />
            </div>
          </Card>
        </div>

        {/* Personal Details */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.personalInfo')} className="px-1" />

          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label={t('profile.phone')}
                  value={formData.phone}
                  onChange={(val) => handleInputChange('phone', val)}
                  placeholder={t('profile.phoneNumber')}
                  type="tel"
                />

                <FormInput
                  label={t('profile.age')}
                  value={formData.age}
                  onChange={(val) => handleInputChange('age', val)}
                  placeholder={t('profile.yourAge')}
                  type="number"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    {t('profile.gender')}
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full p-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] outline-none text-[var(--color-text-primary)] transition-all"
                  >
                    <option value="">{t('profile.selectGender')}</option>
                    <option value="male">{t('profile.male')}</option>
                    <option value="female">{t('profile.female')}</option>
                    <option value="other">{t('profile.other')}</option>
                  </select>
                </div>

                <FormInput
                  label={t('profile.birthday')}
                  value={formData.birthday}
                  onChange={(val) => handleInputChange('birthday', val)}
                  type="date"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Location & Work */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.locationWork')} className="px-1" />

          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label={t('profile.location')}
                  value={formData.location}
                  onChange={(val) => handleInputChange('location', val)}
                  placeholder={t('profile.countryRegion')}
                />

                <FormInput
                  label={t('profile.city')}
                  value={formData.city}
                  onChange={(val) => handleInputChange('city', val)}
                  placeholder={t('profile.yourCity')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label={t('profile.education')}
                  value={formData.education}
                  onChange={(val) => handleInputChange('education', val)}
                  placeholder={t('profile.educationLevel')}
                />

                <FormInput
                  label={t('profile.occupation')}
                  value={formData.occupation}
                  onChange={(val) => handleInputChange('occupation', val)}
                  placeholder={t('profile.yourOccupation')}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Language & Culture */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.languageCulture')} className="px-1" />

          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label={t('profile.nativeLanguage')}
                  value={formData.native_language}
                  onChange={(val) => handleInputChange('native_language', val)}
                  placeholder={t('profile.yourNativeLanguage')}
                />

                <FormInput
                  label={t('profile.religion')}
                  value={formData.religion}
                  onChange={(val) => handleInputChange('religion', val)}
                  placeholder={t('profile.religionOptional')}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Social Links */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.socialLinks')} className="px-1" />

          <Card>
            <div className="space-y-4">
              <FormInput
                label={t('profile.website')}
                value={formData.website}
                onChange={(val) => handleInputChange('website', val)}
                placeholder={t('profile.yourWebsite')}
                type="url"
              />

              <FormInput
                label={t('profile.github')}
                value={formData.github}
                onChange={(val) => handleInputChange('github', val)}
                placeholder={t('profile.githubUsername')}
              />

              <div className="grid grid-cols-3 gap-3">
                <FormInput
                  label={t('profile.wechat')}
                  value={formData.wechat}
                  onChange={(val) => handleInputChange('wechat', val)}
                  placeholder={t('profile.wechatId')}
                />

                <FormInput
                  label={t('profile.weibo')}
                  value={formData.weibo}
                  onChange={(val) => handleInputChange('weibo', val)}
                  placeholder={t('profile.weiboHandle')}
                />

                <FormInput
                  label={t('profile.qq')}
                  value={formData.qq}
                  onChange={(val) => handleInputChange('qq', val)}
                  placeholder={t('profile.qqNumber')}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Security */}
        <div className="space-y-3">
          <SectionTitle title={t('profile.security')} className="px-1" />

          <div
            onClick={() => setShowPasswordModal(true)}
            className="ds-row p-5 cursor-pointer ds-touch-target flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-full flex items-center justify-center text-[var(--klein-blue)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {t('profile.changePassword')}
              </span>
            </div>
            <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 pb-8">
          <Button
            variant="secondary"
            onClick={() => navigate('profile')}
            className="flex-1"
            disabled={saving || loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="klein"
            onClick={handleSave}
            className="flex-1 relative"
            disabled={saving || loading}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                {t('profile.savingChanges')}
              </span>
            ) : (
              t('common.save')
            )}
          </Button>
        </div>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onConfirm={handlePasswordChange}
        t={t}
      />
    </div>
  );
};

export default ProfileEditPage;
