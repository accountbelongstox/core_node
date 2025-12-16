
import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, AppContext } from './contexts/AppContext';
import { Icons } from './components/UI';
import { Sparkles } from 'lucide-react'; // Import Lucide icon directly for stability

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
import ApiServerSettings from './pages/Settings/ApiServer';
// New Pages
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
      case 'settings_api_server': return <ApiServerSettings />;
      case 'courses': return <CoursesPage />;
      case 'course_detail': return <CourseDetailPage />;
      case 'upload': return <UploadPage />;
      case 'dictionary': return <DictionaryPage />;
      case 'leaderboard': return <LeaderboardPage />;
      case 'flashcard_setup': return <ReadingSetupPage />; 
      case 'settings_privacy': return <AboutPage />;
      // New Routes
      case 'review_dashboard': return <ReviewDashboardPage />;
      case 'quiz_run': return <QuizRunPage />;
      case 'listening_player': return <ListeningPlayerPage />;
      case 'word_detail': return <WordDetailPage />;
      case 'playlist': return <PlaylistPage />;
      case 'playlist_config': return <PlaylistConfigPage />;
      case 'friends': return <FriendsPage />;
      case 'history': return <HistoryPage />;
      default: return <DashboardPage />;
    }
  };

  const isImmersive = ['reading_run', 'flashcard_run', 'quiz_run', 'listening_player'].includes(currentPage);
  const showDock = user && !isImmersive;

  return (
    <div className="h-full w-full max-w-md mx-auto relative flex flex-col bg-transparent overflow-hidden">
      <main className="flex-1 relative z-10 overflow-hidden">
        {renderPage()}
      </main>
      
      {/* Premium Glass Dock */}
      {showDock && (
          <div className="absolute bottom-6 left-6 right-6 z-50 pointer-events-none">
            {/* Dock Container - Pointer events auto to allow clicking buttons */}
            <div className="pointer-events-auto relative holo-card rounded-[2rem] px-5 py-3 flex justify-between items-center shadow-2xl border border-white/60 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80">
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
              
              {/* Floating Action Button (FAB) */}
              {/* Using absolute positioning relative to the dock to escape overflow clipping if any */}
              <div className="relative -top-8">
                  <button 
                    onClick={() => navigate('reading_setup')} 
                    className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white w-16 h-16 rounded-2xl shadow-lg shadow-blue-500/40 border-[4px] border-[#f8fafc] dark:border-slate-950 active:scale-95 transition-transform flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </button>
              </div>
              
              <button 
                onClick={() => navigate('quiz_run')} 
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPage === 'quiz_run' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="font-bold text-lg">?</span>
              </button>
              <button 
                onClick={() => navigate('settings')} 
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPage.startsWith('settings') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
