/**
 * pycore-manager end (Pc*). Mounted by the shell at /pycore-manager/*.
 * Sidebar layout + explicit lazy route per page. (Routes are written out rather
 * than mapped because react-router 7's plain-function <Route> + a `key` from a
 * map mis-types under this config; the sidebar still derives from pcPages.)
 */
import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PcLayout } from './PcLayout';
import { PcLiveProvider } from './PcLiveContext';
import { PcCapabilityProvider } from './PcCapabilityContext';
import { PcVideoExtractProvider } from './PcVideoExtractContext';
import { PcLaravelEndpointProvider } from './PcLaravelEndpointContext';
import {
  checkPycoreNow, syncPycoreOfflineRecheckLoop, stopPycoreOfflineRecheckLoop,
} from '../../core/api-libs/pycore';
import { registerPcLocales } from './pc-locales';
import { PcLanguageSync } from './PcLanguageSync';

registerPcLocales();
import {
  PcVoiceSubtitlePage, PcQueueCenterPage, PcWindowAutomationPage,
  PcCodeSyncPage, PcVideoExtractPage, PcBooksPage, PcAiPage,
  PcSettingsPage,
} from './pcPages';

const Fallback: React.FC = () => <div className="p-8 text-slate-500">Loading…</div>;
const wrap = (node: React.ReactNode) => <Suspense fallback={<Fallback />}>{node}</Suspense>;

const PcApp: React.FC = () => {
  // Pycore reachability, gated by the /pycore-manager prefix: one ping on
  // mount, then the all-Offline retry loop re-pings at the configurable
  // interval (PcSettingsPage) only while the backend is down; stops on
  // recovery and on unmount.
  useEffect(() => {
    let cancelled = false;
    checkPycoreNow().then(() => {
      if (!cancelled) syncPycoreOfflineRecheckLoop();
    });
    return () => {
      cancelled = true;
      stopPycoreOfflineRecheckLoop();
    };
  }, []);

  return (
    <PcLiveProvider>
    <PcLanguageSync />
    <PcLaravelEndpointProvider>
    <PcCapabilityProvider>
    <PcVideoExtractProvider>
    <Routes>
      <Route element={<PcLayout />}>
        <Route index element={wrap(<PcVoiceSubtitlePage />)} />
        <Route path="voice-subtitle" element={wrap(<PcVoiceSubtitlePage />)} />
        {/* Legacy routes of the two pages now merged into the tabbed page */}
        <Route path="voice-player" element={<Navigate to="/pycore-manager/voice-subtitle" replace />} />
        <Route path="subtitle" element={<Navigate to="/pycore-manager/voice-subtitle" replace />} />
        <Route path="queue-center" element={wrap(<PcQueueCenterPage />)} />
        {/* Legacy routes of the three queue pages now merged into Queue Center:
            each old slug lands on the matching tab. */}
        <Route path="queue" element={<Navigate to="/pycore-manager/queue-center?tab=manager" replace />} />
        <Route path="task-queue" element={<Navigate to="/pycore-manager/queue-center?tab=tasks" replace />} />
        <Route path="translation-queue" element={<Navigate to="/pycore-manager/queue-center?tab=translation" replace />} />
        <Route path="window-automation" element={wrap(<PcWindowAutomationPage />)} />
        <Route path="code-sync" element={wrap(<PcCodeSyncPage />)} />
        <Route path="video-extract" element={wrap(<PcVideoExtractPage />)} />
        <Route path="books" element={wrap(<PcBooksPage />)} />
        <Route path="ai" element={wrap(<PcAiPage />)} />
        {/* Legacy routes of the three AI pages now merged into the tabbed AI
            page: each old slug lands on the matching sub-tab. */}
        <Route path="ai-status" element={<Navigate to="/pycore-manager/ai?tab=capability" replace />} />
        <Route path="ai-image" element={<Navigate to="/pycore-manager/ai?tab=studio" replace />} />
        <Route path="ai-keys" element={<Navigate to="/pycore-manager/ai?tab=keys" replace />} />
        <Route path="settings" element={wrap(<PcSettingsPage />)} />
        <Route path="*" element={<Navigate to="/pycore-manager" replace />} />
      </Route>
    </Routes>
    </PcVideoExtractProvider>
    </PcCapabilityProvider>
    </PcLaravelEndpointProvider>
    </PcLiveProvider>
  );
};

export default PcApp;
