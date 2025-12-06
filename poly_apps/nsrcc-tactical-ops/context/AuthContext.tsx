import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';

// --- Router Implementation ---
interface RouterContextType {
  path: string;
  navigate: (path: string | number) => void;
}

const RouterContext = createContext<RouterContextType>({ path: '/', navigate: () => {} });

export const HashRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getHashPath = () => window.location.hash.slice(1) || '/';
  const [path, setPath] = useState(getHashPath());

  useEffect(() => {
    const onHashChange = () => setPath(getHashPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (to: string | number) => {
    if (typeof to === 'number') {
      window.history.go(to);
    } else {
      window.location.hash = to;
    }
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useLocation = () => {
  const { path } = useContext(RouterContext);
  return { pathname: path };
};

export const useNavigate = () => {
  const { navigate } = useContext(RouterContext);
  return navigate;
};

export const Routes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { path } = useContext(RouterContext);
  let element = null;
  React.Children.forEach(children, (child) => {
    if (element) return;
    if (React.isValidElement(child)) {
      const props = child.props as { path?: string; element?: React.ReactNode };
      if (props.path === path) {
        element = props.element;
      }
    }
  });
  return <>{element}</>;
};

export const Route: React.FC<{ path: string; element: React.ReactNode }> = ({ element }) => {
  return <>{element}</>;
};

export const NavLink: React.FC<any> = ({ to, className, children, ...props }) => {
  const { path } = useContext(RouterContext);
  const isActive = path === to;
  const computedClassName = typeof className === 'function' ? className({ isActive }) : className;
  const computedChildren = typeof children === 'function' ? children({ isActive }) : children;
  
  return (
    <a href={`#${to}`} className={computedClassName} {...props}>
      {computedChildren}
    </a>
  );
};
// --- End Router ---

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const login = (name: string) => {
    setIsAuthenticated(true);
    // Default to VIP 1 as requested
    setUser({
      name: name,
      id: `五四射击体乐部-${Math.floor(Math.random() * 10000)}`,
      vipLevel: 1
    });
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};