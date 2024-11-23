#!/bin/bash

mkdir -p /usr/caddy/jwt

openssl genrsa -out /usr/caddy/jwt/private.pem 2048

openssl rsa -in /usr/caddy/jwt/private.pem -pubout -out /usr/caddy/jwt/public.pem

chmod 600 /usr/caddy/jwt/private.pem
chmod 644 /usr/caddy/jwt/public.pem

echo "JWT RSA keys have been generated:"
echo "Private key: /usr/caddy/jwt/private.pem"
echo "Public key: /usr/caddy/jwt/public.pem"
