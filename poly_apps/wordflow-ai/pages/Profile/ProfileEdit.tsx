import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

/**
 * Profile Edit Page
 * Full editing interface for user profile
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
    if (newPassword.length < 6) {
      setError(t('profile.passwordTooShort'));
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
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

// Confirmation Dialog Component
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText: string;
  cancelText: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelText}
          </Button>
          <Button onClick={onConfirm} className="flex-1">
            {confirmText}
          </Button>
        </div>
      </div>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

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

    // Upload avatar immediately
    setLoading(true);
    setError('');

    const avatarResponse = await ApiCenter.user.updateAvatar(file);

    if (avatarResponse.success && avatarResponse.data?.avatar_url) {
      const updatedUser = { ...user, avatar_url: avatarResponse.data.avatar_url };
      setUser(updatedUser as any);
      setAvatarPreview(avatarResponse.data.avatar_url);
      setSuccess(t('profile.avatarUploadedSuccess'));
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(avatarResponse.error?.message || t('profile.uploadFailed'));
      setAvatarPreview(user?.avatar_url || user?.avatar || '');
      setTimeout(() => setError(''), 3000);
    }

    setLoading(false);
  };

  const handleEmailBlur = (value: string) => {
    if (value !== user?.email) {
      setPendingEmail(value);
      setShowEmailConfirm(true);
    }
  };

  const confirmEmailChange = () => {
    handleInputChange('email', pendingEmail);
    setShowEmailConfirm(false);
  };

  const cancelEmailChange = () => {
    handleInputChange('email', user?.email || '');
    setShowEmailConfirm(false);
    setPendingEmail('');
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
    setLoading(true);
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
    }

    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col animate-slide-up">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('profile')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-2xl font-bold dark:text-white">{t('profile.editProfile')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-800 shadow-xl object-cover"
            />
            <button
              onClick={handleAvatarClick}
              disabled={loading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              <Icons.Settings className="text-white w-8 h-8" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">{t('profile.clickToChange')}</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl animate-fade-in">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl animate-fade-in">
            {success}
          </div>
        )}
        {loading && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl animate-fade-in">
            {t('profile.processing')}
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('profile.basicInfo')}</h2>

            <div className="space-y-4">
              {/* Username (readonly) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.usernameReadonly')}
                </label>
                <input
                  type="text"
                  value={user?.username}
                  readOnly
                  disabled
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 outline-none dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              {/* Nickname */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.nickname')}
                </label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => handleInputChange('nickname', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.enterNickname')}
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.displayName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.enterName')}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.emailModifyConfirm')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onBlur={(e) => handleEmailBlur(e.target.value)}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.enterEmail')}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.bio')}
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white resize-none"
                  placeholder={t('profile.aboutYourself')}
                />
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('profile.personalInfo')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.phone')}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.phoneNumber')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.age')}
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.yourAge')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.gender')}
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                >
                  <option value="">{t('profile.selectGender')}</option>
                  <option value="male">{t('profile.male')}</option>
                  <option value="female">{t('profile.female')}</option>
                  <option value="other">{t('profile.other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.birthday')}
                </label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => handleInputChange('birthday', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Location & Work */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('profile.locationWork')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.location')}
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.countryRegion')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.city')}
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.yourCity')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.education')}
                </label>
                <input
                  type="text"
                  value={formData.education}
                  onChange={(e) => handleInputChange('education', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.educationLevel')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.occupation')}
                </label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.yourOccupation')}
                />
              </div>
            </div>
          </div>

          {/* Language & Culture */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('profile.languageCulture')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.nativeLanguage')}
                </label>
                <input
                  type="text"
                  value={formData.native_language}
                  onChange={(e) => handleInputChange('native_language', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.yourNativeLanguage')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.religion')}
                </label>
                <input
                  type="text"
                  value={formData.religion}
                  onChange={(e) => handleInputChange('religion', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.religionOptional')}
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('profile.socialLinks')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.website')}
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.yourWebsite')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('profile.github')}
                </label>
                <input
                  type="text"
                  value={formData.github}
                  onChange={(e) => handleInputChange('github', e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                  placeholder={t('profile.githubUsername')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('profile.wechat')}
                  </label>
                  <input
                    type="text"
                    value={formData.wechat}
                    onChange={(e) => handleInputChange('wechat', e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                    placeholder={t('profile.wechatId')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('profile.weibo')}
                  </label>
                  <input
                    type="text"
                    value={formData.weibo}
                    onChange={(e) => handleInputChange('weibo', e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                    placeholder={t('profile.weiboHandle')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('profile.qq')}
                  </label>
                  <input
                    type="text"
                    value={formData.qq}
                    onChange={(e) => handleInputChange('qq', e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-blue-400 outline-none dark:text-white"
                    placeholder={t('profile.qqNumber')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('profile.security')}</h2>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-colors flex items-center justify-between group"
            >
              <span className="text-slate-700 dark:text-slate-300 font-medium">{t('profile.changePassword')}</span>
              <Icons.ChevronRight className="text-slate-400 group-hover:text-blue-400 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 border-t border-slate-200 dark:border-slate-700 z-40">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('profile')}
            className="flex-1"
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            {loading ? t('profile.savingChanges') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Email Change Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showEmailConfirm}
        title={t('profile.emailChangeConfirmTitle')}
        message={t('profile.emailChangeConfirmMessage')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={confirmEmailChange}
        onCancel={cancelEmailChange}
      />

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
