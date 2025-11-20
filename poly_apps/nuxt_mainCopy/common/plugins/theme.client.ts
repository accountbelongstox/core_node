import { codemartTheme } from '@/app_codemart/theme_app_codemart/codemart-theme';
import { exampleTheme } from '@/app_example/theme_app_example/example-theme';
import { devTheme } from '@/app_dev/theme_app_dev/dev-theme';
import { adminTheme } from '@/app_admin/theme_app_admin/admin-theme';
import { dashboardTheme } from '@/app_dashboard/theme_app_dashboard/dashboard-theme';

export default defineNuxtPlugin(() => {
  const route = useRoute();

  const detectCurrentApp = () => {
    const path = route.path.toLowerCase();

    if (path.includes('codemart')) return 'codemart';
    if (path.includes('admin')) return 'admin';
    if (path.includes('example')) return 'example';
    if (path.includes('dev')) return 'dev';
    if (path.includes('dashboard')) return 'dashboard';

    return 'codemart';
  };

  const applyThemeForApp = (app: string) => {
    let theme;

    switch (app) {
      case 'codemart':
        theme = codemartTheme;
        break;
      case 'admin':
        theme = adminTheme;
        break;
      case 'example':
        theme = exampleTheme;
        break;
      case 'dev':
        theme = devTheme;
        break;
      case 'dashboard':
        theme = dashboardTheme;
        break;
      default:
        theme = codemartTheme;
    }

    theme.applyCSSVariables();
  };

  watch(() => route.path, () => {
    const currentApp = detectCurrentApp();
    applyThemeForApp(currentApp);
  }, { immediate: true });

  return {
    provide: {
      themes: {
        codemart: codemartTheme,
        admin: adminTheme,
        example: exampleTheme,
        dev: devTheme,
        dashboard: dashboardTheme,
      }
    }
  };
});
