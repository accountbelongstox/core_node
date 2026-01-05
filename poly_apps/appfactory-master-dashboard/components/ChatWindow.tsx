import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, Paperclip, Smile, DollarSign } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { modelService } from '../services/modelService';
import { ChatMessage } from '../types';
import { PaymentVerificationRequest } from './PaymentVerificationRequest';
import { useInterval } from '../hooks/useInterval';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { getAvatarUrl } from '../utils/avatarUtils';

interface ChatWindowProps {
  sessionId: string;
  onSendMessage: (content: string) => void;
  initialMessage?: string;
  onMessageFilled?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ sessionId, onSendMessage, initialMessage, onMessageFilled }) => {
  const { t, user } = useApp();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use React Hook for auto-resizing textarea instead of manual DOM manipulation
  const inputRef = useAutoResizeTextarea(message, 120);

  // Handle initial message from script template
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
      // Use React ref for focus, height is handled by useAutoResizeTextarea hook
      inputRef.current?.focus();
      if (onMessageFilled) {
        onMessageFilled();
      }
    }
  }, [initialMessage, onMessageFilled, inputRef]);

  // Use React Hook with useMemo to optimize message filtering
  const loadMessages = useCallback(() => {
    const sessionMessages = modelService.getMessagesBySessionId(sessionId);
    setMessages(sessionMessages);
  }, [sessionId]);

  // Load messages on mount and when sessionId changes
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Use React Hook instead of manual setInterval for auto-refresh
  useInterval(() => {
    loadMessages();
  }, 2000); // Auto-refresh messages every 2 seconds

  // Use React's useEffect for scrolling instead of manual function call
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Use React's useCallback for event handlers
  const handleSend = useCallback(() => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      // Height auto-adjusts via useAutoResizeTextarea hook
    }
  }, [message, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Height auto-adjusts via useAutoResizeTextarea hook
  }, []);

  const formatTime = (timestamp: string) => {
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

  const [sessionData, setSessionData] = useState<any>(null);
  const [appInfo, setAppInfo] = useState<any>(null);

  // Load session and app data
  useEffect(() => {
    const loadData = () => {
      const sessions = modelService.getChatSessions() ?? [];
      const currentSession = sessions.find(s => s.id === sessionId);
      
      if (currentSession) {
        // Set session data with all fields
        setSessionData(currentSession);
        
        // Try to get app info from apps list first
        if (currentSession.appId) {
          const apps = modelService.getApps() ?? [];
          const app = apps.find(a => a.id === currentSession.appId);
          if (app) {
            setAppInfo(app);
          } else if (currentSession.appName) {
            // If app not found in apps list, use session.appName as fallback
            setAppInfo({ name: currentSession.appName, category: '' });
          } else {
            setAppInfo(null);
          }
        } else if (currentSession.appName) {
          // If no appId but has appName, use it directly
          setAppInfo({ name: currentSession.appName, category: '' });
        } else {
          setAppInfo(null);
        }
      } else {
        setSessionData(null);
        setAppInfo(null);
      }
    };

    loadData();
  }, [sessionId]);
  
  // Refresh data periodically using React Hook
  useInterval(() => {
    const sessions = modelService.getChatSessions() ?? [];
    const currentSession = sessions.find(s => s.id === sessionId);
    
    if (currentSession) {
      setSessionData(currentSession);
      
      if (currentSession.appId) {
        const apps = modelService.getApps() ?? [];
        const app = apps.find(a => a.id === currentSession.appId);
        if (app) {
          setAppInfo(app);
        } else if (currentSession.appName) {
          setAppInfo({ name: currentSession.appName, category: '' });
        } else {
          setAppInfo(null);
        }
      } else if (currentSession.appName) {
        setAppInfo({ name: currentSession.appName, category: '' });
      } else {
        setAppInfo(null);
      }
    } else {
      setSessionData(null);
      setAppInfo(null);
    }
  }, 1000);

  const session = sessionData;
  const customerName = session?.customerName ?? 'Customer';
  const displayAppName = appInfo?.name ?? sessionData?.appName ?? '';
  const appCategory = appInfo?.category ?? '';
  

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {session?.customerAvatar && (
              <img 
                src={getAvatarUrl(session.customerAvatar, 150, 'pravatar')} 
                alt={customerName}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">{customerName}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {session?.status === 'active' ? t('chat.online') : t('chat.offline')}
              </p>
            </div>
          </div>
          {displayAppName ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                <span className="text-xs font-bold text-white">
                  {displayAppName.charAt(0)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-tight">
                  {displayAppName}
                </span>
                {appCategory && (
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 leading-tight">
                    {appCategory}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="w-7 h-7 rounded-lg bg-slate-400 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">?</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('chat.noApp')}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          {displayAppName ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{t('chat.fromApp')}:</span>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-md border border-indigo-100 dark:border-indigo-800">
                <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">
                    {displayAppName.charAt(0)}
                  </span>
                </div>
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  {displayAppName}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{t('chat.fromApp')}:</span>
              <span className="text-slate-400 dark:text-slate-500">{t('chat.noApp')}</span>
            </div>
          )}
          <button
            onClick={() => setShowPaymentRequest(!showPaymentRequest)}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-sm font-medium"
          >
            <DollarSign size={14} />
            {t('paymentVerification.requestVerification')}
          </button>
        </div>
      </div>

      {/* Payment Verification Request */}
      {showPaymentRequest && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
          <PaymentVerificationRequest
            sessionId={sessionId}
            customerId={session?.customerId}
            customerName={session?.customerName}
            appId={session?.appId}
            appName={session?.appName}
            onSubmitted={() => setShowPaymentRequest(false)}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>{t('chat.noMessages')}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCS = msg.senderType === 'cs';
            return (
              <div
                key={msg.id}
                className={`flex ${isCS ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[70%] ${isCS ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isCS && (
                    <img
                      src={getAvatarUrl(session?.customerAvatar, 150, 'pravatar')}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  )}
                  <div className={`flex flex-col ${isCS ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isCS
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 px-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-end gap-2">
          <button
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title={t('chat.attachFile')}
          >
            <Paperclip size={20} />
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={t('chat.typeMessage')}
              className="w-full px-4 py-2 pr-10 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white resize-none max-h-[120px]"
              rows={1}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            title={t('chat.send')}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

