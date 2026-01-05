import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckCircle2, XCircle, Clock, Eye, MessageSquare, DollarSign, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { modelService } from '../services/modelService';
import { PaymentVerificationRequest } from '../types';
import { getAvatarUrl } from '../utils/avatarUtils';

export const PaymentVerificationManagement: React.FC = () => {
  const { t, user } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'rejected_no_payment'>('all');
  const [selectedRequest, setSelectedRequest] = useState<PaymentVerificationRequest | null>(null);
  const [replyText, setReplyText] = useState('');

  const requests = useMemo(() => {
    const allRequests = modelService.getPaymentVerificationRequests();
    return allRequests.filter(request => {
      const matchesSearch = request.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ? true :
                           ((request.appName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ? true :
                           (request.username?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false));
      const matchesStatus = filterStatus === 'all' ? true : request.status === filterStatus;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [searchTerm, filterStatus]);

  const handleApprove = (request: PaymentVerificationRequest) => {
    if (!user) return;
    
    const defaultReply = t('paymentVerification.defaultApprovedReply');
    modelService.updatePaymentVerificationRequest(request.id, {
      status: 'verified',
      reply: defaultReply,
      repliedBy: user.id,
      repliedByName: user.name,
      repliedAt: new Date().toISOString(),
    });
    setSelectedRequest(null);
    setReplyText('');
  };

  const handleReject = (request: PaymentVerificationRequest, reason: 'rejected' | 'rejected_no_payment') => {
    if (!user) return;
    
    const defaultReply = reason === 'rejected_no_payment' 
      ? t('paymentVerification.defaultRejectedNoPaymentReply')
      : t('paymentVerification.defaultRejectedReply');
    
    modelService.updatePaymentVerificationRequest(request.id, {
      status: reason,
      reply: replyText ?? defaultReply,
      repliedBy: user.id,
      repliedByName: user.name,
      repliedAt: new Date().toISOString(),
    });
    setSelectedRequest(null);
    setReplyText('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 size={16} className="text-emerald-600" />;
      case 'rejected':
      case 'rejected_no_payment':
        return <XCircle size={16} className="text-rose-600" />;
      case 'pending':
        return <Clock size={16} className="text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t('paymentVerification.pending'),
      verified: t('paymentVerification.verified'),
      rejected: t('paymentVerification.rejected'),
      rejected_no_payment: t('paymentVerification.rejectedNoPayment'),
    };
    return statusMap[status] ?? status;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const verified = requests.filter(r => r.status === 'verified').length;
    const rejected = requests.filter(r => r.status === 'rejected' ? true : r.status === 'rejected_no_payment').length;
    return { total, pending, verified, rejected };
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('paymentVerification.management')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('paymentVerification.managementDesc')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.totalRequests')}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.pending')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.verified')}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.verified}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.rejected')}</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('paymentVerification.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-slate-800 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'verified', 'rejected', 'rejected_no_payment'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {status === 'all' ? t('chat.all') : getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('paymentVerification.customer')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('paymentVerification.app')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('paymentVerification.amount')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('paymentVerification.username')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('paymentVerification.status')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('paymentVerification.createdAt')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {requests.map(request => (
                <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {request.customerAvatar && (
                        <img
                          src={getAvatarUrl(request.customerAvatar, 150, 'pravatar')}
                          alt={request.customerName}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-medium text-slate-800 dark:text-white">{request.customerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {request.appName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {request.appName.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{request.appName}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-800 dark:text-white">¥{request.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{request.username ?? '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(request.status)}
                      <span className="text-sm text-slate-600 dark:text-slate-400">{getStatusLabel(request.status)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{formatTime(request.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <Eye size={14} />
                      {t('paymentVerification.review')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t('paymentVerification.reviewRequest')}</h3>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setReplyText('');
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.customer')}</p>
                  <p className="font-medium text-slate-800 dark:text-white">{selectedRequest.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.app')}</p>
                  <p className="font-medium text-slate-800 dark:text-white">{selectedRequest.appName ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.amount')}</p>
                  <p className="font-medium text-slate-800 dark:text-white">¥{selectedRequest.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('paymentVerification.username')}</p>
                  <p className="font-medium text-slate-800 dark:text-white">{selectedRequest.username ?? '-'}</p>
                </div>
              </div>

              {/* Screenshot */}
              {selectedRequest.screenshot && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('paymentVerification.screenshot')}</p>
                  <img
                    src={selectedRequest.screenshot}
                    alt="Screenshot"
                    className="w-full max-h-64 object-contain rounded-lg border border-slate-200 dark:border-slate-600"
                  />
                </div>
              )}

              {/* Reply */}
              {selectedRequest.status === 'pending' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('paymentVerification.reply')}
                  </label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('paymentVerification.replyPlaceholder')}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white resize-none"
                    rows={3}
                  />
                </div>
              )}

              {/* Existing Reply */}
              {selectedRequest.reply && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('paymentVerification.reply')}</p>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p className="text-sm text-slate-800 dark:text-white">{selectedRequest.reply}</p>
                    {selectedRequest.repliedByName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {selectedRequest.repliedByName} - {selectedRequest.repliedAt ? formatTime(selectedRequest.repliedAt) : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedRequest.status === 'pending' && (
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleApprove(selectedRequest)}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    {t('paymentVerification.approve')}
                  </button>
                  <button
                    onClick={() => handleReject(selectedRequest, 'rejected_no_payment')}
                    className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} />
                    {t('paymentVerification.rejectNoPayment')}
                  </button>
                  <button
                    onClick={() => handleReject(selectedRequest, 'rejected')}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                  >
                    {t('paymentVerification.reject')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

