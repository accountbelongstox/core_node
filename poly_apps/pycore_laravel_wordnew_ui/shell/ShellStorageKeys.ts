import { registerLocalDataGroups } from '../core/persistence/LocalDataRegistry';

export const ShellStorageKeys = {
  DARK: 'shell_dark',
  LANGUAGE: 'shell_lang',
  THEME_OVERRIDE: 'shell_theme_override',
  DOCK_Y: 'shell_dock_y',
  CLOUD_CLIPBOARD: 'shell_cloud_clipboard',
  LAUNCH_SEEN_PREFIX: 'shell_launch_seen_',
  APP_UPDATE_CHECKED_AT: 'shell_app_update_checked_at',
  APP_UPDATE_DISMISSED_CODE: 'shell_app_update_dismissed_code',
} as const;

registerLocalDataGroups([
  {
    id: 'shell.cloud_clipboard',
    appId: 'shell',
    labelKey: 'common.local_data.groups.shell_cloud_clipboard',
    descriptionKey: 'common.local_data.groups.shell_cloud_clipboard_desc',
    clearable: true,
    sources: [{ kind: 'localStorage', keys: [ShellStorageKeys.CLOUD_CLIPBOARD] }],
  },
  {
    id: 'shell.preferences',
    appId: 'shell',
    labelKey: 'common.local_data.groups.shell_preferences',
    descriptionKey: 'common.local_data.groups.shell_preferences_desc',
    clearable: true,
    sources: [{
      kind: 'localStorage',
      keys: [
        ShellStorageKeys.DARK,
        ShellStorageKeys.LANGUAGE,
        ShellStorageKeys.THEME_OVERRIDE,
        ShellStorageKeys.DOCK_Y,
        ShellStorageKeys.APP_UPDATE_CHECKED_AT,
        ShellStorageKeys.APP_UPDATE_DISMISSED_CODE,
      ],
      prefixes: [ShellStorageKeys.LAUNCH_SEEN_PREFIX],
    }],
  },
]);
