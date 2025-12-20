import React, { useState, useEffect } from 'react';
import { X, Edit2, Trash2, User, Phone, Calendar, Award, DollarSign, Image as ImageIcon, Save } from 'lucide-react';
import { modelService } from '../services/modelService';
import { CustomerService } from '../types';
import { useApp } from '../contexts/AppContext';

interface CSDetailModalProps {
  cs: CustomerService;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

/**
 * 客服详情和编辑弹窗组件
 */
export const CSDetailModal: React.FC<CSDetailModalProps> = ({ cs, onClose, onUpdate, onDelete }) => {
  const { user } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<CustomerService>>(cs);

  useEffect(() => {
    setFormData(cs);
  }, [cs]);

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.contact) {
      alert('请填写必填字段');
      return;
    }

    modelService.updateCS(cs.id, formData);
    setIsEditing(false);
    onUpdate();
  };

  const handleDelete = () => {
    if (window.confirm(`确定要删除客服 "${cs.name}" 吗？此操作不可恢复。`)) {
      modelService.deleteCS(cs.id);
      onDelete();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {isEditing ? '编辑客服' : '客服详情'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    <User size={16} className="inline mr-1" />
                    客服姓名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    昵称
                  </label>
                  <input
                    type="text"
                    value={formData.nickname || ''}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="如：小雨"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    邮箱 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    <Phone size={16} className="inline mr-1" />
                    联系方式 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contact || ''}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    加盟时间 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.joinDate || ''}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    <Award size={16} className="inline mr-1" />
                    客服级别 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.level || '初级'}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  >
                    <option value="初级">初级</option>
                    <option value="中级">中级</option>
                    <option value="高级">高级</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    <DollarSign size={16} className="inline mr-1" />
                    提成%比 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.commissionRate || 10}
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
                    照片URL（可选）
                  </label>
                  <input
                    type="url"
                    value={formData.photo || ''}
                    onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    收款地址（加密货币地址，可选）
                  </label>
                  <input
                    type="text"
                    value={formData.paymentAddress || ''}
                    onChange={(e) => setFormData({ ...formData, paymentAddress: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(cs);
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-6">
                {cs.photo ? (
                  <img
                    src={cs.photo}
                    alt={cs.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-slate-200 dark:border-slate-600"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-3xl">
                    {cs.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{cs.name}</h3>
                    {cs.nickname && (
                      <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-bold">
                        {cs.nickname}
                      </span>
                    )}
                    {cs.level && (
                      <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-bold">
                        {cs.level}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${
                      cs.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                    <span>{cs.status === 'Online' ? '在线' : '离线'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">邮箱</p>
                    <p className="text-sm text-slate-800 dark:text-white">{cs.email}</p>
                  </div>
                  {cs.contact && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">联系方式</p>
                      <p className="text-sm text-slate-800 dark:text-white">{cs.contact}</p>
                    </div>
                  )}
                  {cs.joinDate && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">加盟时间</p>
                      <p className="text-sm text-slate-800 dark:text-white">{cs.joinDate}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">业务金额</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">¥{cs.businessAmount?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">提成金额</p>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">¥{cs.commissionAmount?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">提成%比</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{cs.commissionPercentage || cs.commissionRate}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">总价</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">¥{cs.totalPrice?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">总扣单</p>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400">¥{cs.totalDeduction?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">总结算价</p>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">¥{cs.totalSettlement?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">已结算</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">¥{cs.settledAmount?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">未结算</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">¥{cs.unsettledAmount?.toLocaleString() || 0}</p>
                </div>
                {cs.approverName && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">审批人</p>
                    <p className="text-sm text-slate-800 dark:text-white">{cs.approverName}</p>
                  </div>
                )}
              </div>

              {cs.paymentAddress && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">收款地址</p>
                  <code className="block text-sm text-slate-600 dark:text-slate-400 font-mono break-all bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                    {cs.paymentAddress}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

