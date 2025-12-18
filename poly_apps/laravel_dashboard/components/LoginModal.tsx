
import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, User, ArrowRight, Loader2, AlertTriangle, Mail, UserPlus, Key } from "lucide-react";
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
import { useUser } from '../hooks/useUser';
import { api } from '../core/api';
import { InviteCode } from '../core/api/modules/InviteCodeAPI';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang: Language;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess, lang }) => {
  const { login, register, loading, error: userError, clearError } = useUser();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    nickname: '',
    registrationCode: ''
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [availableCodes, setAvailableCodes] = useState<InviteCode[]>([]);

  const t = TRANSLATIONS[lang].login;
  const error = localError || userError;

  // Fetch available invite codes when in register mode
  useEffect(() => {
    if (isRegisterMode && isOpen) {
      api.inviteCode.listPublic()
        .then(codes => {
          if (codes && Array.isArray(codes)) {
            setAvailableCodes(codes.filter(c => c.is_active && c.used_count < c.max_uses));
          }
        })
        .catch(err => {
          console.warn('Failed to fetch invite codes:', err);
          setAvailableCodes([]);
        });
    }
  }, [isRegisterMode, isOpen]);

  if (!isOpen) return null;

  const maskCode = (code: string): string => {
    if (code.length <= 8) return code;
    return `${code.slice(0, 4)}...${code.slice(-4)}`;
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (error) {
      setLocalError(null);
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!formData.username || !formData.password) {
      setLocalError('Username and password are required');
      return;
    }

    if (isRegisterMode && formData.password !== formData.confirmPassword) {
      setLocalError(lang === 'zh' ? '两次密码输入不一致' : 'Passwords do not match');
      return;
    }

    let success = false;

    if (isRegisterMode) {
      success = await register(
        formData.username,
        formData.password,
        formData.email || undefined,
        formData.nickname || undefined,
        formData.registrationCode || undefined
      );
    } else {
      success = await login(formData.username, formData.password);
    }

    if (success) {
      setFormData({
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        nickname: '',
        registrationCode: ''
      });
      onSuccess();
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(prev => !prev);
    setLocalError(null);
    clearError();
  };

  const title = isRegisterMode ? t.register_title : t.title;
  const subtitle = isRegisterMode ? t.register_subtitle : t.subtitle;
  const submitText = isRegisterMode ? t.register_submit : t.submit;
  const processingText = isRegisterMode ? t.register_processing : t.processing;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-[float_6s_ease-in-out_infinite]">

        <div className="h-1 w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-75"></div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mb-4">
              {isRegisterMode ? <UserPlus className="text-white" size={32} /> : <ShieldCheck className="text-white" size={32} />}
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center tracking-tight">
              {title}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center mt-2">
              {subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1">
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange('username')}
                  placeholder={t.username}
                  className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  placeholder={t.password}
                  className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Confirm Password - Register only */}
            {isRegisterMode && (
              <div className="space-y-1">
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange('confirmPassword')}
                    placeholder={t.confirm_password}
                    className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Register-only fields */}
            {isRegisterMode && (
              <>
                {/* Email */}
                <div className="space-y-1">
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange('email')}
                      placeholder={t.email}
                      className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Nickname */}
                <div className="space-y-1">
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={handleInputChange('nickname')}
                      placeholder={t.nickname}
                      className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Registration Code */}
                <div className="space-y-1">
                  <div className="relative group">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type="text"
                      value={formData.registrationCode}
                      onChange={handleInputChange('registrationCode')}
                      placeholder={t.registration_code}
                      className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                  {/* Available Codes Hint */}
                  {availableCodes.length > 0 && (
                    <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/30 rounded-lg">
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mb-1 font-medium">
                        {lang === 'zh' ? '可用邀请码:' : 'Available Codes:'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {availableCodes.slice(0, 3).map(code => (
                          <button
                            key={code.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, registrationCode: code.code }))}
                            className="px-2 py-1 text-[10px] font-mono bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                          >
                            {maskCode(code.code)}
                          </button>
                        ))}
                        {availableCodes.length > 3 && (
                          <span className="px-2 py-1 text-[10px] text-indigo-500 dark:text-indigo-400">
                            +{availableCodes.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
                <AlertTriangle size={12} />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {processingText}
                </>
              ) : (
                <>
                  {submitText}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Mode Toggle */}
          <div className="mt-6 text-center space-y-2">
            <button
              onClick={toggleMode}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors font-medium"
            >
              {isRegisterMode ? t.switch_to_login : t.switch_to_register}
            </button>

            <div>
              <button
                onClick={onClose}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
