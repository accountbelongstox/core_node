<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RemoveFrameworkFingerprints
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Remove all Laravel-specific headers
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');
        $response->headers->remove('x-laravel-version');
        $response->headers->remove('x-laravel-cache');
        $response->headers->remove('x-vapor-base64-encode');
        $response->headers->remove('x-debug-token');
        $response->headers->remove('x-debug-token-link');

        // Disguise as Express.js/Node.js
        $response->headers->set('Server', config('app.server_headers.Server', 'nginx'));
        $response->headers->set('X-Powered-By', 'Express');
        
        // Add security headers
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        
        // Remove or modify Laravel-specific cookies
        $cookies = $response->headers->getCookies();
        foreach ($cookies as $cookie) {
            if (Str::contains(strtolower($cookie->getName()), ['laravel', 'xsrf', 'csrf'])) {
                $response->headers->removeCookie($cookie->getName());
                
                // If it's a CSRF token, recreate it with a different name
                if (Str::contains(strtolower($cookie->getName()), ['xsrf', 'csrf'])) {
                    $response->withCookie(cookie(
                        'security_token',
                        $cookie->getValue(),
                        $cookie->getExpiresTime(),
                        $cookie->getPath(),
                        $cookie->getDomain(),
                        $cookie->isSecure(),
                        $cookie->isHttpOnly(),
                        $cookie->isRaw(),
                        $cookie->getSameSite()
                    ));
                }
            }
        }

        // Modify session cookie to look like Express session
        if ($sessionCookie = $response->headers->getCookies()['laravel_session'] ?? null) {
            $response->headers->removeCookie('laravel_session');
            $response->withCookie(cookie(
                'connect.sid',
                $sessionCookie->getValue(),
                $sessionCookie->getExpiresTime(),
                $sessionCookie->getPath(),
                $sessionCookie->getDomain(),
                $sessionCookie->isSecure(),
                $sessionCookie->isHttpOnly(),
                $sessionCookie->isRaw(),
                $sessionCookie->getSameSite()
            ));
        }

        return $response;
    }
} 