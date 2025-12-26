import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl sm:max-w-2xl md:max-w-4xl lg:max-w-5xl w-full p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-white">{t('profile.changePassword')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.currentPassword')}
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
              placeholder={t('profile.enterCurrentPassword')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.newPassword')}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
              placeholder={t('profile.enterNewPassword')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.confirmNewPassword')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
              placeholder={t('profile.confirmPassword')}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
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
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {maxLength && (
          <span className="text-xs text-slate-400">
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
          className={`w-full p-3 rounded-xl border transition-all resize-none ${
            disabled
              ? 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 cursor-not-allowed text-slate-400'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white'
          } outline-none`}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          disabled={disabled}
          className={`w-full p-3 rounded-xl border transition-all ${
            disabled
              ? 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 cursor-not-allowed text-slate-400'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white'
          } outline-none`}
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

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload avatar with progress
    setLoading(true);
    setError('');
    setUploadProgress(10);

    // Simulate progress (since we don't have real progress from API)
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    const avatarResponse = await ApiCenter.user.updateAvatar(file);
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('profile')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('profile.editProfile')}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Update your profile information
        </p>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-6">
        {/* Avatar Upload Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none shadow-xl">
          <div className="flex flex-col items-center">
            <div className="relative group mb-4">
              <div className="w-28 h-28 rounded-full border-4 border-white/30 overflow-hidden">
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={handleAvatarClick}
                disabled={loading}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <Icons.Edit className="w-6 h-6 text-white mb-1" />
                <span className="text-xs text-white">Upload</span>
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
                  <span className="text-sm text-blue-100">Uploading...</span>
                  <span className="text-sm text-blue-100">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {!loading && (
              <p className="text-sm text-blue-100 text-center">
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
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('profile.basicInfo')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('profile.personalInfo')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('profile.gender')}
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none dark:text-white"
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
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('profile.locationWork')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('profile.languageCulture')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('profile.socialLinks')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('profile.security')}
          </h2>

          <Card
            onClick={() => setShowPasswordModal(true)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {t('profile.changePassword')}
                </span>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>
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
            onClick={handleSave}
            className="flex-1 relative"
            disabled={saving || loading}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
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
