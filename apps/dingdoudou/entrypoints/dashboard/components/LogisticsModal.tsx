/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Order } from '@/lib/types';
import { i18n, Language } from '../i18n';
import {
  X, Truck, CheckCircle2, Circle, AlertCircle, ShoppingCart,
  MapPin, ShieldAlert, Award, Copy, Download, CreditCard
} from 'lucide-react';

interface LogisticsModalProps {
  order: Order | null;
  onClose: () => void;
  onCopyText: (text: string, label: string) => void;
  lang: Language;
}

export const LogisticsModal: React.FC<LogisticsModalProps> = ({
  order,
  onClose,
  onCopyText,
  lang
}) => {
  if (!order) return null;

  const t = i18n[lang];

  return (
    <div id="logistics-modal" className="fixed inset-0 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div
        className="bg-white/80 dark:bg-slate-900/90 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/50 dark:border-white/10 animate-in fade-in zoom-in-95 duration-155 text-slate-805 dark:text-slate-100 backdrop-blur-3xl"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Truck className="w-5 h-5 text-blue-600 dark:text-blue-450" />
              {t.logisticsTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-450 font-mono mt-0.5 animate-pulse">
              {t.orderNo}: <span className="text-slate-800 dark:text-slate-300 font-extrabold">{order.id}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Workspace */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Order Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Recipient details */}
            <div className="bg-white/65 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-205 flex items-center gap-1.5 border-b border-black/5 dark:border-white/10 pb-2 mb-2">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {t.recipientInfo}
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">{t.recipientName}:</span> <strong className="text-slate-800 dark:text-slate-100">{order.recipientName}</strong>
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">{t.recipientPhone}:</span> <strong className="text-slate-800 dark:text-slate-200 font-mono">{order.recipientPhone}</strong>
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="text-slate-505 block mb-0.5">{t.recipientAddress}:</span>
                <span className="text-slate-800 dark:text-slate-200 bg-white/90 dark:bg-black/40 border border-black/10 dark:border-white/10 px-2 py-1 rounded inline-block mt-0.5 leading-relaxed">
                  {order.recipientAddress}
                </span>
              </p>
              <button
                onClick={() => onCopyText(`${order.recipientName} ${order.recipientPhone} ${order.recipientAddress}`, t.recipientInfo)}
                className="text-[11px] text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 font-semibold flex items-center gap-1 mt-2 bg-blue-500/10 dark:bg-blue-500/15 px-2.5 py-1 rounded-md border border-blue-505/20 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {t.copyRecipient}
              </button>
            </div>

            {/* Merchant Details */}
            <div className="bg-white/65 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-205 flex items-center gap-1.5 border-b border-black/5 dark:border-white/10 pb-2 mb-2">
                <Award className="w-4 h-4 text-indigo-505 dark:text-indigo-400" />
                {t.productMeta}
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">{t.shopName}:</span> <strong className="text-slate-800 dark:text-slate-200">{order.storeName}</strong>
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">{lang === 'zh' ? '拼单商品' : 'Product'}:</span> <span className="text-slate-800 dark:text-slate-200">{order.productName}</span>
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">{t.specType}:</span> <span className="font-semibold text-blue-650 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px]">{order.specName}</span>
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">{lang === 'zh' ? '绑定账号' : 'ERP ID'}:</span> <strong className="text-slate-800 dark:text-slate-200">{order.accountName} (PDD-Cloud)</strong>
              </p>
              <div className="flex justify-between items-center bg-white/90 dark:bg-black/30 border border-black/10 dark:border-white/5 p-2 rounded-lg mt-2 text-[11px]">
                <div>
                  <span className="text-slate-505 mr-1">{t.actualPaid}:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-455 font-mono text-base">¥{order.orderAmount.toFixed(2)}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{t.unitPrice} ¥{order.unitPrice} × {order.quantity}</span>
              </div>
            </div>

          </div>

          {/* Express Overview Info */}
          <div className="border border-blue-400/20 dark:border-blue-500/15 bg-blue-500/5 dark:bg-blue-950/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Truck className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-450">{t.carrier}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {order.expressCompany || t.notShipped} : <span className="font-mono text-emerald-650 dark:text-emerald-400 font-extrabold">{order.expressNumber || 'Tracking Info Loading...'}</span>
                </p>
              </div>
            </div>
            {order.expressNumber && (
              <button
                onClick={() => onCopyText(order.expressNumber!, t.carrier)}
                className="px-2.5 py-1 text-xs border border-blue-500/30 dark:border-blue-500/30 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-lg font-bold cursor-pointer transition-colors"
              >
                {t.copyBtn}
              </button>
            )}
          </div>

          {/* Logistics Timeline */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
              {t.timelineTitle}
            </h4>

            {order.trackingDetails && order.trackingDetails.length > 0 ? (
              <div className="relative border-l-2 border-black/10 dark:border-white/10 pl-5 ml-2.5 space-y-5 py-1 select-text">
                {order.trackingDetails.map((track, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div key={idx} className="relative animate-in fade-in duration-300">
                      {/* Node circle */}
                      <span className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-slate-900 flex items-center justify-center ${
                         isLatest ? 'border-blue-500' : 'border-black/20 dark:border-white/10'
                      }`}>
                        {isLatest && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />}
                      </span>

                      {/* Content */}
                      <div className="space-y-0.5">
                        <span className={`text-[10px] font-mono leading-none block ${
                          isLatest ? 'text-blue-600 dark:text-blue-400 font-black' : 'text-slate-500'
                        }`}>
                          {track.time}
                        </span>
                        <p className={`text-xs leading-relaxed ${
                          isLatest ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {track.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white/50 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-xl p-6 text-center space-y-1">
                <AlertCircle className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                <p className="text-xs text-slate-800 dark:text-slate-300 font-semibold">{t.noTracks} (<strong>{t[order.status] || order.status}</strong>)</p>
                <p className="text-[11px] text-slate-500">{t.noTracksDesc}</p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-slate-550" />
            <span>{t.pddMarket}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-black/15 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {t.walletCancel}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
