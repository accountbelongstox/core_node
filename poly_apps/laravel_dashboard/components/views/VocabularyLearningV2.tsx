import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  User,
  Settings,
  Upload,
  BarChart3,
  GraduationCap,
  FileText,
  LogOut,
  Menu,
  X as CloseIcon
} from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { commonClasses } from '../../styles/theme';

// Import sub-components
import VocabAuthModal from '../vocabulary/VocabAuthModal';
import SystemInitPanel from '../vocabulary/SystemInitPanel';
import UserInitWizard from '../vocabulary/UserInitWizard';
import LibraryBrowser from '../vocabulary/LibraryBrowser';
import LearningInterface from '../vocabulary/LearningInterface';
import DocUploadPanel from '../vocabulary/DocUploadPanel';

interface VocabularyLearningProps {
  lang?: Language;
}

type ViewMode =
  | 'auth'
  | 'system-init'
  | 'user-init'
  | 'library-browser'
  | 'learning'
  | 'upload'
  | 'statistics'
  | 'review'
  | 'settings';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  level?: string;
  progress?: number;
}

const VocabularyLearning: React.FC<VocabularyLearningProps> = ({ lang = 'en' }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('auth');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<any>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState(false);
  const [isUserInitialized, setIsUserInitialized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const t = TRANSLATIONS[lang].vocabulary;

  // Check authentication and initialization status on mount
  useEffect(() => {
    checkAuthStatus();
    checkSystemStatus();
  }, []);

  const checkAuthStatus = () => {
    // Check if user is logged in (from localStorage or session)
    const savedUser = localStorage.getItem('vocab_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setCurrentView('library-browser');
      } catch (error) {
        console.error('Failed to parse saved user:', error);
      }
    } else {
      setShowAuthModal(true);
    }
  };

  const checkSystemStatus = async () => {
    // Check if system is initialized
    const systemInit = localStorage.getItem('vocab_system_initialized');
    setIsSystemInitialized(systemInit === 'true');
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('vocab_user', JSON.stringify(user));
    setShowAuthModal(false);

    // Check if user needs initialization
    const userInit = localStorage.getItem(`vocab_user_init_${user.id}`);
    if (!userInit) {
      setCurrentView('user-init');
    } else {
      setCurrentView('library-browser');
    }
  };

  const handleSystemInitComplete = () => {
    setIsSystemInitialized(true);
    localStorage.setItem('vocab_system_initialized', 'true');
    if (currentUser) {
      setCurrentView('library-browser');
    } else {
      setShowAuthModal(true);
    }
  };

  const handleUserInitComplete = () => {
    if (currentUser) {
      setIsUserInitialized(true);
      localStorage.setItem(`vocab_user_init_${currentUser.id}`, 'true');
      setCurrentView('library-browser');
    }
  };

  const handleLibrarySelected = (library: any) => {
    setSelectedLibrary(library);
    setCurrentView('learning');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedLibrary(null);
    localStorage.removeItem('vocab_user');
    setCurrentView('auth');
    setShowAuthModal(true);
  };

  const handleBackToLibraries = () => {
    setSelectedLibrary(null);
    setCurrentView('library-browser');
  };

  // Navigation items
  const navigationItems = [
    { id: 'library-browser', icon: BookOpen, label: 'Libraries', requiresAuth: true },
    { id: 'learning', icon: GraduationCap, label: 'Learning', requiresAuth: true, disabled: !selectedLibrary },
    { id: 'upload', icon: Upload, label: 'Upload Docs', requiresAuth: true },
    { id: 'statistics', icon: BarChart3, label: 'Statistics', requiresAuth: true },
    { id: 'review', icon: FileText, label: 'Review', requiresAuth: true },
    { id: 'settings', icon: Settings, label: 'Settings', requiresAuth: true },
  ];

  const renderContent = () => {
    // System not initialized
    if (!isSystemInitialized) {
      return <SystemInitPanel onComplete={handleSystemInitComplete} />;
    }

    // User not authenticated
    if (!currentUser) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Please Sign In</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Sign in to access vocabulary learning features
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              Sign In
            </button>
          </div>
        </div>
      );
    }

    // User initialization
    if (!isUserInitialized && currentView === 'user-init') {
      return <UserInitWizard onComplete={handleUserInitComplete} />;
    }

    // Main content based on current view
    switch (currentView) {
      case 'library-browser':
        return <LibraryBrowser onLibrarySelected={handleLibrarySelected} />;

      case 'learning':
        return <LearningInterface onBack={handleBackToLibraries} />;

      case 'upload':
        return <DocUploadPanel onUploadComplete={(result) => {
          console.log('Upload complete:', result);
        }} />;

      case 'statistics':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Learning Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${commonClasses.card} p-6`}>
                <h3 className="text-lg font-semibold mb-2">Words Learned</h3>
                <p className="text-3xl font-bold text-indigo-600">247</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">+23 this week</p>
              </div>
              <div className={`${commonClasses.card} p-6`}>
                <h3 className="text-lg font-semibold mb-2">Study Time</h3>
                <p className="text-3xl font-bold text-green-600">12.5h</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">+2.3h this week</p>
              </div>
              <div className={`${commonClasses.card} p-6`}>
                <h3 className="text-lg font-semibold mb-2">Accuracy</h3>
                <p className="text-3xl font-bold text-blue-600">87%</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">+5% improvement</p>
              </div>
            </div>
            <div className={`${commonClasses.card} p-6 mt-6`}>
              <h3 className="text-lg font-semibold mb-4">Progress Chart</h3>
              <div className="h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                <p className="text-gray-500">Chart visualization (to be implemented)</p>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Review Mode</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Review words you've learned to reinforce your memory
            </p>
            <div className={`${commonClasses.card} p-6`}>
              <h3 className="text-lg font-semibold mb-4">Due for Review</h3>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div>
                      <p className="font-semibold">Word {i}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Last reviewed 3 days ago</p>
                    </div>
                    <button className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-sm`}>
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <div className={`${commonClasses.card} p-6 space-y-6`}>
              <div>
                <h3 className="text-lg font-semibold mb-3">Learning Preferences</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span>Daily Goal (words)</span>
                    <input
                      type="number"
                      defaultValue={20}
                      className={`${commonClasses.input} w-24`}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Review Interval (days)</span>
                    <input
                      type="number"
                      defaultValue={3}
                      className={`${commonClasses.input} w-24`}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Enable Audio</span>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Show Examples</span>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </label>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Account</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Username</p>
                    <p className="font-medium">{currentUser?.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                    <p className="font-medium">{currentUser?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white`}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <LibraryBrowser onLibrarySelected={handleLibrarySelected} />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      {currentUser && (
        <div
          className={`
            ${sidebarOpen ? 'w-64' : 'w-16'}
            transition-all duration-300 bg-white dark:bg-gray-800
            border-r border-gray-200 dark:border-gray-700
            flex flex-col
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {sidebarOpen && (
              <h2 className="font-semibold text-lg truncate">Vocabulary</h2>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {sidebarOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* User Info */}
          {sidebarOpen && currentUser && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{currentUser.username}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {currentUser.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-2 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isDisabled = item.disabled;

              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && setCurrentView(item.id as ViewMode)}
                  disabled={isDisabled}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1
                    transition-colors
                    ${isActive
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                      : isDisabled
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={sidebarOpen ? undefined : item.label}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          {sidebarOpen && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleLogout}
                className={`w-full ${commonClasses.button} bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2`}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <VocabAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
};

export default VocabularyLearning;
