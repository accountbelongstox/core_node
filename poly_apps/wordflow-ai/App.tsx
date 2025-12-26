import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatMode from './components/ChatMode';
import ImageMode from './components/ImageMode';
import VisionMode from './components/VisionMode';
import { AppMode } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.CHAT);

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.CHAT:
        return <ChatMode />;
      case AppMode.IMAGE:
        return <ImageMode />;
      case AppMode.VISION:
        return <VisionMode />;
      default:
        return <ChatMode />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      <Sidebar currentMode={currentMode} onModeChange={setCurrentMode} />
      
      <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-slate-950">
        <div className="flex-1 flex flex-col min-w-0 h-full">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;