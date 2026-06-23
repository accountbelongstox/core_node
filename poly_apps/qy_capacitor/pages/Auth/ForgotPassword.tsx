/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState, useContext } from 'react';
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

const ForgotPassword = () => {
  const { t, navigate } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError(t('auth.emailRequired') || 'Email is required');
      return;
    }

    setLoading(true);

    try {
      const response = await ApiCenter.auth.forgotPassword(email);

      if (response.success) {
        setSuccess(true);
        setError('');
      } else {
        setError(response.error?.message || 'Failed to send reset email');
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
          title={t('auth.forgotPassword')}
          subtitle="Enter your email to receive password reset instructions"
        >
          {success ? (
            <AuthSuccess
              title="Check Your Email"
              message={`We've sent password reset instructions to ${email}`}
              actionLabel={`${t('common.back')} to Login`}
              onAction={() => navigate('/login')}
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

              <Button variant="grad" disabled={loading}>
                {loading ? t('common.loading') : 'Send Reset Link'}
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm font-semibold text-[var(--klein-blue)] transition-colors hover:opacity-80"
                >
                  Remember your password? {t('auth.login')}
                </button>
              </div>
            </form>
          )}
        </AuthCard>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
