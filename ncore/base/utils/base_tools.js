export function getEnvValue(envSource, envKey, defaultValue = null) {
    if (envSource && typeof envSource === 'object') {
        if (typeof envSource.getEnv === 'function') {
            const value = envSource.getEnv(envKey);
            return value !== undefined ? value : defaultValue;
        } else if (envSource.hasOwnProperty(envKey)) {
            const value = envSource[envKey];
            return value !== undefined ? value : defaultValue;
        }
    }
    return defaultValue;
}
