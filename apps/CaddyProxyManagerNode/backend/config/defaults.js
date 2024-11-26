export default {
    // Storage related
    dataFolder: '/etc/caddy/',
    logFolder: '/var/log/caddy',
    caddyFile: '/etc/caddy/Caddyfile',
    
    // JWT keys
    privateKey: '/usr/caddy/jwt/private.pem',
    publicKey: '/usr/caddy/jwt/public.pem',
    
    // Assets paths (relative to project root)
    assetsPath: './assets',
    templatesPath: './embed/caddy',
    rootDir: '.',
    
    // Logging configuration
    log: {
        level: 'debug',
        format: 'nice'
    },
    
    // Server configuration
    server: {
        port: 3001,
        host: '0.0.0.0'
    },
    
    // Database configuration
    database: {
        dialect: 'sqlite',
        storage: 'database.sqlite'
    },
    
    // JWT configuration
    jwt: {
        expiresIn: '24h',
        algorithm: 'RS256'
    }
}; 