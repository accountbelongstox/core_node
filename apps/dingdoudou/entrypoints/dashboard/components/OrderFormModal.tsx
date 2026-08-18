/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Order } from '@/lib/types';
import { i18n, Language } from '../i18n';
import { orderFormText } from '@/lib/uiI18n';
import { X, Plus, AlertCircle, ShoppingBag, User, MapPin, Layers } from 'lucide-react';

interface OrderFormModalProps {
  accounts: string[];
  onClose: () => void;
  onSave: (order: Partial<Order>) => void;
  lang: Language;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  accounts,
  onClose,
  onSave,
  lang
}) => {
  const t = i18n[lang];
  const ui = orderFormText(lang);

  const [accountName, setAccountName] = useState(accounts[0] || '玛卡巴卡');
  const [productName, setProductName] = useState(ui.defaultProduct);
  const [specName, setSpecName] = useState(ui.defaultSpec);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(13.83);
  const [orderAmount, setOrderAmount] = useState(13.83);
  const [storeName, setStoreName] = useState(ui.defaultStore);
  const [status, setStatus] = useState<Order['status']>('待发货');

  // Recipient presets
  const [recipientPreset, setRecipientPreset] = useState('1');
  const [recipientName, setRecipientName] = useState('299 Liang Feifei 299');
  const [recipientPhone, setRecipientPhone] = useState('18024087406');
  const [recipientAddress, setRecipientAddress] = useState('广东省佛山市南海区里水镇甘焦怡和二路中坦云仓299梁菲菲299');

  const presetRecipients = [
    {
      id: '1',
      name: '299 Liang Feifei 299',
      phone: '18024087406',
      addr: '广东省佛山市南海区里水镇甘焦怡和二路中坦云仓299梁菲菲299'
    },
    {
      id: '2',
      name: '305 Zhang Xiaolong 305',
      phone: '13812345678',
      addr: '上海市浦东新区张江高科技园区博云路2号889仓张小龙'
    },
    {
      id: '3',
      name: '122 Wang Lin 122',
      phone: '15988887766',
      addr: '浙江省杭州市余杭区仓前街道 EFC 5幢王林'
    }
  ];

  const handlePresetChange = (presetId: string) => {
    setRecipientPreset(presetId);
    if (presetId === 'custom') return;
    const selected = presetRecipients.find(p => p.id === presetId);
    if (selected) {
      setRecipientName(selected.name);
      setRecipientPhone(selected.phone);
      setRecipientAddress(selected.addr);
    }
  };

  const handlePriceOrQtyChange = (newQty: number, newPrice: number) => {
    setQuantity(newQty);
    setUnitPrice(newPrice);
    setOrderAmount(Number((newQty * newPrice).toFixed(2)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      accountName,
      productName,
      specName,
      quantity,
      unitPrice,
      orderAmount,
      storeName,
      status,
      recipientName,
      recipientPhone,
      recipientAddress,
      productId: String(776920000000 + Math.floor(Math.random() * 9999999)),
      specId: String(1758120000000 + Math.floor(Math.random() * 999999)),
      selected: false,
      invoiceStatus: '未申请',
    });
  };

  return (
    <div id="order-form-modal" className="fixed inset-0 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div
        className="bg-white/80 dark:bg-slate-900/95 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/50 dark:border-white/10 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100 backdrop-blur-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {t.addOrderTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-705 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">

          {/* Section 1: Account & Store */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.pddAccGateway}</label>
              <select
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full text-xs bg-white dark:bg-black/40 text-slate-800 dark:text-slate-200 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {accounts.map((acc) => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.storeNameLabel}</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full text-xs bg-white dark:bg-black/40 text-slate-800 dark:text-slate-200 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Section 2: Product Name & Specs */}
          <div className="space-y-3 bg-white/70 dark:bg-white/5 p-3.5 rounded-xl border border-black/10 dark:border-white/10 shadow-sm">
            <h4 className="text-[11px] font-black text-slate-505 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <ShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {t.productMeta}
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.productNameLabel}</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full text-xs bg-white dark:bg-black/40 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Product item name"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.specLabel}</label>
                <input
                  type="text"
                  required
                  value={specName}
                  onChange={(e) => setSpecName(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-black/40 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.unitPriceLabel}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={unitPrice}
                  onChange={(e) => handlePriceOrQtyChange(quantity, parseFloat(e.target.value) || 0)}
                  className="w-full text-xs bg-white dark:bg-black/40 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.qtyLabel}</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => handlePriceOrQtyChange(parseInt(e.target.value) || 1, unitPrice)}
                  className="w-full text-xs bg-white dark:bg-black/40 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-black/10 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
              <span>{t.estimatedAmount}:</span>
              <strong className="text-base text-emerald-600 dark:text-emerald-400 font-sans font-black">¥{orderAmount.toFixed(2)}</strong>
            </div>
          </div>

          {/* Section 3: Recipient Information */}
          <div className="space-y-3 bg-white/70 dark:bg-white/5 p-3.5 rounded-xl border border-black/10 dark:border-white/10 shadow-sm">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <h4 className="text-[11px] font-black text-slate-505 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <MapPin className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                {t.recipientInfo}
              </h4>
              <select
                value={recipientPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="text-[11px] bg-white dark:bg-black/45 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 rounded px-2 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value="1">Liang Feifei (Zhongtan Hub)</option>
                <option value="2">Zhang Xiaolong (Boyun Road Hub)</option>
                <option value="3">Wang Lin (EFC Hub)</option>
                <option value="custom">✍️ {ui.customRecipient}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.recipientNameLabel}</label>
                <input
                  type="text"
                  required
                  disabled={recipientPreset !== 'custom'}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-black/40 disabled:bg-slate-100 dark:disabled:bg-black/15 disabled:opacity-50 disabled:text-slate-405 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.recipientPhone}</label>
                <input
                  type="text"
                  required
                  disabled={recipientPreset !== 'custom'}
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-black/40 disabled:bg-slate-100 dark:disabled:bg-black/15 disabled:opacity-50 disabled:text-slate-405 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.recipientAddressLabel}</label>
              <textarea
                required
                disabled={recipientPreset !== 'custom'}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                rows={2}
                className="w-full text-xs bg-white dark:bg-black/40 disabled:bg-slate-100 dark:disabled:bg-black/15 disabled:opacity-50 disabled:text-slate-405 text-slate-805 dark:text-slate-100 border border-black/15 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                placeholder="Central Hub Address"
              />
            </div>
          </div>

          {/* Section 4: Status */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.initialStatus}</label>
            <div className="flex gap-2 flex-wrap">
              {(['待支付', '待发货', '待收货', '已签收', '已退款', '已取消'] as Order['status'][]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    status === st
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-350 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {t[st] || st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-505 dark:text-slate-400 bg-blue-500/10 dark:bg-blue-950/20 p-2.5 border border-blue-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-500 dark:text-blue-450 flex-shrink-0" />
            <span>{t.addNote}</span>
          </div>

          {/* Footer inside Form */}
          <div className="pt-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-3.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {t.walletCancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-blue-500/15 border-none"
            >
              {t.addConfirm}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
