// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const { EventEmitter } = require('events');
const userSettingsInstance = require('#@/ncore/global_vars/libs/user_settings.js');

const PATH_SEPARATOR = '.';
const CLONEABLE_TYPES = ['object', 'array'];
const SETTINGS_NAMESPACE_DEFAULT = 'settings';
const THEME_NAMESPACE_DEFAULT = 'ui.theme';
const DATA_NAMESPACE_DEFAULT = 'dataCenter';
const DEFAULT_THEME_DEFINITIONS = {
    light: {
        palette: {
            primary: '#1f64ff',
            background: '#ffffff',
            surface: '#f5f7fb',
            text: '#1f1f1f',
            muted: '#6b7280'
        },
        typography: {
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }
    },
    dark: {
        palette: {
            primary: '#4f83ff',
            background: '#0f172a',
            surface: '#111827',
            text: '#f8fafc',
            muted: '#9ca3af'
        },
        typography: {
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }
    }
};

let sharedSettingsCenter = null;
let sharedThemeCenter = null;
let sharedDataCenter = null;

function resolvePathSegments(path) {
    if (Array.isArray(path)) {
        return path.filter((segment) => Boolean(segment || segment === 0)).map((segment) => String(segment));
    }
    if (path === undefined || path === null) {
        return [];
    }
    if (typeof path === 'string') {
        return path
            .split(PATH_SEPARATOR)
            .map((segment) => segment.trim())
            .filter((segment) => segment.length > 0);
    }
    return [String(path)];
}

function cloneValue(value) {
    const type = Array.isArray(value) ? 'array' : typeof value;
    if (!CLONEABLE_TYPES.includes(type)) {
        return value;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return value;
    }
}

function joinSegments(segments) {
    return segments.join(PATH_SEPARATOR);
}

function combinePath(baseSegments, path) {
    if (!baseSegments.length && (path === undefined || path === null || path === '')) {
        return '';
    }
    const segments = [...baseSegments, ...resolvePathSegments(path)];
    return joinSegments(segments);
}

class ScopedSettingsCenter {
    constructor(parent, baseSegments) {
        this.parent = parent;
        this.baseSegments = baseSegments;
        this.basePath = joinSegments(baseSegments);
    }

    get(path, defaultValue) {
        if (!this.baseSegments.length) {
            return this.parent.get(path, defaultValue);
        }
        const fullPath = combinePath(this.baseSegments, path);
        if (!fullPath) {
            return this.parent.get(this.basePath, defaultValue);
        }
        return this.parent.get(fullPath, defaultValue);
    }

    set(path, value, options = {}) {
        if (!this.baseSegments.length) {
            this.parent.set(path, value, options);
            return;
        }
        const fullPath = combinePath(this.baseSegments, path);
        if (!fullPath) {
            this.parent.set(this.basePath, value, options);
            return;
        }
        this.parent.set(fullPath, value, options);
    }

    merge(path, value, options = {}) {
        if (!this.baseSegments.length) {
            return this.parent.merge(path, value, options);
        }
        const fullPath = combinePath(this.baseSegments, path);
        if (!fullPath) {
            return this.parent.merge(this.basePath, value, options);
        }
        return this.parent.merge(fullPath, value, options);
    }

    delete(path, options = {}) {
        if (!this.baseSegments.length) {
            return this.parent.delete(path, options);
        }
        const fullPath = combinePath(this.baseSegments, path);
        if (!fullPath) {
            return this.parent.delete(this.basePath, options);
        }
        return this.parent.delete(fullPath, options);
    }

    subscribe(listener) {
        if (!this.baseSegments.length) {
            return this.parent.subscribe(listener);
        }
        const prefix = `${this.basePath}${PATH_SEPARATOR}`;
        return this.parent.subscribe((event) => {
            if (event.path === this.basePath || event.path.startsWith(prefix)) {
                const relativePath = event.path === this.basePath
                    ? ''
                    : event.path.substring(prefix.length);
                listener({
                    ...event,
                    path: relativePath,
                    fullPath: event.path
                });
            }
        });
    }

    subscribeDeletion(listener) {
        if (!this.baseSegments.length) {
            return this.parent.subscribeDeletion(listener);
        }
        const prefix = `${this.basePath}${PATH_SEPARATOR}`;
        return this.parent.subscribeDeletion((event) => {
            if (event.path === this.basePath || event.path.startsWith(prefix)) {
                const relativePath = event.path === this.basePath
                    ? ''
                    : event.path.substring(prefix.length);
                listener({
                    ...event,
                    path: relativePath,
                    fullPath: event.path
                });
            }
        });
    }

    getAll() {
        if (!this.baseSegments.length) {
            return this.parent.getAll();
        }
        return this.parent.get(this.basePath, {});
    }

    scope(namespace) {
        const combined = combinePath(this.baseSegments, namespace);
        return new ScopedSettingsCenter(this.parent, resolvePathSegments(combined));
    }
}

class ScopedDataCenter {
    constructor(parent, baseKey) {
        this.parent = parent;
        this.baseKey = baseKey;
        this.prefix = baseKey ? `${baseKey}${PATH_SEPARATOR}` : '';
    }

    _fullKey(key) {
        if (!this.baseKey) {
            return this.parent.normalizeKey(key);
        }
        if (!key) {
            return this.baseKey;
        }
        return this.prefix + this.parent.normalizeKey(key);
    }

    get(key, defaultValue) {
        if (!this.baseKey) {
            return this.parent.get(key, defaultValue);
        }
        return this.parent.get(this._fullKey(key), defaultValue);
    }

    set(key, value, options = {}) {
        if (!this.baseKey) {
            this.parent.set(key, value, options);
            return;
        }
        this.parent.set(this._fullKey(key), value, options);
    }

    delete(key, options = {}) {
        if (!this.baseKey) {
            return this.parent.delete(key, options);
        }
        return this.parent.delete(this._fullKey(key), options);
    }

    listKeys() {
        if (!this.baseKey) {
            return this.parent.listKeys();
        }
        const keys = this.parent.listKeys();
        return keys
            .filter((key) => key === this.baseKey || key.startsWith(this.prefix))
            .map((key) => (key === this.baseKey ? '' : key.substring(this.prefix.length)));
    }

    subscribe(listener) {
        if (!this.baseKey) {
            return this.parent.subscribe(listener);
        }
        return this.parent.subscribe((event) => {
            if (event.key === this.baseKey || event.key.startsWith(this.prefix)) {
                const relativeKey = event.key === this.baseKey
                    ? ''
                    : event.key.substring(this.prefix.length);
                listener({
                    ...event,
                    key: relativeKey,
                    fullKey: event.key
                });
            }
        });
    }

    subscribeDeletion(listener) {
        if (!this.baseKey) {
            return this.parent.subscribeDeletion(listener);
        }
        return this.parent.subscribeDeletion((event) => {
            if (event.key === this.baseKey || event.key.startsWith(this.prefix)) {
                const relativeKey = event.key === this.baseKey
                    ? ''
                    : event.key.substring(this.prefix.length);
                listener({
                    ...event,
                    key: relativeKey,
                    fullKey: event.key
                });
            }
        });
    }

    scope(namespace) {
        const subKey = this.parent.normalizeKey(namespace);
        const combined = this.baseKey ? `${this.baseKey}${PATH_SEPARATOR}${subKey}` : subKey;
        return new ScopedDataCenter(this.parent, combined);
    }
}

function getNestedValue(source, segments) {
    let current = source;
    for (const segment of segments) {
        if (!current || typeof current !== 'object' || !(segment in current)) {
            return { exists: false, value: undefined };
        }
        current = current[segment];
    }
    return { exists: true, value: current };
}

function setNestedValue(target, segments, value) {
    let current = target;
    for (let index = 0; index < segments.length; index += 1) {
        const key = segments[index];
        if (index === segments.length - 1) {
            current[key] = value;
            return;
        }
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
}

function deleteNestedValue(target, segments) {
    if (!segments.length) {
        return false;
    }
    const lastIndex = segments.length - 1;
    let current = target;
    for (let index = 0; index < lastIndex; index += 1) {
        const key = segments[index];
        if (!current[key] || typeof current[key] !== 'object') {
            return false;
        }
        current = current[key];
    }
    const finalKey = segments[lastIndex];
    if (Object.prototype.hasOwnProperty.call(current, finalKey)) {
        delete current[finalKey];
        return true;
    }
    return false;
}

class SettingsCenter extends EventEmitter {
    constructor(options = {}) {
        super();
        this.userSettings = options.userSettings || userSettingsInstance;
        this.namespace = options.namespace || SETTINGS_NAMESPACE_DEFAULT;
        this.cache = this.userSettings.loadSettings();
    }

    reload() {
        this.cache = this.userSettings.loadSettings();
        return cloneValue(this.cache);
    }

    get(path, defaultValue) {
        const segments = resolvePathSegments(path);
        if (!segments.length) {
            return cloneValue(this.cache);
        }
        const result = getNestedValue(this.cache, segments);
        if (result.exists) {
            return cloneValue(result.value);
        }
        const persistedResult = getNestedValue(this.reload(), segments);
        if (persistedResult.exists) {
            return cloneValue(persistedResult.value);
        }
        return defaultValue;
    }

    set(path, value, options = {}) {
        const segments = resolvePathSegments(path);
        if (!segments.length) {
            return;
        }
        const previous = this.get(path);
        setNestedValue(this.cache, segments, cloneValue(value));
        if (options.persist !== false) {
            this.userSettings.saveSettings(this.cache);
            this.userSettings.syncToFile(segments.join(PATH_SEPARATOR), value);
        }
        this.emit('change', {
            path: segments.join(PATH_SEPARATOR),
            value: cloneValue(value),
            previousValue: cloneValue(previous)
        });
    }

    merge(path, value, options = {}) {
        const current = this.get(path, {});
        const merged = {
            ...current,
            ...(value || {})
        };
        this.set(path, merged, options);
        return merged;
    }

    delete(path, options = {}) {
        const segments = resolvePathSegments(path);
        if (!segments.length) {
            return false;
        }
        const previous = this.get(path);
        const deleted = deleteNestedValue(this.cache, segments);
        if (deleted && options.persist !== false) {
            this.userSettings.saveSettings(this.cache);
            this.userSettings.syncToFile(segments.join(PATH_SEPARATOR));
        }
        if (deleted) {
            this.emit('delete', {
                path: segments.join(PATH_SEPARATOR),
                previousValue: cloneValue(previous)
            });
        }
        return deleted;
    }

    subscribe(listener) {
        this.on('change', listener);
        return () => this.off('change', listener);
    }

    subscribeDeletion(listener) {
        this.on('delete', listener);
        return () => this.off('delete', listener);
    }

    getAll() {
        return cloneValue(this.cache);
    }

    scope(namespace) {
        return new ScopedSettingsCenter(this, resolvePathSegments(namespace));
    }
}

class ThemeCenter extends EventEmitter {
    constructor(settingsCenter, options = {}) {
        super();
        this.settingsCenter = settingsCenter;
        this.namespace = options.namespace || THEME_NAMESPACE_DEFAULT;
        this.defaultTheme = options.defaultTheme || 'light';
        this.themeDefinitions = new Map();
        this.currentTheme = this.settingsCenter.get(`${this.namespace}.active`, this.defaultTheme);
        this.baseThemes = options.baseThemes || DEFAULT_THEME_DEFINITIONS;
        this.settingsCenter.subscribe(({ path, value }) => {
            if (path === `${this.namespace}.active`) {
                this.currentTheme = value || this.defaultTheme;
                this.emit('change', this.getThemeConfig());
            }
            if (path.startsWith(`${this.namespace}.definitions.`)) {
                const themeName = path.substring(`${this.namespace}.definitions.`.length);
                if (value) {
                    this.themeDefinitions.set(themeName, cloneValue(value));
                }
            }
        });
        const storedDefinitions = this.settingsCenter.get(`${this.namespace}.definitions`, {});
        for (const [themeName, definition] of Object.entries(storedDefinitions)) {
            this.themeDefinitions.set(themeName, definition);
        }

        for (const [themeName, definition] of Object.entries(this.baseThemes)) {
            if (!this.themeDefinitions.has(themeName)) {
                this.registerTheme(themeName, definition, { persist: true, override: false });
            }
        }

        if (!this.themeDefinitions.has(this.currentTheme)) {
            const fallbackTheme = this.themeDefinitions.has(this.defaultTheme)
                ? this.defaultTheme
                : this.getRegisteredThemes()[0];
            if (fallbackTheme) {
                this.setTheme(fallbackTheme);
            }
        }
    }

    registerTheme(themeName, definition = {}, options = {}) {
        const safeName = String(themeName).trim();
        if (!safeName) {
            throw new Error('Theme name must be a non-empty string');
        }
        const exists = this.themeDefinitions.has(safeName);
        const shouldOverride = options.override !== false || !exists;
        if (shouldOverride) {
            const themeDefinition = cloneValue(definition);
            this.themeDefinitions.set(safeName, themeDefinition);
            if (options.persist !== false) {
                this.settingsCenter.set(`${this.namespace}.definitions.${safeName}`, themeDefinition);
            }
        } else if (!exists && options.persist !== false) {
            this.settingsCenter.set(`${this.namespace}.definitions.${safeName}`, cloneValue(definition));
        }
    }

    getRegisteredThemes() {
        return Array.from(this.themeDefinitions.keys());
    }

    getThemeConfig(requestedTheme) {
        const targetTheme = requestedTheme || this.currentTheme || this.defaultTheme;
        if (this.themeDefinitions.has(targetTheme)) {
            return cloneValue(this.themeDefinitions.get(targetTheme));
        }
        return cloneValue(this.themeDefinitions.get(this.defaultTheme)) || {};
    }

    getActiveThemeName() {
        return this.currentTheme || this.defaultTheme;
    }

    getActiveTheme() {
        return {
            name: this.getActiveThemeName(),
            config: this.getThemeConfig()
        };
    }

    setTheme(themeName, options = {}) {
        const safeName = String(themeName).trim();
        if (!safeName) {
            throw new Error('Theme name must be a non-empty string');
        }
        const shouldPersist = options.persist !== false;
        if (options.definition) {
            this.registerTheme(safeName, options.definition, { persist: shouldPersist });
        } else if (!this.themeDefinitions.has(safeName)) {
            this.registerTheme(safeName, {}, { persist: shouldPersist });
        }
        if (!this.themeDefinitions.has(safeName)) {
            throw new Error(`Theme ${safeName} is not registered`);
        }
        this.currentTheme = safeName;
        if (shouldPersist) {
            this.settingsCenter.set(`${this.namespace}.active`, safeName, options);
        }
        this.emit('change', this.getThemeConfig());
    }

    onThemeChange(listener) {
        this.on('change', listener);
        return () => this.off('change', listener);
    }
}

class DataCenter extends EventEmitter {
    constructor(settingsCenter, options = {}) {
        super();
        this.settingsCenter = settingsCenter;
        this.namespace = options.namespace || DATA_NAMESPACE_DEFAULT;
        this.persistByDefault = options.persistByDefault ?? false;
        this.cache = new Map();
        this.loadPersistedData();
        this.settingsCenter.subscribe(({ path, value }) => {
            if (!path.startsWith(`${this.namespace}.`)) {
                return;
            }
            const key = path.substring(this.namespace.length + 1);
            this.cache.set(key, cloneValue(value));
            this.emit('change', {
                key,
                value: cloneValue(value)
            });
        });
        this.settingsCenter.subscribeDeletion(({ path }) => {
            if (!path.startsWith(`${this.namespace}.`)) {
                return;
            }
            const key = path.substring(this.namespace.length + 1);
            this.cache.delete(key);
            this.emit('delete', { key });
        });
    }

    loadPersistedData() {
        const persisted = this.settingsCenter.get(this.namespace, {});
        if (!persisted || typeof persisted !== 'object') {
            return;
        }
        for (const [key, value] of Object.entries(persisted)) {
            this.cache.set(key, cloneValue(value));
        }
    }

    normalizeKey(key) {
        if (Array.isArray(key)) {
            return key.filter((segment) => Boolean(segment || segment === 0)).map((segment) => String(segment)).join(PATH_SEPARATOR);
        }
        return String(key);
    }

    get(key, defaultValue) {
        const normalizedKey = this.normalizeKey(key);
        if (this.cache.has(normalizedKey)) {
            return cloneValue(this.cache.get(normalizedKey));
        }
        const persisted = this.settingsCenter.get(`${this.namespace}.${normalizedKey}`);
        if (persisted !== undefined) {
            this.cache.set(normalizedKey, cloneValue(persisted));
            return cloneValue(persisted);
        }
        return defaultValue;
    }

    set(key, value, options = {}) {
        const normalizedKey = this.normalizeKey(key);
        const persist = options.persist !== undefined ? options.persist : this.persistByDefault;
        const previous = this.cache.get(normalizedKey);
        this.cache.set(normalizedKey, cloneValue(value));
        if (persist) {
            this.settingsCenter.set(`${this.namespace}.${normalizedKey}`, value, options);
        }
        this.emit('change', {
            key: normalizedKey,
            value: cloneValue(value),
            previousValue: cloneValue(previous)
        });
    }

    delete(key, options = {}) {
        const normalizedKey = this.normalizeKey(key);
        const existed = this.cache.delete(normalizedKey);
        if (options.persist || (options.persist === undefined && this.persistByDefault)) {
            this.settingsCenter.delete(`${this.namespace}.${normalizedKey}`, options);
        }
        if (existed) {
            this.emit('delete', { key: normalizedKey });
        }
        return existed;
    }

    listKeys() {
        return Array.from(this.cache.keys());
    }

    subscribe(listener) {
        this.on('change', listener);
        return () => this.off('change', listener);
    }

    subscribeDeletion(listener) {
        this.on('delete', listener);
        return () => this.off('delete', listener);
    }

    scope(namespace) {
        if (namespace === undefined || namespace === null || namespace === '') {
            return new ScopedDataCenter(this, '');
        }
        return new ScopedDataCenter(this, this.normalizeKey(namespace));
    }
}

function getSettingsCenterInstance() {
    if (!sharedSettingsCenter) {
        sharedSettingsCenter = new SettingsCenter();
    }
    return sharedSettingsCenter;
}

function getThemeCenterInstance() {
    if (!sharedThemeCenter) {
        sharedThemeCenter = new ThemeCenter(getSettingsCenterInstance(), {
            baseThemes: DEFAULT_THEME_DEFINITIONS
        });
    }
    return sharedThemeCenter;
}

function getDataCenterInstance() {
    if (!sharedDataCenter) {
        sharedDataCenter = new DataCenter(getSettingsCenterInstance());
    }
    return sharedDataCenter;
}

module.exports = {
    SettingsCenter,
    ThemeCenter,
    DataCenter,
    DEFAULT_THEME_DEFINITIONS,
    getSettingsCenter: getSettingsCenterInstance,
    getThemeCenter: getThemeCenterInstance,
    getDataCenter: getDataCenterInstance
};
