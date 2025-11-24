# Nginx Configuration Update Required for TTS

## Issue

The current nginx configuration has a location block that handles all `.mp3` files directly:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|webp|mp4|mp3|pdf)$ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

This prevents TTS audio files served through Laravel's `/tts/audio/{language}/{type}/{filename}` route from working, because nginx tries to find the files in the public directory instead of proxying the request to Laravel.

## Solution

Add a specific location block for `/tts/audio/` BEFORE the static file handling block. This ensures TTS audio requests are proxied to Laravel.

## Files to Update

1. `/etc/nginx/sites-available/si.api.gm15.com`
2. `/etc/nginx/sites-available/sz.api.12gm.com`

## Change Required

Add this block after the `location @swoole` block and BEFORE the static files block:

```nginx
# TTS audio files served by Laravel
location ~ ^/tts/audio/ {
    proxy_pass http://127.0.0.1:9003;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

## Complete Section After Change

```nginx
location @swoole {
    proxy_pass http://127.0.0.1:9003;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# TTS audio files served by Laravel
location ~ ^/tts/audio/ {
    proxy_pass http://127.0.0.1:9003;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# Static files handled by Nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|webp|mp4|mp3|pdf)$ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## After Making Changes

1. Test nginx configuration: `sudo nginx -t`
2. Reload nginx: `sudo systemctl reload nginx`

## Why This Works

Nginx processes location blocks in a specific order. The exact match (`~ ^/tts/audio/`) is more specific than the file extension regex match (`~* \.(mp3)$`), so it will be evaluated first. This ensures that requests to `/tts/audio/*` are proxied to Laravel, while other `.mp3` files in the public directory are still served directly by nginx.
