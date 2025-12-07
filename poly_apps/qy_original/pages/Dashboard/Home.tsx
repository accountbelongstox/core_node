
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { Header } from '../../components/Header';
import { api } from '../../services/api';
import { WordGroup } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';

const DashboardPage = () => {
  const { user, navigate, t, activeGroupId } = useContext(AppContext);
  const [activeGroup, setActiveGroup] = useState<WordGroup | null>(null);

  useEffect(() => {
    if (user) {
      api.getWordGroups().then(groups => {
          const found = groups.find(g => g.id === activeGroupId) || groups[0];
          setActiveGroup(found);
      });
    }
  }, [user, activeGroupId]);
  
  const handleProtectedAction = (action: () => void) => {
      if (user) {
          action();
      } else {
          if (window.confirm("Account required for this feature. Login now?")) {
              navigate('login');
          }
      }
  };

  const currentLangCode = user?.learningLanguages?.[0] || 'en';
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="page-container">
      <Header />
      
      {/* Scrollable Content Container */}
      <div className="page-content-scroll">
        
        {/* Welcome Section */}
        <div className="dashboard-hero">
            <span className="dashboard-hero-label">
                 {user ? t('start_learning') : 'Guest Mode'}
            </span>
            <h1 className="text-3xl hero-title text-gradient-primary">
                {user ? `Hi, ${user.name.split(' ')[0]}` : 'Welcome Guest'}
            </h1>
        </div>

        {/* Language Selection Bar */}
        <div className="app-card language-selector-bar">
             <div className="language-selector-content">
                 <span className="language-flag">{currentLang.flag}</span>
                 <div>
                     <div className="language-label">Target</div>
                     <div className="language-name">{currentLang.name}</div>
                 </div>
             </div>
             <button 
                onClick={() => navigate('settings_lang')}
                className="language-settings-btn"
             >
                 <Icons.Settings />
             </button>
        </div>

        {/* Library / Active Course Section */}
        <div className="dashboard-section">
            <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                    {user ? 'Current Course' : 'Library'}
                </h2>
                <button 
                    onClick={() => handleProtectedAction(() => navigate('courses'))} 
                    className="dashboard-section-action"
                >
                    + Library
                </button>
            </div>

            {user ? (
                <div 
                    onClick={() => navigate('course_detail', { groupId: activeGroupId })}
                    className="app-card interactive active-course-card"
                >
                    <div className="active-course-content">
                        <div className="course-cover-icon">
                            {activeGroup?.coverImage || '📚'}
                        </div>
                        <div className="course-info">
                            <span className="course-name">
                                {activeGroup?.name || 'Loading...'}
                            </span>
                            <div className="course-progress-wrapper">
                               <div className="progress-track">
                                   <div className="progress-fill" style={{width: `${activeGroup?.progress || 0}%`}}></div>
                               </div>
                               <div className="course-progress-stats">
                                  <span className="progress-stat">{activeGroup?.progress}% Done</span>
                                  <span className="progress-stat">{activeGroup?.count} words</span>
                               </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div 
                    onClick={() => handleProtectedAction(() => {})}
                    className="app-card interactive empty-course-card"
                >
                    <div className="empty-course-icon">
                        <Icons.Book />
                    </div>
                    <span className="empty-course-text">Select a Word Bank to Start</span>
                </div>
            )}
        </div>

        {/* Study Modes Grid */}
        <div className="dashboard-section">
            <h2 className="dashboard-section-title">Study Center</h2>
            
            {/* Playlist Mode (Full Width) */}
            <div 
                onClick={() => handleProtectedAction(() => navigate('playlist', { groupId: activeGroupId }))} 
                className="app-card interactive mode-playlist"
            >
                <div>
                    <span className="mode-badge">RECOMMENDED</span>
                    <h3 className="mode-title">Smart Playlist</h3>
                    <p className="mode-description">Auto-play & Instant Review</p>
                </div>
                <div className="mode-play-icon">
                    {user ? '▶' : <Icons.Lock />}
                </div>
            </div>

            <div className="study-grid">
                {/* Flashcards */}
                <div 
                    onClick={() => handleProtectedAction(() => navigate('flashcard_run', { groupId: activeGroupId }))} 
                    className="app-card interactive study-mode-card mode-flashcard"
                >
                    <div className="study-mode-icon mode-flashcard-icon">Aa</div>
                    <div>
                        <div className="study-mode-name">Flashcards</div>
                        <div className="study-mode-subtitle">Spaced Repetition</div>
                    </div>
                </div>

                {/* Reading Flow */}
                <div 
                    onClick={() => handleProtectedAction(() => navigate('reading_run', { groupId: activeGroupId }))} 
                    className="app-card interactive study-mode-card mode-reading"
                >
                    <div className="study-mode-icon mode-reading-icon"><Icons.Book /></div>
                    <div>
                        <div className="study-mode-name">Reading</div>
                        <div className="study-mode-subtitle">Flow Context</div>
                    </div>
                </div>
                
                {/* Quiz Mode */}
                <div 
                    onClick={() => handleProtectedAction(() => navigate('quiz_run', { groupId: activeGroupId }))} 
                    className="app-card interactive study-mode-card mode-quiz"
                >
                    <div className="study-mode-icon mode-quiz-icon">?</div>
                    <div>
                        <div className="study-mode-name">Quiz</div>
                        <div className="study-mode-subtitle">Gamified Test</div>
                    </div>
                </div>

                {/* Passive Listening */}
                <div 
                    onClick={() => handleProtectedAction(() => navigate('listening_player', { groupId: activeGroupId }))} 
                    className="app-card interactive study-mode-card mode-passive"
                >
                    <div className="study-mode-icon mode-passive-icon">🎧</div>
                    <div>
                        <div className="study-mode-name">Passive</div>
                        <div className="study-mode-subtitle">Audio Loop</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Progress Section */}
        <div>
            <h2 className="dashboard-section-title">My Stats</h2>
            
            {user ? (
                <div className="study-grid">
                   <div onClick={() => navigate('stats')} className="app-card interactive stat-card">
                      <div className="stat-icon">🔥</div>
                      <div className="stat-value">{user.streak || 0} Days</div>
                      <div className="stat-label">Current Streak</div>
                   </div>
                   <div onClick={() => navigate('review_dashboard')} className="app-card interactive stat-card">
                      <div className="stat-icon">🧠</div>
                      <div className="stat-value">85%</div>
                      <div className="stat-label">Retention Rate</div>
                   </div>
                </div>
            ) : (
                <div className="app-card sync-progress-card">
                    <h3 className="sync-progress-title">Sync Your Progress</h3>
                    <p className="sync-progress-text">Login to save your streaks and vocabulary.</p>
                    <button onClick={() => navigate('login')} className="app-btn app-btn-primary">
                        Login Now
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
