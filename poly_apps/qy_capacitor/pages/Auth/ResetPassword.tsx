import React, { useState, useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { ApiCenter } from '../../services/ApiCenter';
import {
  AuthLayout,
  AuthCard,
  AuthInput,
  AuthError,
  AuthSuccess,
  AuthBackButton,
} from '../../components/Auth';

const ResetPassword = () => {
  const { t, navigate } = useContext(AppContext);
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    if (tokenParam) setToken(tokenParam);
    if (emailParam) setEmail(emailParam);

    if (!tokenParam) {
      setError('Invalid or missing reset token');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !passwordConfirmation) {
      setError('All fields are required');
      return;
    }

    if (password !== passwordConfirmation) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setLoading(true);

    try {
      const response = await ApiCenter.auth.resetPassword(
        email,
        token,
        password,
        passwordConfirmation
      );

      if (response.success) {
        setSuccess(true);
        setError('');

        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(response.error?.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout showHeader={false}>
      <div className="w-full sm:max-w-sm sm:mx-auto">
        <AuthBackButton to="/login" />

        <AuthCard
          title="Reset Password"
          subtitle="Enter your new password below"
        >
          {success ? (
            <AuthSuccess
              title="Password Reset Successful!"
              message="Redirecting to login page..."
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <AuthError message={error} className="p-4" />

              <AuthInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                disabled={loading}
                autoComplete="email"
                label={t('auth.email')}
                required
              />

              <AuthInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={loading}
                autoComplete="new-password"
                label="New Password"
                required
              />

              <AuthInput
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
                autoComplete="new-password"
                label={t('auth.confirmPassword')}
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? t('common.loading') : 'Reset Password'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {t('common.back')} to Login
                </button>
              </div>
            </form>
          )}
        </AuthCard>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
