import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, Search, Filter, Eye, Clock, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { modelService } from '../services/modelService';
import { ChatWindow } from './ChatWindow';
import { ChatSession, ChatMessage } from '../types';
import { getAvatarUrl } from '../utils/avatarUtils';
import { useInterval } from '../hooks/useInterval';

export const AdminChatManagement: React.FC = () => {
  const { t } = useApp();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'waiting' | 'closed'>('all');
  const [filterCS, setFilterCS] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'realtime' | 'history'>('realtime');

  const sessions = useMemo(() => {
    const allSessions = modelService.getChatSessions();
    const apps = modelService.getApps();
    
    // Enrich sessions with full app information
    const enrichedSessions = allSessions.map(session => {
      if (session.appId) {
        const app = apps.find(a => a.id === session.appId);
        if (app && !session.appName) {
          return { ...session, appName: app.name };
        }
      }
      return session;
    });
    
    return enrichedSessions.filter(session => {
      const matchesSearch = session.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ? true :
                           ((session.csName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ? true :
                           ((session.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ? true :
                           (session.appName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)));
      const matchesStatus = filterStatus === 'all' ? true : session.status === filterStatus;
      const matchesCS = filterCS === 'all' ? true : (session.csId === filterCS ? true : (!session.csId && filterCS === 'unassigned'));
      return matchesSearch && matchesStatus && matchesCS;
    }).sort((a, b) => {
      const timeA = new Date(a.lastMessageTime ?? a.updatedAt).getTime();
      const timeB = new Date(b.lastMessageTime ?? b.updatedAt).getTime();
      return timeB - timeA;
    });
  }, [searchTerm, filterStatus, filterCS]);

  const csTeam = useMemo(() => modelService.getCSTeam(), []);

  // Use React Hook instead of manual setInterval
  useInterval(() => {
    // Trigger re-render by updating a dummy state
    if (viewMode === 'realtime') {
      setSearchTerm(prev => prev);
    }
  }, viewMode === 'realtime' ? 3000 : null);

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    modelService.markSessionMessagesAsRead(sessionId);
  };

  const handleSendMessage = (content: string) => {
    if (!selectedSessionId) return;

    const session = modelService.getChatSessions()?.find(s => s.id === selectedSessionId);
    if (!session) return;

    // Admin can send messages as the assigned CS or as admin
    const senderId = session.csId ?? 'admin';
    const senderName = session.csName ?? 'Admin';

    const newMessage = {
      id: `msg_${Date.now()}`,
      sessionId: selectedSessionId,
      senderId,
      senderName,
      senderType: 'cs' as const,
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
      createdAt: new Date().toISOString(),
    };

    modelService.addChatMessage(newMessage);
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return t('chat.justNow');
    if (minutes < 60) return `${minutes}${t('chat.minutesAgo')}`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}${t('chat.hoursAgo')}`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 size={12} className="text-emerald-600" />;
      case 'waiting':
        return <Clock size={12} className="text-amber-600" />;
      case 'closed':
        return <AlertCircle size={12} className="text-slate-400" />;
      default:
        return null;
    }
  };

  const getSessionStats = () => {
    const total = sessions.length;
    const active = sessions.filter(s => s.status === 'active').length;
    const waiting = sessions.filter(s => s.status === 'waiting').length;
    const closed = sessions.filter(s => s.status === 'closed').length;
    return { total, active, waiting, closed };
  };

  const stats = getSessionStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('chat.chatManagement')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('chat.viewAllChats')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('realtime')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'realtime'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {t('chat.realtime')}
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'history'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {t('chat.history')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('chat.totalSessions')}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('chat.active')}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('chat.waiting')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.waiting}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('chat.closed')}</p>
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.closed}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-20rem)] flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Sessions List */}
        <div className="w-96 flex flex-col border-r border-slate-200 dark:border-slate-700">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('chat.searchSessions')}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-slate-800 dark:text-white"
              />
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {(['all', 'active', 'waiting', 'closed'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterStatus === status
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {t(`chat.${status}`)}
                  </button>
                ))}
              </div>
              
              <select
                value={filterCS}
                onChange={(e) => setFilterCS(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-slate-800 dark:text-white"
              >
                <option value="all">{t('chat.allCS')}</option>
                <option value="unassigned">{t('chat.unassigned')}</option>
                {csTeam.map(cs => (
                  <option key={cs.id} value={cs.id}>{cs.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sessions */}
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm p-4">
                <p>{t('chat.noSessions')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {sessions.map(session => {
                  const isSelected = selectedSessionId === session.id;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700 border-l-4 border-transparent'
                      }`}
                      title={t('chat.switchSession')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          {session.customerAvatar ? (
                            <img
                              src={getAvatarUrl(session.customerAvatar, 150, 'pravatar')}
                              alt={session.customerName}
                              className={`w-12 h-12 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ${
                                isSelected ? 'ring-indigo-600' : 'ring-transparent'
                              }`}
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ${
                              isSelected ? 'ring-indigo-600' : 'ring-transparent'
                            }`}>
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                                {session.customerName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          {session.status === 'active' && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`font-semibold text-sm truncate ${
                              isSelected 
                                ? 'text-indigo-700 dark:text-indigo-300' 
                                : 'text-slate-800 dark:text-white'
                            }`}>
                              {session.customerName}
                            </h3>
                            {session.unreadCount > 0 && (
                              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full font-medium min-w-[20px] text-center">
                                {session.unreadCount > 99 ? '99+' : session.unreadCount}
                              </span>
                            )}
                          </div>
                          {session.appName ? (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400">{t('chat.fromApp')}:</span>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-md border border-indigo-100 dark:border-indigo-800 w-fit">
                                <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-bold text-white">
                                    {session.appName.charAt(0)}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">
                                  {session.appName}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400">{t('chat.fromApp')}:</span>
                              <span className="text-xs text-slate-400 dark:text-slate-500">{t('chat.noApp')}</span>
                            </div>
                          )}
                          {session.csName && (
                            <div className="flex items-center gap-1 mb-1">
                              <User size={12} className="text-slate-400" />
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {session.csName}
                              </span>
                            </div>
                          )}
                          {session.lastMessage && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate mb-1">
                              {session.lastMessage}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatTime(session.lastMessageTime)}
                            </span>
                            {getStatusIcon(session.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col">
          {selectedSessionId ? (
            <ChatWindow sessionId={selectedSessionId} onSendMessage={handleSendMessage} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p>{t('chat.selectSession')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

