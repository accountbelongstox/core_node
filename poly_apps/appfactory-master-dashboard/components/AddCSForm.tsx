import React, { useState } from 'react';
import { X, User, Phone, Calendar, Award, DollarSign, Image as ImageIcon } from 'lucide-react';
import { modelService } from '../services/modelService';
import { CustomerService, UserRole } from '../types';
import { useApp } from '../contexts/AppContext';
import { generateNickname } from '../utils/nicknameGenerator';
import { generateId } from '../utils/idGenerator';
import { CSLevel } from '../constants/modelConstants';

interface AddCSFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Add Customer Service Form Component
 */
export const AddCSForm: React.FC<AddCSFormProps> = ({ onClose, onSuccess }) => {
  const { user, t } = useApp();
  const [formData, setFormData] = useState<Partial<CustomerService>>({
    name: '',
    email: '',
    contact: '',
    joinDate: new Date().toISOString().split('T')[0],
    level: CSLevel.JUNIOR,
    commissionRate: 10,
    commissionPercentage: 10,
    status: 'Offline',
    paymentAddress: '',
    photo: '',
    nickname: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If nickname is not filled, auto-generate
    const nickname = formData.nickname?.trim() ?? generateNickname();

    const newCS: CustomerService = {
      id: generateId('cs'),
      name: formData.name!,
      email: formData.email!,
      role: UserRole.CS,
      contact: formData.contact!,
      joinDate: formData.joinDate!,
      level: formData.level ?? CSLevel.JUNIOR,
      nickname,
      photo: formData.photo,
      status: formData.status ?? 'Offline',
      totalEarnings: 0,
      assignedAppIds: [],
      commissionRate: formData.commissionRate ?? 10,
      commissionPercentage: formData.commissionPercentage ?? formData.commissionRate ?? 10,
      businessAmount: 0,
      commissionAmount: 0,
      totalPrice: 0,
      totalDeduction: 0,
      totalSettlement: 0,
      settledAmount: 0,
      unsettledAmount: 0,
      paymentAddress: formData.paymentAddress,
      approverId: user?.id,
      approverName: user?.name,
      createdAt: new Date().toISOString(),
      lastLogin: undefined,
    };

    modelService.addCS(newCS);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('csManagement.addCS')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <User size={16} className="inline mr-1" />
              {t('csManagement.csName')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              {t('csManagement.nickname')}
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder={t('csManagement.nicknamePlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('csManagement.nicknameHint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              {t('csManagement.email')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Phone size={16} className="inline mr-1" />
              {t('csManagement.contact')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              required
              placeholder={t('csManagement.contactPlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              {t('csManagement.joinDate')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.joinDate}
              onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Award size={16} className="inline mr-1" />
              {t('csManagement.csLevel')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            >
              <option value={CSLevel.JUNIOR}>{t('csManagement.levelJunior')}</option>
              <option value={CSLevel.INTERMEDIATE}>{t('csManagement.levelIntermediate')}</option>
              <option value={CSLevel.SENIOR}>{t('csManagement.levelSenior')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <DollarSign size={16} className="inline mr-1" />
              {t('csManagement.commissionRate')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.commissionRate}
              onChange={(e) => {
                const rate = Number(e.target.value);
                setFormData({ ...formData, commissionRate: rate, commissionPercentage: rate });
              }}
              required
              min="0"
              max="100"
              step="0.1"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <ImageIcon size={16} className="inline mr-1" />
              {t('csManagement.photoUrl')}
            </label>
            <input
              type="url"
              value={formData.photo}
              onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
              placeholder="https://example.com/photo.jpg"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              {t('csManagement.paymentAddress')}
            </label>
            <input
              type="text"
              value={formData.paymentAddress}
              onChange={(e) => setFormData({ ...formData, paymentAddress: e.target.value })}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('csManagement.addCS')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t('csManagement.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

