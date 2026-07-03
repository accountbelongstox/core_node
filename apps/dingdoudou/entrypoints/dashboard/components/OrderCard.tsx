/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Order } from '@/lib/types';
import { i18n, Language } from '../i18n';
import {
  Copy, ExternalLink, RefreshCw, MessageSquare, FileText,
  ShoppingBag, Truck, MapPin, User, Phone, Tag, Calendar,
  ChevronDown, ArrowUpRight, ShieldCheck, CheckCircle
} from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onSelect: (id: string, select: boolean) => void;
  onRefreshLogistics: (id: string) => void;
  onOpenDetails: (order: Order) => void;
  onApplyInvoice: (id: string) => void;
  onReplayGroupBuy: (order: Order) => void;
  onContactSupport: (order: Order) => void;
  onCopyText: (text: string, label: string) => void;
  lang: Language;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onSelect,
  onRefreshLogistics,
  onOpenDetails,
  onApplyInvoice,
  onReplayGroupBuy,
  onContactSupport,
  onCopyText,
  lang
}) => {

  const t = i18n[lang];

  // Map status strings to translated values
  const translatedStatus = t[order.status] || order.status;

  const statusColors = {
    '待支付': 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/30',
    '待发货': 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30 dark:border-blue-500/30',
    '待收货': 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 dark:border-purple-500/30',
    '已签收': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-500/30',
    '已退款': 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30 dark:border-rose-500/30',
    '已取消': 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-black/10 dark:border-white/10',
  };

  const invoiceBtnStyles = {
    '未申请': 'border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 hover:border-black/25 dark:hover:border-white/20',
    '已申请': 'border-emerald-500/35 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/25',
    '已下载': 'border-blue-500/35 text-blue-600 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 dark:hover:bg-blue-500/25'
  };

  const handleCopyLink = () => {
    onCopyText(order.groupBuyUrl || `https://mobile.yangkeduo.com/group.html?id=${order.id}`, t.groupBuyUrlBtn);
  };

  const handleCopyAll = () => {
    const text = `
Order ID: ${order.id}
Product: ${order.productName}
Spec: ${order.specName}
Qty: ${order.quantity} | Price: ¥${order.unitPrice} | Total: ¥${order.orderAmount}
Recipient: ${order.recipientName} Phone: ${order.recipientPhone}
Address: ${order.recipientAddress}
Logistics: ${order.expressCompany || 'None'} Tracking: ${order.expressNumber || 'None'}
    `.trim();
    onCopyText(text, t.tableTitle);
  };

  return (
    <div id={`order-card-${order.id}`} className="bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-blue-500/20 backdrop-blur-2xl text-slate-800 dark:text-slate-100">

      {/* Card Header */}
      <div className="bg-black/[0.02] dark:bg-white/5 px-4 py-3 border-b border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!order.selected}
            onChange={(e) => onSelect(order.id, e.target.checked)}
            className="w-4 h-4 rounded border-black/20 dark:border-white/20 bg-white/50 dark:bg-black/40 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <div className="flex items-center gap-1.5 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-black/5 dark:border-white/10">
            <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-450 rounded-full animate-pulse" />
            {t.accountLabel}: <span className="font-bold">{order.accountName}</span>
          </div>
          <span className="text-xs text-slate-505 dark:text-slate-400 font-mono">
            {t.pddNo}: <span className="text-slate-800 dark:text-slate-300 font-bold hover:text-blue-500 hover:underline cursor-pointer" onClick={() => onCopyText(order.id, t.pddNo)}>{order.id}</span>
          </span>
          <button
            onClick={() => onCopyText(order.id, t.pddNo)}
            className="text-[10px] text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-0.5 cursor-pointer"
            title="Copy Order ID"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[order.status] || ''}`}>
            {translatedStatus}
          </span>
          <button
            onClick={handleCopyAll}
            className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-white/60 dark:bg-white/5 px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            title="Copy Full Text"
          >
            <Copy className="w-3 h-3" />
            {t.copyBtn}
          </button>
        </div>
      </div>

      {/* Card Body Grid */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left Side: Product Info */}
        <div className="lg:col-span-6 flex gap-4">
          <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-black/35 overflow-hidden flex-shrink-0 border border-black/10 dark:border-white/10 relative">
            <img
              src={order.productImage}
              alt={order.productName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540103711724-eb18534c4416?auto=format&fit=crop&q=80&w=240';
              }}
            />
            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
              #{order.productId.slice(-4)}
            </span>
          </div>

          <div className="space-y-1 select-text">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
              {order.productName}
            </h4>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5">
                {lang === 'zh' ? '规格' : 'Spec'}: {order.specName}
              </span>
              <span>{lang === 'zh' ? '数量' : 'Qty'}: <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
              <span>{lang === 'zh' ? '单价' : 'Price'}: <strong className="text-slate-700 dark:text-slate-200">¥{order.unitPrice}</strong></span>
            </div>

            <div className="text-[10px] text-slate-500 font-mono space-y-0.5">
              <p>Item ID: {order.productId} <span className="text-blue-500 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => onCopyText(order.productId, 'Product ID')}>[Copy]</span></p>
              <p>Sku ID: {order.specId || 'N/A'} <span className="text-blue-500 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => onCopyText(order.specId || '', 'Sku ID')}>[Copy]</span></p>
            </div>

            <div className="pt-1.5 flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 dark:hover:bg-blue-500/25 border border-blue-500/20 px-2 py-1 rounded transition-colors font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {t.groupBuyUrlBtn}
              </button>
              <span className="text-[10px] text-slate-505 dark:text-slate-500 flex items-center gap-1 font-sans">
                <Calendar className="w-3 h-3" />
                {t.orderTimeLabel}: {order.orderTime}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Side: Shipping Profile & Logistics tracking */}
        <div className="lg:col-span-6 border-t lg:border-t-0 lg:border-l border-black/5 dark:border-white/10 pt-4 lg:pt-0 lg:pl-5 flex flex-col justify-between">
          <div className="space-y-2.5">
            {/* Customer Contact */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 text-xs select-text">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-bold">
                <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>{order.recipientName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-350">
                <Phone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="font-mono hover:underline cursor-pointer font-bold" onClick={() => onCopyText(order.recipientPhone, 'Recipient Phone')}>
                  {order.recipientPhone}
                </span>
                <span className="text-blue-600 dark:text-blue-400 hover:underline text-[10px] cursor-pointer" onClick={() => onCopyText(order.recipientPhone, 'Phone')}>[Copy]</span>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors select-text">
              <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2 leading-relaxed font-medium">
                {order.recipientAddress}
              </span>
              <button
                onClick={() => onCopyText(order.recipientAddress, 'Ship Address')}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline ml-1 whitespace-nowrap self-center cursor-pointer"
              >
                {t.copyBtn}
              </button>
            </div>

            {/* Logistics Status & Latest trace */}
            {order.expressNumber ? (
              <div className="bg-blue-500/10 rounded-lg p-2.5 border border-blue-500/15 space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-sans">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Truck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    <strong>{order.expressCompany}</strong>:
                    <span className="font-mono hover:underline cursor-pointer font-bold" onClick={() => onCopyText(order.expressNumber!, 'Tracking Number')}>
                      {order.expressNumber}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">{lang === 'zh' ? '发货' : 'Shipped'}: {order.shippingTime}</span>
                </div>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed font-semibold font-sans line-clamp-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-ping" />
                  {t.lastTrackPrefix}: {order.latestTrack || (lang === 'zh' ? '快递正在派件' : 'In Transit')}
                </p>
              </div>
            ) : (
              <div className="text-center py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.02] dark:bg-white/5">
                <p className="text-xs text-slate-500 dark:text-slate-450 font-medium font-sans">
                  {lang === 'zh' ? '暂无物流单号 / 等待商家打单发货' : 'Awaiting Tracking Number / Pending Merchant Dispatch'}
                </p>
              </div>
            )}
          </div>

          {/* Amount Summary */}
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t.shopName}: <span className="font-bold text-slate-700 dark:text-slate-300">{order.storeName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.actualPaid}:</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-sans">
                ¥{order.orderAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Action Buttons Bar */}
      <div className="bg-black/[0.01] dark:bg-white/5 border-t border-black/5 dark:border-white/10 px-4 py-3 flex justify-between items-center flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-450 font-sans">
            {t.invoiceLabel}: <strong className={order.invoiceStatus !== '未申请' ? 'text-emerald-605 font-bold' : 'text-slate-505 dark:text-slate-500 font-bold'}>{t[order.invoiceStatus || '未申请']}</strong>
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => onRefreshLogistics(order.id)}
            className="px-3 py-1.5 border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all cursor-pointer font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            {t.refreshLogistics}
          </button>

          <button
            onClick={() => onApplyInvoice(order.id)}
            className={`px-3 py-1.5 border rounded-xl flex items-center gap-1 transition-all cursor-pointer font-semibold ${invoiceBtnStyles[order.invoiceStatus || '未申请'] || ''}`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t.applyInvoice}
          </button>

          <button
            onClick={() => onReplayGroupBuy(order)}
            className="px-4 py-1.5 border border-black/10 dark:border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10 dark:hover:bg-blue-500/15 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 rounded-xl flex items-center gap-1 transition-all cursor-pointer font-semibold"
          >
            <ShoppingBag className="w-3.5 h-3.5 animate-bounce" />
            {t.buyAgain}
          </button>

          <button
            onClick={() => onContactSupport(order)}
            className="px-3 py-1.5 border border-black/10 dark:border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10 dark:hover:bg-blue-500/15 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 rounded-xl flex items-center gap-1 transition-all cursor-pointer font-semibold"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-500 hover:text-blue-500" />
            {t.contactSupplier}
          </button>

          <button
            onClick={() => onOpenDetails(order)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1 transition-all shadow-md shadow-blue-500/10 cursor-pointer border-none"
          >
            {t.viewDetails}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
