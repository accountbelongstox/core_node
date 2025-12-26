import React, { useState, useRef } from 'react';
import { Upload, X, DollarSign, CheckCircle2, XCircle, Clock, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { modelService } from '../services/modelService';
import { PaymentVerificationRequest as PaymentVerificationRequestType } from '../types';

interface PaymentVerificationRequestProps {
  sessionId?: string;
  customerId?: string;
  customerName?: string;
  appId?: string;
  appName?: string;
  onSubmitted?: () => void;
}

const PRESET_AMOUNTS = [39.88, 198, 698, 1788, 3888];

export const PaymentVerificationRequest: React.FC<PaymentVerificationRequestProps> = ({
  sessionId,
  customerId,
  customerName,
  appId,
  appName,
  onSubmitted,
}) => {
  const { t, user } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [customAmount, setCustomAmount] = useState('');
  const [username, setUsername] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAmountSelect = (presetAmount: number) => {
    setAmount(presetAmount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setAmount('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!amount && !customAmount) {
      alert(t('paymentVerification.pleaseSelectAmount'));
      return;
    }

    const finalAmount = amount || parseFloat(customAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert(t('paymentVerification.invalidAmount'));
      return;
    }

    if (!username && !screenshot) {
      alert(t('paymentVerification.pleaseProvideInfo'));
      return;
    }

    setIsSubmitting(true);

    try {
      // In real app, upload screenshot to server and get URL
      const screenshotUrl = screenshot || undefined;

      const request: PaymentVerificationRequestType = {
        id: `pvr_${Date.now()}`,
        sessionId,
        customerId: customerId || user?.id || 'customer',
        customerName: customerName || user?.name || 'Customer',
        customerAvatar: user?.avatar,
        appId,
        appName,
        amount: finalAmount,
        username: username || undefined,
        screenshot: screenshotUrl,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      modelService.addPaymentVerificationRequest(request);

      // Reset form
      setAmount('');
      setCustomAmount('');
      setUsername('');
      setScreenshot(null);
      setScreenshotFile(null);
      setShowForm(false);

      if (onSubmitted) {
        onSubmitted();
      }

      alert(t('paymentVerification.submitted'));
    } catch (error) {
      console.error('Failed to submit payment verification request:', error);
      alert(t('paymentVerification.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
      >
        <DollarSign size={16} />
        {t('paymentVerification.requestVerification')}
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
          {t('paymentVerification.title')}
        </h3>
        <button
          onClick={() => {
            setShowForm(false);
            setAmount('');
            setCustomAmount('');
            setUsername('');
            setScreenshot(null);
            setScreenshotFile(null);
          }}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-500 dark:text-slate-400" />
        </button>
      </div>

      {/* Amount Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('paymentVerification.amount')} <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-5 gap-2 mb-2">
          {PRESET_AMOUNTS.map((presetAmount) => (
            <button
              key={presetAmount}
              onClick={() => handleAmountSelect(presetAmount)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                amount === presetAmount
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              ¥{presetAmount}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <input
            type="number"
            value={customAmount}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            placeholder={t('paymentVerification.customAmount')}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('paymentVerification.username')}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('paymentVerification.usernamePlaceholder')}
          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
        />
      </div>

      {/* Screenshot Upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('paymentVerification.screenshot')}
        </label>
        {screenshot ? (
          <div className="relative">
            <img
              src={screenshot}
              alt="Screenshot"
              className="w-full max-h-64 object-contain rounded-lg border border-slate-200 dark:border-slate-600"
            />
            <button
              onClick={handleRemoveScreenshot}
              className="absolute top-2 right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
          >
            <ImageIcon size={32} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('paymentVerification.clickToUpload')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSubmitting ? t('common.loading') : t('paymentVerification.submit')}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

