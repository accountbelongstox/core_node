/* [v4.1-Iris] WfRouteCenter — full wordflow route registry as a RouteObject[].
 * Ported from poly_apps/qy_capacitor/router/RouteCenter.tsx. Every page is lazy
 * + Suspense-wrapped. Non-immersive routes nest under the <WfLayout/> layout
 * route (top bar + bottom island); immersive routes (reading/flashcard/quiz/
 * listening run/player) are top-level fullscreen (no chrome). All paths are
 * RELATIVE to /wordflow (no leading slash) since the shell mounts this end at
 * /wordflow/*. Consumed by WfApp via useRoutes(WF_ROUTES). */
import React, { Suspense, lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import WfLayout from './WfLayout';

// Already-ported pages (do not stub/overwrite).
const WfLearnHomePage = lazy(() => import('./pages/WfLearnHomePage'));
const WfToolsAiAssistantPage = lazy(() => import('./pages/WfToolsAiAssistantPage'));

// Auth
const WfAuthLoginPage = lazy(() => import('./pages/WfAuthLoginPage'));
const WfAuthForgotPasswordPage = lazy(() => import('./pages/WfAuthForgotPasswordPage'));
const WfAuthResetPasswordPage = lazy(() => import('./pages/WfAuthResetPasswordPage'));

// Dashboard
const WfDashboardHomePage = lazy(() => import('./pages/WfDashboardHomePage'));
const WfDashboardStatsPage = lazy(() => import('./pages/WfDashboardStatsPage'));

// Learn
const WfLearnLibraryPage = lazy(() => import('./pages/WfLearnLibraryPage'));
const WfLearnPracticePage = lazy(() => import('./pages/WfLearnPracticePage'));
const WfLearnReviewPage = lazy(() => import('./pages/WfLearnReviewPage'));
const WfDailyRecitationPage = lazy(() => import('./pages/WfDailyRecitationPage'));

// Mine
const WfMineIndexPage = lazy(() => import('./pages/WfMineIndexPage'));
const WfMineProgressPage = lazy(() => import('./pages/WfMineProgressPage'));
const WfMineSocialPage = lazy(() => import('./pages/WfMineSocialPage'));

// Reading / Flashcards
const WfReadingSetupPage = lazy(() => import('./pages/WfReadingSetupPage'));
const WfReadingRunPage = lazy(() => import('./pages/WfReadingRunPage'));
const WfFlashcardSetupPage = lazy(() => import('./pages/WfFlashcardSetupPage'));
const WfFlashcardRunPage = lazy(() => import('./pages/WfFlashcardRunPage'));

// Profile
const WfProfileProfilePage = lazy(() => import('./pages/WfProfileProfilePage'));
const WfProfileEditPage = lazy(() => import('./pages/WfProfileEditPage'));

// Settings
const WfSettingsIndexPage = lazy(() => import('./pages/WfSettingsIndexPage'));
const WfSettingsLanguagePage = lazy(() => import('./pages/WfSettingsLanguagePage'));
const WfSettingsLearningPage = lazy(() => import('./pages/WfSettingsLearningPage'));
const WfSettingsDisplayPage = lazy(() => import('./pages/WfSettingsDisplayPage'));
const WfSettingsNotificationsPage = lazy(() => import('./pages/WfSettingsNotificationsPage'));
const WfSettingsDataSyncPage = lazy(() => import('./pages/WfSettingsDataSyncPage'));
const WfSettingsAboutPage = lazy(() => import('./pages/WfSettingsAboutPage'));
const WfSettingsSystemStatisticsPage = lazy(() => import('./pages/WfSettingsSystemStatisticsPage'));
const WfSettingsApiServerPage = lazy(() => import('./pages/WfSettingsApiServerPage'));
const WfSettingsPrivacyPage = lazy(() => import('./pages/WfSettingsPrivacyPage'));
const WfSettingsWordReadingPage = lazy(() => import('./pages/WfSettingsWordReadingPage'));

// Library / Vocabulary
const WfLibraryCoursesPage = lazy(() => import('./pages/WfLibraryCoursesPage'));
const WfLibraryGroupManagementPage = lazy(() => import('./pages/WfLibraryGroupManagementPage'));
const WfLibraryGroupDetailPage = lazy(() => import('./pages/WfLibraryGroupDetailPage'));
const WfLibraryAddToGroupPage = lazy(() => import('./pages/WfLibraryAddToGroupPage'));
const WfLibraryRecommendationsPage = lazy(() => import('./pages/WfLibraryRecommendationsPage'));
const WfLibraryCourseDetailPage = lazy(() => import('./pages/WfLibraryCourseDetailPage'));
const WfLibraryWordDetailPage = lazy(() => import('./pages/WfLibraryWordDetailPage'));
const WfVocabularyLibraryDetailPage = lazy(() => import('./pages/WfVocabularyLibraryDetailPage'));

// Public media content (books / subtitles, Wave-2 2026-06-12)
const WfMediaLibraryPage = lazy(() => import('./pages/WfMediaLibraryPage'));
const WfMediaDetailPage = lazy(() => import('./pages/WfMediaDetailPage'));

// Documents / Search
const WfDocumentsUploadPage = lazy(() => import('./pages/WfDocumentsUploadPage'));
const WfSearchDictionaryPage = lazy(() => import('./pages/WfSearchDictionaryPage'));

// Social / Review
const WfSocialLeaderboardPage = lazy(() => import('./pages/WfSocialLeaderboardPage'));
const WfSocialFriendsPage = lazy(() => import('./pages/WfSocialFriendsPage'));
const WfReviewDashboardPage = lazy(() => import('./pages/WfReviewDashboardPage'));

// Immersive runners
const WfQuizRunPage = lazy(() => import('./pages/WfQuizRunPage'));
const WfListeningPlayerPage = lazy(() => import('./pages/WfListeningPlayerPage'));
const WfLearningStudySessionPage = lazy(() => import('./pages/WfLearningStudySessionPage'));

// Playlist / History
const WfLearningPlaylistPage = lazy(() => import('./pages/WfLearningPlaylistPage'));
const WfLearningPlaylistConfigPage = lazy(() => import('./pages/WfLearningPlaylistConfigPage'));
const WfStatsHistoryPage = lazy(() => import('./pages/WfStatsHistoryPage'));

// Tools
const WfToolsIndexPage = lazy(() => import('./pages/WfToolsIndexPage'));
const WfToolsDictionaryPage = lazy(() => import('./pages/WfToolsDictionaryPage'));
const WfToolsAnalyticsPage = lazy(() => import('./pages/WfToolsAnalyticsPage'));
const WfToolsPersonalDictionaryPage = lazy(() => import('./pages/WfToolsPersonalDictionaryPage'));
const WfToolsVocabularyBrowserPage = lazy(() => import('./pages/WfToolsVocabularyBrowserPage'));
const WfToolsTranslationToolsPage = lazy(() => import('./pages/WfToolsTranslationToolsPage'));
const WfToolsTtsToolsPage = lazy(() => import('./pages/WfToolsTtsToolsPage'));
const WfToolsArticleProcessorPage = lazy(() => import('./pages/WfToolsArticleProcessorPage'));

/** Wrap a lazy page in the shared Suspense fallback. */
function S(node: React.ReactNode): React.ReactElement {
  return <Suspense fallback={<div className="ds-page pt-16">Loading…</div>}>{node}</Suspense>;
}

/**
 * Layout (chrome) routes — top bar + bottom island. All paths relative to
 * /wordflow. Mirrors RouteCenter's non-immersive ROUTE_REGISTRY entries.
 */
const LAYOUT_CHILDREN: RouteObject[] = [
  // Dashboard / home
  { index: true, element: S(<WfLearnHomePage />) },
  { path: 'home', element: S(<WfDashboardHomePage />) },
  { path: 'dashboard', element: S(<WfDashboardHomePage />) },
  { path: 'stats', element: S(<WfDashboardStatsPage />) },

  // Learn module
  { path: 'learn/home', element: S(<WfLearnHomePage />) },
  { path: 'learn', element: S(<WfLearnHomePage />) },
  { path: 'learn/library', element: S(<WfLearnLibraryPage />) },
  { path: 'learn/practice', element: S(<WfLearnPracticePage />) },
  { path: 'learn/review', element: S(<WfLearnReviewPage />) },
  // Daily recitation (每日背诵) — login-gated card-stack recite flow.
  { path: 'learn/daily_recitation', element: S(<WfDailyRecitationPage />) },

  // Mine module
  { path: 'mine', element: S(<WfMineIndexPage />) },
  { path: 'mine/progress', element: S(<WfMineProgressPage />) },
  { path: 'mine/social', element: S(<WfMineSocialPage />) },

  // Reading / Flashcards (setup only — runners are immersive below)
  { path: 'reading_setup', element: S(<WfReadingSetupPage />) },
  { path: 'flashcard_setup', element: S(<WfFlashcardSetupPage />) },

  // Profile
  { path: 'profile', element: S(<WfProfileProfilePage />) },
  { path: 'profile_edit', element: S(<WfProfileEditPage />) },

  // Settings
  { path: 'settings', element: S(<WfSettingsIndexPage />) },
  { path: 'settings_lang', element: S(<WfSettingsLanguagePage />) },
  { path: 'settings_learning', element: S(<WfSettingsLearningPage />) },
  { path: 'settings_display', element: S(<WfSettingsDisplayPage />) },
  { path: 'settings_notifications', element: S(<WfSettingsNotificationsPage />) },
  { path: 'settings_data', element: S(<WfSettingsDataSyncPage />) },
  { path: 'settings_about', element: S(<WfSettingsAboutPage />) },
  { path: 'settings_statistics', element: S(<WfSettingsSystemStatisticsPage />) },
  { path: 'settings_api_server', element: S(<WfSettingsApiServerPage />) },
  { path: 'settings_privacy', element: S(<WfSettingsPrivacyPage />) },
  { path: 'settings_word_reading', element: S(<WfSettingsWordReadingPage />) },

  // Library / Vocabulary
  { path: 'courses', element: S(<WfLibraryCoursesPage />) },
  { path: 'group_management', element: S(<WfLibraryGroupManagementPage />) },
  { path: 'group_detail', element: S(<WfLibraryGroupDetailPage />) },
  { path: 'add_to_group', element: S(<WfLibraryAddToGroupPage />) },
  { path: 'recommendations', element: S(<WfLibraryRecommendationsPage />) },
  { path: 'course_detail', element: S(<WfLibraryCourseDetailPage />) },
  { path: 'word_detail', element: S(<WfLibraryWordDetailPage />) },
  { path: 'vocabulary_library/:id', element: S(<WfVocabularyLibraryDetailPage />) },

  // Public media content (books / subtitles) — browse + detail, both PUBLIC
  // (anonymous browsing; only add-to-group actions are auth-gated in-page).
  { path: 'library/media', element: S(<WfMediaLibraryPage />) },
  { path: 'library/media_detail', element: S(<WfMediaDetailPage />) },

  // Documents / Search
  { path: 'upload', element: S(<WfDocumentsUploadPage />) },
  { path: 'dictionary', element: S(<WfSearchDictionaryPage />) },

  // Social / Review
  { path: 'leaderboard', element: S(<WfSocialLeaderboardPage />) },
  { path: 'friends', element: S(<WfSocialFriendsPage />) },
  { path: 'review_dashboard', element: S(<WfReviewDashboardPage />) },

  // Playlist / History
  { path: 'playlist', element: S(<WfLearningPlaylistPage />) },
  { path: 'playlist_config', element: S(<WfLearningPlaylistConfigPage />) },
  { path: 'history', element: S(<WfStatsHistoryPage />) },

  // Tools
  { path: 'tools', element: S(<WfToolsIndexPage />) },
  { path: 'tools/dictionary', element: S(<WfToolsDictionaryPage />) },
  { path: 'tools/ai-assistant', element: S(<WfToolsAiAssistantPage />) },
  { path: 'tools/analytics', element: S(<WfToolsAnalyticsPage />) },
  { path: 'tools/personal-dictionary', element: S(<WfToolsPersonalDictionaryPage />) },
  { path: 'tools/vocabulary-browser', element: S(<WfToolsVocabularyBrowserPage />) },
  { path: 'tools/translation', element: S(<WfToolsTranslationToolsPage />) },
  { path: 'tools/tts', element: S(<WfToolsTtsToolsPage />) },
  { path: 'tools/article-processor', element: S(<WfToolsArticleProcessorPage />) },
];

/**
 * Full route table for the wordflow end (relative to /wordflow).
 * - Auth + immersive runners are top-level (fullscreen, no chrome).
 * - Everything else nests under <WfLayout/>.
 * - Unknown paths redirect to the wordflow home.
 */
export const WF_ROUTES: RouteObject[] = [
  // Auth (no chrome)
  { path: 'auth/login', element: S(<WfAuthLoginPage />) },
  { path: 'auth/forgot-password', element: S(<WfAuthForgotPasswordPage />) },
  { path: 'auth/reset-password', element: S(<WfAuthResetPasswordPage />) },

  // Immersive runners (fullscreen, no chrome)
  { path: 'reading_run', element: S(<WfReadingRunPage />) },
  { path: 'flashcard_run', element: S(<WfFlashcardRunPage />) },
  { path: 'quiz_run', element: S(<WfQuizRunPage />) },
  { path: 'listening_player', element: S(<WfListeningPlayerPage />) },
  { path: 'study_session', element: S(<WfLearningStudySessionPage />) },

  // Chrome layout + all non-immersive pages
  { element: <WfLayout />, children: LAYOUT_CHILDREN },

  // Fallback
  { path: '*', element: <Navigate to="/wordflow" replace /> },
];

export default WF_ROUTES;
