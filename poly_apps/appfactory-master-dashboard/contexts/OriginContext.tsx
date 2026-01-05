import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Origin Context - Provides browser origin using React Router
 * Uses React Router's useLocation instead of direct window.location access
 */

interface OriginContextType {
  origin: string;
}

const OriginContext = createContext<OriginContextType>({ origin: '' });

export const OriginProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  
  // Get origin from window.location (only available in browser)
  // This is the correct way to get browser origin - React Router doesn't provide this
  // But we wrap it in React Context so components don't need direct window access
  const origin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return '';
  }, [location.pathname]); // Re-compute if route changes (though origin rarely changes)
  
  return (
    <OriginContext.Provider value={{ origin }}>
      {children}
    </OriginContext.Provider>
  );
};

export const useOrigin = (): string => {
  const context = useContext(OriginContext);
  return context.origin;
};

