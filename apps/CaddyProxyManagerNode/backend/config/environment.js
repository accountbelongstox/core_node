import { cleanEnv, str, num } from 'envalid';

export default cleanEnv(process.env, {
    // Path configurations
    DATA_FOLDER: str({ default: '/etc/caddy/' }),
    LOG_FOLDER: str({ default: '/var/log/caddy' }),
    CADDY_FILE: str({ default: '/etc/caddy/Caddyfile' }),
    PRIVATE_KEY: str({ default: '/usr/caddy/jwt/private.pem' }),
    PUBLIC_KEY: str({ default: '/usr/caddy/jwt/public.pem' }),
    
    // Logging configurations
    LOG_LEVEL: str({ default: 'debug', choices: ['debug', 'info', 'warn', 'error'] }),
    LOG_FORMAT: str({ default: 'nice', choices: ['nice', 'json'] }),
    
    // Server configurations
    PORT: num({ default: 13000 }),
    HOST: str({ default: '0.0.0.0' }),
    
    // Environment
    NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] })
}); 