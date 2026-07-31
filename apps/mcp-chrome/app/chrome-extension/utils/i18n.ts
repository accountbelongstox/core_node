import { localStorage } from '@/services/ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';

interface LocalePlaceholder {
  content: string;
}

interface LocaleMessage {
  message: string;
  placeholders?: Record<string, LocalePlaceholder>;
}

type LocaleMessages = Record<string, LocaleMessage>;

let userMessages: LocaleMessages = {};
let englishMessages: LocaleMessages = {};
let userLocale = '';

async function loadLocaleMessages(locale: string): Promise<LocaleMessages> {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const response = await fetch(url);
  const messages: LocaleMessages = {};
  const json: Record<string, LocaleMessage> = response.ok ? await response.json() : {};

  for (const key of Object.keys(json)) {
    const entry = json[key];
    if (entry && typeof entry.message === 'string') messages[key] = entry;
  }

  return messages;
}

function applySubstitutions(entry: LocaleMessage, substitutions?: string[]): string {
  let output = entry.message;
  const values = substitutions || [];
  const placeholders = entry.placeholders || {};

  values.forEach((value, index) => {
    output = output.split(`{${index}}`).join(value);
    output = output.split(`$${index + 1}`).join(value);
  });

  for (const [name, placeholder] of Object.entries(placeholders)) {
    const index = Number(placeholder.content.replaceAll('$', '')) - 1;
    const value = values[index];
    if (index < 0 || value === undefined) continue;
    output = output.split(`$${name}$`).join(value);
    output = output.split(`$${name.toUpperCase()}$`).join(value);
  }

  return output;
}

export async function loadUserLocale(): Promise<void> {
  try {
    const lang = await localStorage.get<string>(STORAGE_KEYS.USER_LANGUAGE, 'en');
    const [selected, english] = await Promise.all([
      loadLocaleMessages(lang),
      lang === 'en' ? Promise.resolve({}) : loadLocaleMessages('en'),
    ]);

    userLocale = lang;
    userMessages = selected;
    englishMessages = lang === 'en' ? selected : english;
  } catch (error) {
    console.warn('Failed to load user locale:', error);
    userMessages = {};
    englishMessages = {};
  }
}

export function getCurrentLocale(): string {
  return userLocale;
}

export function getMessage(key: string, substitutions?: string[]): string {
  const userEntry = userMessages[key];
  const englishEntry = englishMessages[key];

  if (userEntry) return applySubstitutions(userEntry, substitutions);
  if (englishEntry) return applySubstitutions(englishEntry, substitutions);

  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) return message;
    }
  } catch (error) {
    console.warn(`Failed to get i18n message for key "${key}":`, error);
  }

  return key;
}

export function isI18nAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' && typeof chrome.i18n?.getMessage === 'function';
  } catch {
    return false;
  }
}
