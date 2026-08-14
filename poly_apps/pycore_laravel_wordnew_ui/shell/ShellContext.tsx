import { createContext, useContext } from 'react';
import { ShellContextValue } from './shellTypes';

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within <ShellProvider>');
  return ctx;
}
