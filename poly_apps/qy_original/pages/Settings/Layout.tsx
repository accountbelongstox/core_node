import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

export const SettingsLayout = ({ title, children }: any) => {
  const { navigate } = useContext(AppContext);
  return (
    <div className="settings-layout-page animate-slide-up">
      {/* Floating Island Header */}
      <div className="island-header-container">
          <div className="island-header">
              <button 
                onClick={() => navigate('settings')} 
                className="settings-back-btn"
              >
                <Icons.Back />
              </button>
              <h1 className="settings-subpage-title">{title}</h1>
          </div>
      </div>
      
      {/* Scrollable Content with Aurora Padding */}
      <div className="aurora-settings-layout">
        {children}
      </div>
    </div>
  );
};

export const SettingItem = ({ label, value, onClick, type = 'arrow', active = false }: any) => (
  <div 
    onClick={onClick} 
    className="settings-row"
  >
    <span className="settings-row-label">{label}</span>
    
    <div className="settings-row-control">
      {value && <span className="settings-row-value">{value}</span>}
      
      {type === 'arrow' && <div className="settings-row-arrow"><Icons.ChevronRight /></div>}
      
      {type === 'toggle' && (
        <div className={`settings-toggle ${active ? 'active' : ''}`}>
          <div className={`settings-toggle-thumb ${active ? 'active' : ''}`} />
        </div>
      )}
      
      {type === 'radio' && (
        <div className={`settings-radio ${active ? 'active' : ''}`}>
          <div className={`settings-radio-dot ${active ? 'active' : ''}`} />
        </div>
      )}
    </div>
  </div>
);
