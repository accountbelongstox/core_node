/* [v4.1-Iris] Forgot Password — ported from
 * poly_apps/qy_capacitor/pages/Auth/ForgotPassword.tsx. Self-contained: posts to
 * the wordflow backend via wordflowApi.request, react-router useNavigate +
 * wfPath() for nav. Graceful error/success states, faithful Iris auth look. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useWfT } from '../WfAppContext';
import { Button, Icons } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

const WfAuthForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();

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
      await wordflowApi.request('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset email');
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
              <h1 className="ds-section-title !text-3xl mb-2">{t('auth.forgotPassword')}</h1>
              <p className="ds-section-sub">
                Enter your email to receive password reset instructions
              </p>
            </div>

            {success ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-emerald-500/10 text-emerald-500">
                  <Icons.Check />
                </div>
                <h2 className="ds-section-title !text-xl mb-2">Check Your Email</h2>
                <p className="text-[var(--color-text-secondary)] mb-8">
                  We've sent password reset instructions to {email}
                </p>
                <Button variant="grad" onClick={() => navigate(wfPath('auth/login'))}>
                  {t('common.back')} to Login
                </Button>
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

                <Button variant="grad" disabled={loading}>
                  {loading ? t('common.loading') : 'Send Reset Link'}
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(wfPath('auth/login'))}
                    className="text-sm font-semibold text-[var(--klein-blue)] transition-colors hover:opacity-80"
                  >
                    Remember your password? {t('auth.login')}
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

export default WfAuthForgotPasswordPage;
