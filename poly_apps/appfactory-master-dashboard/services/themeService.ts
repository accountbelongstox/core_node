/**
 * Theme Management Service
 * Provides centralized theme switching (dark/light mode)
 */

export type Theme = 'light' | 'dark';

/**
 * Theme Service Class
 */
class ThemeService {
  private currentTheme: Theme = 'light';
  private listeners: Set<() => void> = new Set();

  /**
   * Get current theme
   */
  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Set current theme
   */
  setTheme(theme: Theme): void {
    if (this.currentTheme !== theme) {
      this.currentTheme = theme;
      this.applyTheme(theme);
      this.notifyListeners();
    }
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Apply theme to DOM
   */
  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }

  /**
   * Initialize theme from storage or system preference
   */
  initializeTheme(savedTheme?: Theme): void {
    let theme = savedTheme;

    // If no saved theme, check system preference
    if (!theme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }

    this.setTheme(theme);
  }

  /**
   * Add theme change listener
   */
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove theme change listener
   */
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Export singleton
export const themeService = new ThemeService();
