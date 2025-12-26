import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, AppContext } from './contexts/AppContext';
import { Icons } from './components/UI';

// Styles
import './styles/theme.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/pages.css'; // NEW: Page-specific layouts
// Pages
import LoginPage from './pages/Auth/Login';
import DashboardPage from './pages/Dashboard/Home';
import StatsPage from './pages/Dashboard/Stats';
import ReadingSetupPage from './pages/Reading/Setup';
import ReadingRunPage from './pages/Reading/Run';
import ProfilePage from './pages/Profile/Profile';
import SettingsIndex from './pages/Settings/Index';
import LanguageSettings from './pages/Settings/Language';
import LearningSettings from './pages/Settings/Learning';
import DisplaySettings from './pages/Settings/Display';
import NotificationSettings from './pages/Settings/Notifications';
import DataSyncPage from './pages/Settings/DataSync';
import AboutPage from './pages/Settings/About';
import FlashcardRunPage from './pages/Flashcards/Run';
import CoursesPage from './pages/Library/Courses';
import CourseDetailPage from './pages/Library/CourseDetail';
import UploadPage from './pages/Documents/Upload';
import DictionaryPage from './pages/Search/Dictionary';
import LeaderboardPage from './pages/Social/Leaderboard';
import ReviewDashboardPage from './pages/Review/Dashboard';
import QuizRunPage from './pages/Quiz/Run';
import ListeningPlayerPage from './pages/Listening/Player';
import WordDetailPage from './pages/Library/WordDetail';
import PlaylistPage from './pages/Learning/Playlist';
import PlaylistConfigPage from './pages/Learning/PlaylistConfig';
import FriendsPage from './pages/Social/Friends';
import HistoryPage from './pages/Stats/History';
import { MuseView } from './components/MuseView';

// Router Component
const AppRouter = () => {
  const { currentPage, navigate, user } = useContext(AppContext);

  const renderPage = () => {
    switch(currentPage) {
      case 'login': return <LoginPage />;
      case 'home': return <DashboardPage />;
      case 'stats': return <StatsPage />;
      case 'reading_setup': return <ReadingSetupPage />;
      case 'reading_run': return <ReadingRunPage />;
      case 'flashcard_run': return <FlashcardRunPage />;
      case 'profile': return <ProfilePage />;
      case 'settings': return <SettingsIndex />;
      case 'settings_lang': return <LanguageSettings />;
      case 'settings_learning': return <LearningSettings />;
      case 'settings_display': return <DisplaySettings />;
      case 'settings_notifications': return <NotificationSettings />;
      case 'settings_data': return <DataSyncPage />;
      case 'settings_about': return <AboutPage />;
      case 'courses': return <CoursesPage />;
      case 'course_detail': return <CourseDetailPage />;
      case 'upload': return <UploadPage />;
      case 'dictionary': return <DictionaryPage />;
      case 'leaderboard': return <LeaderboardPage />;
      case 'flashcard_setup': return <ReadingSetupPage />; 
      case 'settings_privacy': return <AboutPage />;
      case 'review_dashboard': return <ReviewDashboardPage />;
      case 'quiz_run': return <QuizRunPage />;
      case 'listening_player': return <ListeningPlayerPage />;
      case 'word_detail': return <WordDetailPage />;
      case 'playlist': return <PlaylistPage />;
      case 'playlist_config': return <PlaylistConfigPage />;
      case 'friends': return <FriendsPage />;
      case 'history': return <HistoryPage />;
      case 'muse': return <MuseView />;
      default: return <DashboardPage />;
    }
  };

  const isImmersive = ['reading_run', 'flashcard_run', 'quiz_run', 'listening_player', 'playlist'].includes(currentPage);
  const showDock = user && !isImmersive;

  return (
    <div className="app-root-container">
      {/* 
         LAYOUT FIX: 
         Changed main to overflow-hidden. 
         Pages must handle their own overflow-y-auto to allow fixed headers/elements to work properly relative to the viewport.
      */}
      <main className="app-main-content">
        {renderPage()}
      </main>
      
      {/* Premium Glass Dock */}
      {showDock && (
          <div className="dock-container animate-slide-up">
            <div className="dock-glass">
              <button 
                onClick={() => navigate('home')} 
                className={`dock-item ${currentPage === 'home' ? 'active' : ''}`}
              >
                <Icons.Home />
              </button>
              
              <button 
                onClick={() => navigate('muse')} 
                className={`dock-item ${currentPage === 'muse' ? 'active' : ''}`}
              >
                <span className="dock-muse-icon">M</span>
              </button>
              
              {/* Floating Action Button (FAB) */}
              <button 
                onClick={() => navigate('reading_setup')} 
                className="dock-fab"
              >
                <Icons.Sparkles style={{ width: '2rem', height: '2rem' }} />
              </button>
              
              <button 
                onClick={() => navigate('quiz_run')} 
                className={`dock-item ${currentPage === 'quiz_run' ? 'active' : ''}`}
              >
                <span className="dock-quiz-icon">?</span>
              </button>
              
              <button 
                onClick={() => navigate('settings')} 
                className={`dock-item ${currentPage.startsWith('settings') ? 'active' : ''}`}
              >
                <Icons.Settings />
              </button>
            </div>
          </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppProvider>
    <AppRouter />
  </AppProvider>
);
