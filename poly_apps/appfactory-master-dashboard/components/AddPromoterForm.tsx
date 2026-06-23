import React, { useState } from 'react';
import { X, User, Phone, MapPin, Calendar, DollarSign, Image as ImageIcon } from 'lucide-react';
import { modelService } from '../services/modelService';
import { Promoter } from '../types';
import { useApp } from '../contexts/AppContext';
import { generateId } from '../utils/idGenerator';

interface AddPromoterFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Add Promoter Form Component
 */
export const AddPromoterForm: React.FC<AddPromoterFormProps> = ({ onClose, onSuccess }) => {
  const { user, t } = useApp();
  const [formData, setFormData] = useState<Partial<Promoter>>({
    name: '',
    contact: '',
    region: '',
    joinDate: new Date().toISOString().split('T')[0],
    unitPrice: 50,
    paymentAddress: '',
    photo: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newPromoter: Promoter = {
      id: generateId('promoter'),
      name: formData.name!,
      contact: formData.contact!,
      region: formData.region!,
      joinDate: formData.joinDate!,
      photo: formData.photo,
      unitPrice: formData.unitPrice ?? 50,
      totalValidCount: 0,
      totalPrice: 0,
      totalDeduction: 0,
      totalSettlement: 0,
      settledAmount: 0,
      unsettledAmount: 0,
      paymentAddress: formData.paymentAddress,
      packageIds: [],
      approverId: user?.id,
      approverName: user?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    modelService.addPromoter(newPromoter);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('promoterManagement.addPromoter')}</h2>
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
              {t('promoterManagement.promoterName')} <span className="text-rose-500">*</span>
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
              <Phone size={16} className="inline mr-1" />
              {t('promoterManagement.contact')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              required
              placeholder={t('promoterManagement.contactPlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <MapPin size={16} className="inline mr-1" />
              {t('promoterManagement.region')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              required
              placeholder={t('promoterManagement.regionPlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              {t('promoterManagement.joinDate')} <span className="text-rose-500">*</span>
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
              <DollarSign size={16} className="inline mr-1" />
              {t('promoterManagement.unitPrice')}
            </label>
            <input
              type="number"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
              min="0"
              step="0.01"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <ImageIcon size={16} className="inline mr-1" />
              {t('promoterManagement.photoUrl')}
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
              {t('promoterManagement.paymentAddress')}
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
              {t('promoterManagement.addPromoter')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t('promoterManagement.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

