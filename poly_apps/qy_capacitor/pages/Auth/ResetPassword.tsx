/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState, useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { ApiCenter } from '../../services/ApiCenter';
import { Button } from '../../components/UI';
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
            <form onSubmit={handleSubmit} className="space-y-7">
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

              <Button variant="grad" disabled={loading}>
                {loading ? t('common.loading') : 'Reset Password'}
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm font-semibold text-[var(--klein-blue)] transition-colors hover:opacity-80"
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
