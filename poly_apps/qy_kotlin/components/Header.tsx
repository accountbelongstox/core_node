import React, { useState, useEffect, useContext, useRef } from 'react';
import { Icons } from './Icons';
import { AppContext } from '../contexts/AppContext';

export const Header = ({ title }: { title?: string }) => {
  const { user, navigate } = useContext(AppContext);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setIsSearchOpen(false);
      navigate('dictionary');
  };

  return (
    <>
        {/* Dynamic Island Header Positioned via CSS */}
        <div className="header-island-wrapper">
            <div className={`aurora-header-island ${isSearchOpen ? 'header-search-open' : ''}`}>
                
                {!isSearchOpen ? (
                    <>
                        <button 
                            onClick={() => navigate(user ? 'profile' : 'login')} 
                            className="aurora-nav-btn"
                        >
                            {user ? (
                                <img src={user.avatar} alt="Profile" />
                            ) : (
                                <Icons.User />
                            )}
                        </button>

                        <div 
                            onClick={() => setIsSearchOpen(true)}
                            className="header-search-trigger"
                        >
                            <span className="header-search-icon"><Icons.Search /></span>
                            <span className="header-search-text">Search...</span>
                        </div>

                        <button 
                            onClick={() => navigate('settings')}
                            className="aurora-nav-btn header-settings-btn"
                        >
                            <Icons.Settings />
                        </button>
                    </>
                ) : (
                    <div className="header-search-active">
                        <span className="header-search-icon"><Icons.Search /></span>
                        <form onSubmit={handleSearchSubmit} className="header-search-form">
                            <input 
                                ref={inputRef}
                                className="aurora-search-input"
                                placeholder="Type to search..."
                                onBlur={() => !inputRef.current?.value && setIsSearchOpen(false)}
                            />
                        </form>
                        <button onClick={() => setIsSearchOpen(false)} className="aurora-nav-btn header-close-btn">
                            <Icons.Close />
                        </button>
                    </div>
                )}
            </div>
        </div>
    </>
  );
};
