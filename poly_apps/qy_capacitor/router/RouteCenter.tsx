/**
 * Route Center - Unified Route Configuration
 * Centralized route management for the entire application
 */

import React from 'react';

// Pages - Auth
import LoginPage from '../pages/Auth/Login';
import ForgotPasswordPage from '../pages/Auth/ForgotPassword';
import ResetPasswordPage from '../pages/Auth/ResetPassword';

// Pages - Dashboard
import DashboardPage from '../pages/Dashboard/Home';
import StatsPage from '../pages/Dashboard/Stats';

// Pages - Reading
import ReadingSetupPage from '../pages/Reading/Setup';
import ReadingRunPage from '../pages/Reading/Run';

// Pages - Flashcards
import FlashcardRunPage from '../pages/Flashcards/Run';

// Pages - Profile
import ProfilePage from '../pages/Profile/Profile';
import ProfileEditPage from '../pages/Profile/ProfileEdit';

// Pages - Settings
import SettingsIndex from '../pages/Settings/Index';
import LanguageSettings from '../pages/Settings/Language';
import LearningSettings from '../pages/Settings/Learning';
import DisplaySettings from '../pages/Settings/Display';
import NotificationSettings from '../pages/Settings/Notifications';
import DataSyncPage from '../pages/Settings/DataSync';
import AboutPage from '../pages/Settings/About';
import SystemStatisticsPage from '../pages/Settings/SystemStatistics';
import ApiServerSettings from '../pages/Settings/ApiServer';

// Pages - Library
import CoursesPage from '../pages/Library/Courses';
import CourseDetailPage from '../pages/Library/CourseDetail';
import WordDetailPage from '../pages/Library/WordDetail';
import RecommendationsPage from '../pages/Library/Recommendations';

// Pages - Vocabulary
import VocabularyLibraryDetailPage from '../pages/Vocabulary/LibraryDetail';

// Pages - Documents
import UploadPage from '../pages/Documents/Upload';

// Pages - Search
import DictionaryPage from '../pages/Search/Dictionary';

// Pages - Social
import LeaderboardPage from '../pages/Social/Leaderboard';
import FriendsPage from '../pages/Social/Friends';

// Pages - Review
import ReviewDashboardPage from '../pages/Review/Dashboard';

// Pages - Quiz
import QuizRunPage from '../pages/Quiz/Run';

// Pages - Listening
import ListeningPlayerPage from '../pages/Listening/Player';

// Pages - Playlist
import PlaylistPage from '../pages/Learning/Playlist';
import PlaylistConfigPage from '../pages/Learning/PlaylistConfig';

// Pages - History
import HistoryPage from '../pages/Stats/History';

// Pages - Tools
import ToolsHubPage from '../pages/Tools/Index';
import ToolsDictionaryPage from '../pages/Tools/Dictionary';
import ToolsAIAssistantPage from '../pages/Tools/AIAssistant';
import ToolsAnalyticsPage from '../pages/Tools/Analytics';
import PersonalDictionaryPage from '../pages/Tools/PersonalDictionary';
import VocabularyBrowserPage from '../pages/Tools/VocabularyBrowser';
import TranslationToolsPage from '../pages/Tools/TranslationTools';
import TTSToolsPage from '../pages/Tools/TTSTools';
import ArticleProcessorPage from '../pages/Tools/ArticleProcessor';

// Pages - Learn Module (New Design)
import LearnHomePage from '../pages/Learn/Home';
import LearnLibraryPage from '../pages/Learn/Library';
import LearnPracticePage from '../pages/Learn/Practice';
import LearnReviewPage from '../pages/Learn/Review';

// Pages - Mine Module (New Design)
import MineIndexPage from '../pages/Mine/Index';
import MineProgressPage from '../pages/Mine/Progress';
import MineSocialPage from '../pages/Mine/Social';

/**
 * Route Configuration Interface
 */
export interface RouteConfig {
  path: string;
  element: React.ReactElement;
  name: string;
  category: string;
  isProtected?: boolean;
  isImmersive?: boolean;
}

/**
 * Unified Route Registry
 * All routes are registered here for centralized management
 */
export const ROUTE_REGISTRY: RouteConfig[] = [
  // Auth Routes
  {
    path: '/login',
    element: <LoginPage />,
    name: 'Login',
    category: 'auth',
    isProtected: false,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    name: 'Forgot Password',
    category: 'auth',
    isProtected: false,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
    name: 'Reset Password',
    category: 'auth',
    isProtected: false,
  },

  // Dashboard Routes
  {
    path: '/',
    element: <DashboardPage />,
    name: 'Home Dashboard',
    category: 'dashboard',
    isProtected: false,
  },
  {
    path: '/home',
    element: <DashboardPage />,
    name: 'Home',
    category: 'dashboard',
    isProtected: false,
  },
  {
    path: '/dashboard',
    element: <DashboardPage />,
    name: 'Dashboard',
    category: 'dashboard',
    isProtected: false,
  },
  {
    path: '/stats',
    element: <StatsPage />,
    name: 'Stats',
    category: 'dashboard',
    isProtected: true,
  },

  // Learn Module Routes (New Design)
  {
    path: '/learn/home',
    element: <LearnHomePage />,
    name: 'Learn Home',
    category: 'learn',
    isProtected: false,
  },
  {
    path: '/learn/library',
    element: <LearnLibraryPage />,
    name: 'Learn Library',
    category: 'learn',
    isProtected: false,
  },
  {
    path: '/learn/practice',
    element: <LearnPracticePage />,
    name: 'Learn Practice',
    category: 'learn',
    isProtected: false,
  },
  {
    path: '/learn/review',
    element: <LearnReviewPage />,
    name: 'Learn Review',
    category: 'learn',
    isProtected: true,
  },

  // Mine Module Routes (New Design)
  {
    path: '/mine',
    element: <MineIndexPage />,
    name: 'Mine Center',
    category: 'mine',
    isProtected: false,
  },
  {
    path: '/mine/progress',
    element: <MineProgressPage />,
    name: 'Learning Progress',
    category: 'mine',
    isProtected: true,
  },
  {
    path: '/mine/social',
    element: <MineSocialPage />,
    name: 'Social Center',
    category: 'mine',
    isProtected: true,
  },

  // Reading Routes
  {
    path: '/reading_setup',
    element: <ReadingSetupPage />,
    name: 'Reading Setup',
    category: 'learning',
    isProtected: true,
  },
  {
    path: '/reading_run',
    element: <ReadingRunPage />,
    name: 'Reading Run',
    category: 'learning',
    isProtected: true,
    isImmersive: true,
  },

  // Flashcard Routes
  {
    path: '/flashcard_setup',
    element: <ReadingSetupPage />,
    name: 'Flashcard Setup',
    category: 'learning',
    isProtected: true,
  },
  {
    path: '/flashcard_run',
    element: <FlashcardRunPage />,
    name: 'Flashcard Run',
    category: 'learning',
    isProtected: true,
    isImmersive: true,
  },

  // Profile Routes
  {
    path: '/profile',
    element: <ProfilePage />,
    name: 'Profile',
    category: 'user',
    isProtected: true,
  },
  {
    path: '/profile_edit',
    element: <ProfileEditPage />,
    name: 'Edit Profile',
    category: 'user',
    isProtected: true,
  },

  // Settings Routes
  {
    path: '/settings',
    element: <SettingsIndex />,
    name: 'Settings',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_lang',
    element: <LanguageSettings />,
    name: 'Language Settings',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_learning',
    element: <LearningSettings />,
    name: 'Learning Settings',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_display',
    element: <DisplaySettings />,
    name: 'Display Settings',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_notifications',
    element: <NotificationSettings />,
    name: 'Notification Settings',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_data',
    element: <DataSyncPage />,
    name: 'Data Sync',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_about',
    element: <AboutPage />,
    name: 'About',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_statistics',
    element: <SystemStatisticsPage />,
    name: 'System Statistics',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_api_server',
    element: <ApiServerSettings />,
    name: 'API Server Settings',
    category: 'settings',
    isProtected: true,
  },
  {
    path: '/settings_privacy',
    element: <AboutPage />,
    name: 'Privacy',
    category: 'settings',
    isProtected: true,
  },

  // Library Routes
  {
    path: '/courses',
    element: <CoursesPage />,
    name: 'Courses',
    category: 'library',
    isProtected: true,
  },
  {
    path: '/group_management',
    element: <CoursesPage />,
    name: 'Group Management',
    category: 'library',
    isProtected: true,
  },
  {
    path: '/recommendations',
    element: <RecommendationsPage />,
    name: 'Recommendations',
    category: 'library',
    isProtected: true,
  },
  {
    path: '/course_detail',
    element: <CourseDetailPage />,
    name: 'Course Detail',
    category: 'library',
    isProtected: true,
  },
  {
    path: '/word_detail',
    element: <WordDetailPage />,
    name: 'Word Detail',
    category: 'library',
    isProtected: true,
  },
  {
    path: '/vocabulary_library/:id',
    element: <VocabularyLibraryDetailPage />,
    name: 'Vocabulary Library Detail',
    category: 'library',
    isProtected: false,
  },

  // Documents Routes
  {
    path: '/upload',
    element: <UploadPage />,
    name: 'Upload',
    category: 'documents',
    isProtected: true,
  },

  // Search Routes
  {
    path: '/dictionary',
    element: <DictionaryPage />,
    name: 'Dictionary',
    category: 'search',
    isProtected: true,
  },

  // Social Routes
  {
    path: '/leaderboard',
    element: <LeaderboardPage />,
    name: 'Leaderboard',
    category: 'social',
    isProtected: true,
  },
  {
    path: '/friends',
    element: <FriendsPage />,
    name: 'Friends',
    category: 'social',
    isProtected: true,
  },

  // Review Routes
  {
    path: '/review_dashboard',
    element: <ReviewDashboardPage />,
    name: 'Review Dashboard',
    category: 'learning',
    isProtected: true,
  },

  // Quiz Routes
  {
    path: '/quiz_run',
    element: <QuizRunPage />,
    name: 'Quiz',
    category: 'learning',
    isProtected: true,
    isImmersive: true,
  },

  // Listening Routes
  {
    path: '/listening_player',
    element: <ListeningPlayerPage />,
    name: 'Listening Player',
    category: 'learning',
    isProtected: true,
    isImmersive: true,
  },

  // Playlist Routes
  {
    path: '/playlist',
    element: <PlaylistPage />,
    name: 'Playlist',
    category: 'learning',
    isProtected: true,
  },
  {
    path: '/playlist_config',
    element: <PlaylistConfigPage />,
    name: 'Playlist Config',
    category: 'learning',
    isProtected: true,
  },

  // History Routes
  {
    path: '/history',
    element: <HistoryPage />,
    name: 'History',
    category: 'stats',
    isProtected: true,
  },

  // Tools Routes
  {
    path: '/tools',
    element: <ToolsHubPage />,
    name: 'Tools Hub',
    category: 'tools',
    isProtected: true,
  },
  {
    path: '/tools/dictionary',
    element: <ToolsDictionaryPage />,
    name: 'Smart Dictionary',
    category: 'tools',
    isProtected: false,
  },
  {
    path: '/tools/ai-assistant',
    element: <ToolsAIAssistantPage />,
    name: 'AI Assistant',
    category: 'tools',
    isProtected: false,
  },
  {
    path: '/tools/analytics',
    element: <ToolsAnalyticsPage />,
    name: 'Learning Analytics',
    category: 'tools',
    isProtected: true,
  },
  {
    path: '/tools/personal-dictionary',
    element: <PersonalDictionaryPage />,
    name: 'Personal Dictionary',
    category: 'tools',
    isProtected: true,
  },
  {
    path: '/tools/vocabulary-browser',
    element: <VocabularyBrowserPage />,
    name: 'Vocabulary Browser',
    category: 'tools',
    isProtected: true,
  },
  {
    path: '/tools/translation',
    element: <TranslationToolsPage />,
    name: 'Translation Tools',
    category: 'tools',
    isProtected: true,
  },
  {
    path: '/tools/tts',
    element: <TTSToolsPage />,
    name: 'TTS Tools',
    category: 'tools',
    isProtected: true,
  },
  {
    path: '/tools/article-processor',
    element: <ArticleProcessorPage />,
    name: 'Article Processor',
    category: 'tools',
    isProtected: true,
  },
];

/**
 * Helper functions for route management
 */
export class RouteCenter {
  /**
   * Get all routes
   */
  static getAllRoutes(): RouteConfig[] {
    return ROUTE_REGISTRY;
  }

  /**
   * Get routes by category
   */
  static getRoutesByCategory(category: string): RouteConfig[] {
    return ROUTE_REGISTRY.filter((route) => route.category === category);
  }

  /**
   * Get route by path
   */
  static getRouteByPath(path: string): RouteConfig | undefined {
    return ROUTE_REGISTRY.find((route) => route.path === path);
  }

  /**
   * Check if route is immersive
   */
  static isImmersiveRoute(path: string): boolean {
    const route = this.getRouteByPath(path);
    return route?.isImmersive || false;
  }

  /**
   * Check if route is protected
   */
  static isProtectedRoute(path: string): boolean {
    const route = this.getRouteByPath(path);
    return route?.isProtected !== false; // Default to true
  }

  /**
   * Get all immersive route paths
   */
  static getImmersiveRoutePaths(): string[] {
    return ROUTE_REGISTRY.filter((route) => route.isImmersive).map((route) => route.path);
  }

  /**
   * Get route name by path
   */
  static getRouteName(path: string): string {
    const route = this.getRouteByPath(path);
    return route?.name || 'Unknown';
  }
}
