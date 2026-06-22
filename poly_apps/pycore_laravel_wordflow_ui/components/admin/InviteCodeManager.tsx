import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { InviteCode, CreateInviteCodeRequest } from '../../core/api/modules/InviteCodeAPI';
import { useUserRole } from '../../hooks/useUserRole';
import { Plus, Key, AlertCircle, CheckCircle, XCircle, Users, Calendar, Trash2 } from 'lucide-react';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';

interface InviteCodeManagerProps {
  lang?: 'en' | 'zh';
}

const InviteCodeManager: React.FC<InviteCodeManagerProps> = ({ lang = 'en' }) => {
  const { canManageInviteCodes } = useUserRole();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [createForm, setCreateForm] = useState<CreateInviteCodeRequest>({
    type: 'user',
    max_uses: 1,
    expires_at: undefined,
    description: ''
  });

  const translations = {
    en: {
      title: 'Invite Code Management',
      create: 'Create Code',
      code: 'Code',
      type: 'Type',
      maxUses: 'Max Uses',
      usedCount: 'Used',
      expiresAt: 'Expires',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      actions: 'Actions',
      deactivate: 'Deactivate',
      loading: 'Loading...',
      noAccess: 'You do not have permission to manage invite codes',
      createTitle: 'Create New Invite Code',
      roleType: 'Role Type',
      maxUsesLabel: 'Maximum Uses',
      expirationDate: 'Expiration Date (Optional)',
      descriptionLabel: 'Description (Optional)',
      cancel: 'Cancel',
      save: 'Create Code',
      user: 'User',
      moderator: 'Moderator',
      admin: 'Administrator',
      superAdmin: 'Super Administrator',
      never: 'Never',
      description: 'Description'
    },
    zh: {
      title: '邀请码管理',
      create: '创建邀请码',
      code: '邀请码',
      type: '类型',
      maxUses: '最大使用次数',
      usedCount: '已使用',
      expiresAt: '过期时间',
      status: '状态',
      active: '有效',
      inactive: '无效',
      actions: '操作',
      deactivate: '停用',
      loading: '加载中...',
      noAccess: '您没有权限管理邀请码',
      createTitle: '创建新邀请码',
      roleType: '角色类型',
      maxUsesLabel: '最大使用次数',
      expirationDate: '过期时间（可选）',
      descriptionLabel: '描述（可选）',
      cancel: '取消',
      save: '创建邀请码',
      user: '普通用户',
      moderator: '版主',
      admin: '管理员',
      superAdmin: '超级管理员',
      never: '永不过期',
      description: '描述'
    }
  };

  const t = translations[lang];

  useEffect(() => {
    if (canManageInviteCodes) {
      loadCodes();
    }
  }, [canManageInviteCodes]);

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.inviteCode.list();
      setCodes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invite codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.inviteCode.create(createForm);
      setShowCreateModal(false);
      setCreateForm({
        type: 'user',
        max_uses: 1,
        expires_at: undefined,
        description: ''
      });
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to create invite code');
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this invite code?')) {
      return;
    }

    try {
      await api.inviteCode.deactivate(id);
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate invite code');
    }
  };

  const getRoleTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      user: t.user,
      moderator: t.moderator,
      admin: t.admin,
      super_admin: t.superAdmin
    };
    return typeMap[type] || type;
  };

  if (!canManageInviteCodes) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
        <p className="text-slate-600 dark:text-slate-400">{t.noAccess}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-600 dark:text-slate-400">{t.loading}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Key size={28} />
          {t.title}
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          {t.create}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.code}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.type}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.maxUses}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.usedCount}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.expiresAt}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.status}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {codes.map((code) => (
              <tr key={code.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{code.code}</td>
                <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{getRoleTypeLabel(code.type)}</td>
                <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{code.max_uses}</td>
                <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{code.used_count}</td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                  {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : t.never}
                </td>
                <td className="px-6 py-4">
                  {code.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                      <CheckCircle size={12} />
                      {t.active}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                      <XCircle size={12} />
                      {t.inactive}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {code.is_active && (
                    <button
                      onClick={() => handleDeactivate(code.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
          <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{t.createTitle}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.roleType}
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="user">{t.user}</option>
                  <option value="moderator">{t.moderator}</option>
                  <option value="admin">{t.admin}</option>
                  <option value="super_admin">{t.superAdmin}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.maxUsesLabel}
                </label>
                <input
                  type="number"
                  min="1"
                  value={createForm.max_uses}
                  onChange={(e) => setCreateForm({ ...createForm, max_uses: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.expirationDate}
                </label>
                <input
                  type="datetime-local"
                  value={createForm.expires_at || ''}
                  onChange={(e) => setCreateForm({ ...createForm, expires_at: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.descriptionLabel}
                </label>
                <textarea
                  value={createForm.description || ''}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

export default InviteCodeManager;
