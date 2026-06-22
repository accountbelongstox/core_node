import React, { createContext, useContext, useState, useCallback } from 'react';

export interface TopBarOverrides {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

interface AppLayoutContextValue {
  topBarOverrides: TopBarOverrides | null;
  setTopBarOverrides: (v: TopBarOverrides | null) => void;
}

const AppLayoutContext = createContext<AppLayoutContextValue | null>(null);

export function AppLayoutProvider({ children }: { children: React.ReactNode }) {
  const [topBarOverrides, setTopBarOverrides] = useState<TopBarOverrides | null>(null);
  return (
    <AppLayoutContext.Provider value={{ topBarOverrides, setTopBarOverrides }}>
      {children}
    </AppLayoutContext.Provider>
  );
}

export function useTopBarOverrides() {
  const ctx = useContext(AppLayoutContext);
  return ctx?.setTopBarOverrides ?? (() => {});
}

export function useTopBarOverridesState() {
  const ctx = useContext(AppLayoutContext);
  return ctx?.topBarOverrides ?? null;
}
