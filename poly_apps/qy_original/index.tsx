<<<<<<< HEAD

=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, AppContext } from './contexts/AppContext';
import { Icons } from './components/UI';

<<<<<<< HEAD
=======
// Styles
import './styles/theme.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/pages.css'; // NEW: Page-specific layouts

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
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
<<<<<<< HEAD
// New Pages
=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
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
<<<<<<< HEAD
=======
import { MuseView } from './components/MuseView';
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798

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
<<<<<<< HEAD
      // New Routes
=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
      case 'review_dashboard': return <ReviewDashboardPage />;
      case 'quiz_run': return <QuizRunPage />;
      case 'listening_player': return <ListeningPlayerPage />;
      case 'word_detail': return <WordDetailPage />;
      case 'playlist': return <PlaylistPage />;
      case 'playlist_config': return <PlaylistConfigPage />;
      case 'friends': return <FriendsPage />;
      case 'history': return <HistoryPage />;
<<<<<<< HEAD
=======
      case 'muse': return <MuseView />;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
      default: return <DashboardPage />;
    }
  };

  const isImmersive = ['reading_run', 'flashcard_run', 'quiz_run', 'listening_player', 'playlist'].includes(currentPage);
<<<<<<< HEAD

  return (
    <div className="h-full w-full max-w-md mx-auto relative flex flex-col bg-transparent overflow-hidden">
      <main className="flex-1 overflow-hidden relative z-10">
=======
  const showDock = user && !isImmersive;

  return (
    <div className="app-root-container">
      {/* 
         LAYOUT FIX: 
         Changed main to overflow-hidden. 
         Pages must handle their own overflow-y-auto to allow fixed headers/elements to work properly relative to the viewport.
      */}
      <main className="app-main-content">
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        {renderPage()}
      </main>
      
      {/* Premium Glass Dock */}
<<<<<<< HEAD
      {user && !isImmersive && (
          <div className="absolute bottom-6 left-6 right-6 z-50">
            <div className="holo-card rounded-[2rem] px-5 py-3 flex justify-between items-center shadow-2xl border border-white/60 backdrop-blur-2xl bg-white/60 dark:bg-slate-900/60">
              <button 
                onClick={() => navigate('home')} 
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPage === 'home' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Icons.Home />
              </button>
              <button 
                onClick={() => navigate('playlist')} 
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPage === 'playlist' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="text-xl font-bold">▶</span>
              </button>
              
              {/* Floating Action Button */}
              <button 
                onClick={() => navigate('reading_setup')} 
                className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white w-14 h-14 rounded-2xl -mt-12 shadow-lg shadow-blue-500/40 border-[4px] border-[#f8fafc] dark:border-slate-900 active:scale-95 transition-transform flex items-center justify-center relative z-20"
              >
                <Icons.Play />
=======
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
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
              </button>
              
              <button 
                onClick={() => navigate('quiz_run')} 
<<<<<<< HEAD
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPage === 'quiz_run' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="font-bold text-lg">?</span>
              </button>
              <button 
                onClick={() => navigate('settings')} 
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPage.startsWith('settings') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
=======
                className={`dock-item ${currentPage === 'quiz_run' ? 'active' : ''}`}
              >
                <span className="dock-quiz-icon">?</span>
              </button>
              
              <button 
                onClick={() => navigate('settings')} 
                className={`dock-item ${currentPage.startsWith('settings') ? 'active' : ''}`}
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
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
<<<<<<< HEAD
);
=======
);
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
