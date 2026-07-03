/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Order } from '@/lib/types';
import { i18n, Language } from '../i18n';
import { X, Send, User, MessageCircle, AlertCircle, ShoppingBag } from 'lucide-react';

interface ChatSimulatorProps {
  order: Order | null;
  onClose: () => void;
  lang: Language;
}

export const ChatSimulator: React.FC<ChatSimulatorProps> = ({
  order,
  onClose,
  lang
}) => {
  if (!order) return null;

  const t = i18n[lang];

  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot' | 'system'; text: string; time: string }>>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    const initialSys = t.chatSystemTip
      .replace('{store}', order.storeName)
      .replace('{id}', order.id);

    const initialGreet = t.chatInitGreeting
      .replace('{product}', order.productName.slice(0, 16));

    setMessages([
      {
        sender: 'system',
        text: initialSys,
        time: now
      },
      {
        sender: 'bot',
        text: initialGreet,
        time: now
      }
    ]);
  }, [order, lang]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userTime = new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const userMsg = inputText.trim();

    setMessages(prev => [...prev, { sender: 'user', text: userMsg, time: userTime }]);
    setInputText('');

    // Simulated reply based on content keywords
    setTimeout(() => {
      const pddReplyTime = new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

      let replyText = lang === 'zh'
        ? '收到！已为您上报库房和快件物流！我们将竭诚为您保障，有什么可以为您进行订单标注的？'
        : 'Received! We have reported this to our warehousing and courier logistics. We are fully committed to assisting you!';

      const lower = userMsg.toLowerCase();
      if (lower.includes('发货') || lower.includes('快递') || lower.includes('单号') || lower.includes('ship') || lower.includes('track') || lower.includes('deliver')) {
        replyText = order.expressNumber
          ? (lang === 'zh'
              ? `该订单已发出：[${order.expressCompany}]，物流单号是：[${order.expressNumber}]。最后轨迹显示是：${order.latestTrack}。我们会催促快递人员派送！`
              : `Order dispatched via [${order.expressCompany}], Tracking ID is [${order.expressNumber}]. Last status is: ${order.latestTrack}. We will urge courier dispatch!`)
          : (lang === 'zh'
              ? `正在抓紧为您安排打单！请耐心等待由云仓发货。预计在2小时内录入您的专属底单编号！`
              : `Arranging shipping print queue! Please expect central hub outbound dispatch. Your tracking reference will be populated within 2 hours!`);
      } else if (lower.includes('便宜') || lower.includes('退') || lower.includes('优惠') || lower.includes('refund') || lower.includes('cheap') || lower.includes('discount')) {
        replyText = lang === 'zh'
          ? `关于拼单金额 ¥${order.orderAmount}，如您收到货后有任何不满意，可以随时申请“极速售后”处理或退货退款，点击卡片下方 “申请退款” 即可开通一键快速通道。`
          : `Regarding your payment of ¥${order.orderAmount}, if you are dissatisfied upon arrival, you can prompt an expedited refund. Click 'Batch Refund' on the console anytime.`;
      } else if (lower.includes('发票') || lower.includes('开票') || lower.includes('invoice') || lower.includes('tax')) {
        replyText = lang === 'zh'
          ? `可以开具完成的电子发票！您可以在本平台一键点击 “申请发票”，系统会立刻为您生成并提供 PDF 文档下载支持。`
          : `We fully support electronic invoicing! Simply invoke the 'Apply Invoice' button on the card, and our system will draft and download the PDF invoice immediately.`;
      } else if (lower.includes('你好') || lower.includes('在吗') || lower.includes('hello') || lower.includes('hi')) {
        replyText = lang === 'zh'
          ? `您好，蓦然回首卖家助手全天候24小时为您守候，关于 ${order.productName.slice(0, 12)}... 任何问题请随时发问。`
          : `Hello, your Dingduoduo ERP support bot is online 24/7. Please let us know if you need any adjustments on this product!`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: replyText, time: pddReplyTime }]);
    }, 750);
  };

  const handleQuickQuestion = (qn: string) => {
    setInputText(qn);
  };

  return (
    <div id="chat-simulator-panel" className="fixed bottom-4 right-4 z-40 w-80 md:w-96 bg-white dark:bg-slate-900 border border-black/15 dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[400px] animate-in slide-in-from-bottom-5 duration-155 text-slate-800 dark:text-slate-100 backdrop-blur-2xl">

      {/* Header */}
      <div className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-500 animate-pulse" />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold truncate max-w-[160px] text-slate-850 dark:text-slate-200">{order.storeName}</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-450 flex items-center gap-0.5 font-sans">
              {t.accountLabel}: {order.accountName} • {t.chatOnline}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Product preview line */}
      <div className="bg-black/[0.02] dark:bg-white/5 border-b border-black/5 dark:border-white/10 p-2 text-xs flex gap-2 items-center">
        <div className="w-8 h-8 rounded border border-black/10 dark:border-white/10 overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-black/40">
          <img src={order.productImage} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-700 dark:text-slate-300 truncate text-[11px]">{order.productName}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">¥{order.orderAmount.toFixed(2)} | {t[order.status] || order.status}</p>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-black/20">
        {messages.map((m, idx) => {
          if (m.sender === 'system') {
            return (
              <div key={idx} className="flex justify-center">
                <span className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-500 dark:text-slate-450 rounded px-2.5 py-0.5 text-[10px] font-medium font-sans">
                  {m.text}
                </span>
              </div>
            );
          }
          const isUser = m.sender === 'user';
          return (
            <div key={idx} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                isUser ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/15' : 'bg-black/5 dark:bg-white/10 text-slate-605 dark:text-slate-300 border-black/10 dark:border-white/5'
              }`}>
                {isUser ? (lang === 'zh' ? '我' : 'Me') : (lang === 'zh' ? '店' : 'Bot')}
              </div>
              <div className="max-w-[70%] space-y-0.5">
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/10'
                    : 'bg-black/5 dark:bg-white/5 text-slate-800 dark:text-slate-205 border border-black/10 dark:border-white/10 rounded-tl-none shadow-sm'
                }`}>
                  {m.text}
                </div>
                <p className={`text-[9px] text-slate-400 dark:text-slate-500 font-mono ${isUser ? 'text-right' : ''}`}>
                  {m.time}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick buttons */}
      <div className="px-3 py-1.5 border-t border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/90 flex gap-1.5 overflow-x-auto whitespace-nowrap text-[10px] text-slate-400">
        <button
          onClick={() => handleQuickQuestion(lang === 'zh' ? '什么时候可以安排快件揽件发货？' : 'When is this package scheduled to be dispatched?')}
          className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/5 cursor-pointer"
        >
          🚚 {t.chatQuickStatus}
        </button>
        <button
          onClick={() => handleQuickQuestion(lang === 'zh' ? '需要退款，怎么申请最快捷？' : 'How can I quickly request a refund or return?')}
          className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/5 cursor-pointer"
        >
          💰 {t.chatQuickAftersales}
        </button>
        <button
          onClick={() => handleQuickQuestion(lang === 'zh' ? '帮核对我的发票是否申请正确？' : 'Can you check if my e-invoice was submitted correctly?')}
          className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/5 cursor-pointer"
        >
          🧾 {t.chatQuickInvoice}
        </button>
      </div>

      {/* Form Input bar */}
      <form onSubmit={handleSend} className="p-2 border-t border-black/10 dark:border-white/10 flex gap-2 bg-white dark:bg-slate-900">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.chatPlaceholder}
          className="w-full text-xs text-slate-800 dark:text-slate-100 bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 p-2"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer border-none shadow-md shadow-blue-500/10"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
};
