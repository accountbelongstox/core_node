import React from 'react';
import {
  AboutScreen,
  CourseDetailScreen,
  CoursesScreen,
  DataSyncScreen,
  DictionaryScreen,
  DisplaySettingsScreen,
  FriendsScreen,
  HistoryScreen,
  LanguageSettingsScreen,
  LeaderboardScreen,
  LearningSettingsScreen,
  ListeningPlayerScreen,
  LoginScreen,
  NotificationSettingsScreen,
  PlaylistConfigScreen,
  PlaylistScreen,
  ProfileScreen,
  QuizRunScreen,
  ReadingRunScreen,
  ReadingSetupScreen,
  ReviewDashboardScreen,
  SettingsIndexScreen,
  StatsScreen,
  UploadScreen,
  WordDetailScreen,
  FlashcardRunScreen,
  DashboardScreen,
} from '../screens/Screens';
import { useAppContext } from '../state/AppContext';

export const AppRouter = () => {
  const { currentPage } = useAppContext();

  switch (currentPage) {
    case 'login':
      return <LoginScreen />;
    case 'home':
      return <DashboardScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'reading_setup':
      return <ReadingSetupScreen />;
    case 'reading_run':
      return <ReadingRunScreen />;
    case 'flashcard_run':
      return <FlashcardRunScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'settings':
      return <SettingsIndexScreen />;
    case 'settings_lang':
      return <LanguageSettingsScreen />;
    case 'settings_learning':
      return <LearningSettingsScreen />;
    case 'settings_display':
      return <DisplaySettingsScreen />;
    case 'settings_notifications':
      return <NotificationSettingsScreen />;
    case 'settings_data':
      return <DataSyncScreen />;
    case 'settings_about':
      return <AboutScreen />;
    case 'courses':
      return <CoursesScreen />;
    case 'course_detail':
      return <CourseDetailScreen />;
    case 'upload':
      return <UploadScreen />;
    case 'dictionary':
      return <DictionaryScreen />;
    case 'leaderboard':
      return <LeaderboardScreen />;
    case 'review_dashboard':
      return <ReviewDashboardScreen />;
    case 'quiz_run':
      return <QuizRunScreen />;
    case 'listening_player':
      return <ListeningPlayerScreen />;
    case 'word_detail':
      return <WordDetailScreen />;
    case 'playlist':
      return <PlaylistScreen />;
    case 'playlist_config':
      return <PlaylistConfigScreen />;
    case 'friends':
      return <FriendsScreen />;
    case 'history':
      return <HistoryScreen />;
    default:
      return <DashboardScreen />;
  }
};
