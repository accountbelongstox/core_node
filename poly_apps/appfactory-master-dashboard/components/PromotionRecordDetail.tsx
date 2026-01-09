import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, DollarSign, CheckCircle2, XCircle, MapPin, Video, FileText } from 'lucide-react';
import { modelService } from '../services/modelService';
import { PromotionRecord } from '../types';
import { useApp } from '../contexts/AppContext';
import { getAppNameById, getAppById } from '../utils/dataHelpers';

/**
 * Promotion Record Detail Component
 * Displays detailed information of promotion record, including track list, video records, location records, etc.
 */
export const PromotionRecordDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useApp();
  const [recordData, setRecordData] = useState<PromotionRecord | null>(null);

  useEffect(() => {
    if (!id) return;

    const records = modelService.getPromotionRecords();
    const record = records.find((r: PromotionRecord) => r.id === id);

    if (record) {
      setRecordData(record);
    }
  }, [id]);

  if (!recordData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">{t('promotionRecord.notFound')}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {t('promotionRecord.back')}
          </button>
        </div>
      </div>
    );
  }

  const validTracks = recordData.tracks.filter(t => t.isValid);
  const invalidTracks = recordData.tracks.filter(t => !t.isValid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{getAppNameById(recordData.appId)}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('promotionRecord.recordId')} {recordData.id}
            </p>
          </div>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-bold ${
          recordData.isSettled 
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
            : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
        }`}>
          {recordData.isSettled ? t('promotionRecord.settled') : t('promotionRecord.unsettled')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Basic Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('promotionRecord.basicInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.promoter').replace('：', '')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{recordData.promoterName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.timeRange')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  {recordData.startTime} {t('promotionRecord.to')} {recordData.endTime}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.validCountLabel')}</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{recordData.validCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.unitPrice').replace('：', '')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">¥{recordData.unitPrice}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.totalPrice').replace('：', '')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">¥{recordData.totalPrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.deductionLabel')}</p>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">¥{recordData.deduction.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.settlementLabel')}</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">¥{recordData.settlement.toLocaleString()}</p>
              </div>
              {recordData.approverName && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.approver').replace('：', '')}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{recordData.approverName}</p>
                </div>
              )}
            </div>
            {recordData.paymentAddress && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promotionRecord.paymentAddressCrypto')}</p>
                <code className="text-sm text-slate-800 dark:text-white font-mono break-all">
                  {recordData.paymentAddress}
                </code>
              </div>
            )}
          </div>

          {/* Promotion Track Details List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('promotionRecord.trackDetails')}</h3>
            <div className="space-y-3">
              {recordData.tracks.map(track => (
                <div
                  key={track.id}
                  className={`p-4 rounded-lg border ${
                    track.isValid
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {track.isValid ? (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle size={16} className="text-rose-600 dark:text-rose-400" />
                        )}
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{track.location}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          track.isValid
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {track.isValid ? t('promotionRecord.valid') : t('promotionRecord.invalid')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        {track.action} • {track.timestamp}
                      </p>
                      {track.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{track.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Video Records and Location Records */}
        <div className="space-y-6">
          {/* Video Records */}
          {recordData.videoRecords && recordData.videoRecords.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Video size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('promotionRecord.videoRecords')}</h3>
              </div>
              <div className="space-y-3">
                {recordData.videoRecords.map((video, index) => (
                  <div key={index} className="relative aspect-video bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                    <video
                      src={video}
                      controls
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLVideoElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-600">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('promotionRecord.videoIndex', { index: index + 1 })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location Records */}
          {recordData.locationRecords && recordData.locationRecords.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('promotionRecord.locationRecords')}</h3>
              </div>
              <div className="space-y-3">
                {recordData.locationRecords.map(loc => (
                  <div key={loc.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">{loc.address}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {loc.timestamp} • {t('promotionRecord.accuracy')} {loc.accuracy}m
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3">{t('promotionRecord.statistics')}</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t('promotionRecord.totalTracks')}</span>
                <span className="font-bold text-slate-800 dark:text-white">{recordData.tracks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t('promotionRecord.validTracks')}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{validTracks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t('promotionRecord.invalidTracks')}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{invalidTracks.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

