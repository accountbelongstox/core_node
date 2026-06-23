/* [v4.1-Iris] Reset Password — ported from
 * poly_apps/qy_capacitor/pages/Auth/ResetPassword.tsx. Self-contained: reads the
 * token/email from the URL, posts to the wordflow backend via
 * wordflowApi.request, react-router useNavigate/useSearchParams + wfPath().
 * Graceful error/success states, faithful Iris auth look. */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useWfT } from '../WfAppContext';
import { Button, Icons } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

const WfAuthResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');
    if (tokenParam) setToken(tokenParam);
    if (emailParam) setEmail(emailParam);
    if (!tokenParam) setError('Invalid or missing reset token');
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
      await wordflowApi.request('/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          token,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      setSuccess(true);
      setTimeout(() => navigate(wfPath('auth/login')), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full p-4 rounded-[var(--radius-button)] ds-glass ds-glass-edge border border-[var(--border-highlight)] outline-none text-[var(--color-text-primary)] transition-all disabled:opacity-50 focus:shadow-[0_0_0_3px_var(--klein-ring)]';

  return (
    <div
      className="flex flex-col min-h-screen bg-transparent route-fade"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-[var(--page-padding-h)] py-[var(--page-padding-v)] pt-16 animate-fade-in">
        <div className="w-full sm:max-w-sm sm:mx-auto">
          <div className="mb-6 -ml-2">
            <button
              type="button"
              onClick={() => navigate(wfPath('auth/login'))}
              aria-label={t('common.back')}
              className="ds-touch-target inline-flex items-center justify-center rounded-full p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--klein-blue-soft)] transition-colors"
            >
              <Icons.Back />
            </button>
          </div>

          <div className="ds-modal-panel p-8">
            <div className="text-center mb-10">
              <h1 className="ds-section-title !text-3xl mb-2">Reset Password</h1>
              <p className="ds-section-sub">Enter your new password below</p>
            </div>

            {success ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-emerald-500/10 text-emerald-500">
                  <Icons.Check />
                </div>
                <h2 className="ds-section-title !text-xl mb-2">Password Reset Successful!</h2>
                <p className="text-[var(--color-text-secondary)] mb-8">Redirecting to login page...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-7">
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 p-4 rounded-[var(--radius-button)] bg-red-500/10 border border-red-500/20 text-sm text-red-500"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-px" aria-hidden />
                    <span className="font-medium leading-snug">{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    {t('auth.email')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    disabled={loading}
                    autoComplete="email"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={loading}
                    autoComplete="new-password"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    {t('auth.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={loading}
                    autoComplete="new-password"
                    required
                    className={inputClass}
                  />
                </div>

                <Button variant="grad" disabled={loading}>
                  {loading ? t('common.loading') : 'Reset Password'}
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(wfPath('auth/login'))}
                    className="text-sm font-semibold text-[var(--klein-blue)] transition-colors hover:opacity-80"
                  >
                    {t('common.back')} to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WfAuthResetPasswordPage;
