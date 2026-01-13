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

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Models\User;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Services\FileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SsoController extends Controller
{
    use ApiResponse;

    /**
     * Display SSO login page
     */
    public function index(Request $request)
    {
        $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
        
        if (config('app.debug') === false) {
            $html = preg_replace('/<div id="sso-config-section"[^>]*>.*?<\/div>/s', '', $html);
        }
        
        return response($html)->header('Content-Type', 'text/html; charset=utf-8');
    }

    /**
     * Get authorization URL for SSO
     */
    public function getAuthorizationUrl(Request $request)
    {
        $workosApiKey = env('WORKOS_API_KEY');
        $workosClientId = env('WORKOS_CLIENT_ID');
        $redirectUri = $request->input('redirect_uri') ?? env('WORKOS_REDIRECT_URL', $request->getSchemeAndHttpHost() . '/sso/callback');
        $organizationId = $request->input('organization_id');
        $provider = $request->input('provider', 'authkit');

        if (!$workosApiKey || !$workosClientId) {
            return $this->error('WorkOS API key or Client ID not configured', 400);
        }

        try {
            if (!class_exists('\WorkOS\WorkOS')) {
                return $this->error('WorkOS PHP SDK not installed. Please run: composer require workos/workos-php', 500);
            }

            $workos = new \WorkOS\WorkOS($workosApiKey);
            
            $params = [
                'redirectUri' => $redirectUri,
                'clientId' => $workosClientId,
                'provider' => $provider,
            ];

            if ($organizationId) {
                $params['organizationId'] = $organizationId;
            }

            $state = Str::random(40);
            $request->session()->put('workos_state', $state);
            $params['state'] = $state;

            $authorizationUrl = $workos->userManagement->getAuthorizationUrl($params);

            return $this->success([
                'url' => $authorizationUrl,
                'state' => $state,
            ], 'Authorization URL generated successfully');
        } catch (\Exception $e) {
            Log::error('WorkOS authorization URL generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate authorization URL: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Handle SSO callback
     */
    public function callback(Request $request)
    {
        $code = $request->query('code');
        $state = $request->query('state');
        $error = $request->query('error');

        if ($error) {
            $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
            $html = str_replace('id="sso-error"', 'id="sso-error" class="alert alert-error"', $html);
            $html = str_replace('</body>', '<script>document.getElementById("sso-error").textContent = "Authentication failed: ' . htmlspecialchars($error) . '"; document.getElementById("sso-error").classList.remove("hidden");</script></body>', $html);
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }

        if (!$code) {
            $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
            $html = str_replace('</body>', '<script>document.getElementById("sso-error").textContent = "Authorization code not provided"; document.getElementById("sso-error").classList.remove("hidden");</script></body>', $html);
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }

        $sessionState = $request->session()->get('workos_state');
        if ($state && $sessionState && $state !== $sessionState) {
            $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
            $html = str_replace('</body>', '<script>document.getElementById("sso-error").textContent = "Invalid state parameter"; document.getElementById("sso-error").classList.remove("hidden");</script></body>', $html);
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }

        $workosApiKey = env('WORKOS_API_KEY');
        $workosClientId = env('WORKOS_CLIENT_ID');

        if (!$workosApiKey || !$workosClientId) {
            $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
            $html = str_replace('</body>', '<script>document.getElementById("sso-error").textContent = "WorkOS API key or Client ID not configured"; document.getElementById("sso-error").classList.remove("hidden");</script></body>', $html);
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }

        try {
            if (!class_exists('\WorkOS\WorkOS')) {
                $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
                $html = str_replace('</body>', '<script>document.getElementById("sso-error").textContent = "WorkOS PHP SDK not installed. Please run: composer require workos/workos-php"; document.getElementById("sso-error").classList.remove("hidden");</script></body>', $html);
                return response($html)->header('Content-Type', 'text/html; charset=utf-8');
            }

            $workos = new \WorkOS\WorkOS($workosApiKey);
            
            $authResponse = $workos->userManagement->authenticateWithCode([
                'code' => $code,
                'clientId' => $workosClientId,
            ]);

            $request->session()->forget('workos_state');

            $user = $this->findOrCreateUserFromWorkOS($authResponse->user);
            
            Auth::login($user, true);
            $request->session()->regenerate();
            
            $user = AvatarPublic::createAvatar($user, true);
            $token = $user->createToken('auth_token')->plainTextToken;

            $userData = [
                'id' => $user->id,
                'email' => $user->email,
                'username' => $user->username ?? null,
                'nickname' => $user->nickname ?? null,
                'avatar' => FileService::getAvatarUrl($user->avatar),
                'name' => $user->name ?? null,
            ];
            
            $request->session()->put('workos_user', $userData);

            if ($request->wantsJson() || $request->expectsJson()) {
                $userArray = $user->toArray();
                $userArray['avatar'] = FileService::getAvatarUrl($user->avatar);
                return $this->success([
                    'user' => $userArray,
                    'token' => $token,
                    'token_type' => 'Bearer',
                    'expiration' => config('sanctum.expiration'),
                ], 'Authentication successful');
            }

            $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
            $userArray = $user->toArray();
            $userArray['avatar'] = FileService::getAvatarUrl($user->avatar);
            $userDataJson = json_encode($userArray);
            $html = str_replace('</body>', '<script>window.ssoCallbackData = ' . $userDataJson . '; window.ssoCallbackToken = ' . json_encode($token) . ';</script></body>', $html);
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        } catch (\Exception $e) {
            Log::error('WorkOS authentication failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $html = file_get_contents(public_path('debug-assets/debug-tools/sections/sso-section.html'));
            $html = str_replace('</body>', '<script>document.getElementById("sso-error").textContent = "Authentication failed: ' . htmlspecialchars($e->getMessage()) . '"; document.getElementById("sso-error").classList.remove("hidden");</script></body>', $html);
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }
    }

    /**
     * Get current SSO user session
     */
    public function getUser(Request $request)
    {
        $sessionUser = $request->session()->get('workos_user');
        
        if ($sessionUser) {
            if (Auth::check()) {
                $user = Auth::user();
                $user = AvatarPublic::createAvatar($user, true);
                
                $token = null;
                if ($user->currentAccessToken()) {
                    $token = $user->currentAccessToken()->plainTextToken;
                }
                
                $userArray = $user->toArray();
                $userArray['avatar'] = FileService::getAvatarUrl($user->avatar);
                return $this->success([
                    'user' => $userArray,
                    'token' => $token,
                ], 'User session retrieved');
            } else {
                $userId = $sessionUser['id'] ?? null;
                if ($userId && is_numeric($userId)) {
                    $user = User::find($userId);
                    if ($user) {
                        $user = AvatarPublic::createAvatar($user, true);
                        $userArray = $user->toArray();
                        $userArray['avatar'] = FileService::getAvatarUrl($user->avatar);
                        return $this->success([
                            'user' => $userArray,
                            'token' => null,
                        ], 'User session retrieved');
                    }
                }
                $formattedUser = [
                    'id' => $sessionUser['id'] ?? null,
                    'email' => $sessionUser['email'] ?? null,
                    'username' => $sessionUser['username'] ?? null,
                    'nickname' => $sessionUser['nickname'] ?? null,
                    'name' => $sessionUser['name'] ?? null,
                    'avatar' => FileService::getAvatarUrl($sessionUser['avatar'] ?? null),
                    'firstName' => $sessionUser['firstName'] ?? null,
                    'lastName' => $sessionUser['lastName'] ?? null,
                    'profilePictureUrl' => $sessionUser['profilePictureUrl'] ?? null,
                ];
                return $this->success(['user' => $formattedUser], 'User session retrieved');
            }
        }

        return $this->error('No authenticated user', 401);
    }

    /**
     * Authenticate user with email/username and password
     * Supports both WorkOS (if configured) and Laravel native authentication
     * Accepts 'email' or 'username' field (compatible with regular login)
     */
    public function authenticate(Request $request)
    {
        $identifier = $request->input('email') ?? $request->input('username');
        $password = $request->input('password');

        if (!$identifier || !$password) {
            return $this->error('Email/username and password are required', 400);
        }

        $workosApiKey = env('WORKOS_API_KEY');
        $workosClientId = env('WORKOS_CLIENT_ID');
        $workosClientSecret = env('WORKOS_CLIENT_SECRET');

        $useWorkOS = $workosApiKey && $workosClientId && $workosClientSecret;

        if ($useWorkOS) {
            return $this->authenticateWithWorkOS($request, $identifier, $password);
        } else {
            return $this->authenticateWithLaravel($request, $identifier, $password);
        }
    }

    /**
     * Authenticate using WorkOS
     */
    private function authenticateWithWorkOS(Request $request, string $email, string $password)
    {
        try {
            if (!class_exists('\WorkOS\WorkOS')) {
                return $this->error('WorkOS PHP SDK not installed. Please run: composer require workos/workos-php', 500);
            }

            $workosApiKey = env('WORKOS_API_KEY');
            $workosClientId = env('WORKOS_CLIENT_ID');
            $workosClientSecret = env('WORKOS_CLIENT_SECRET');

            $workos = new \WorkOS\WorkOS($workosApiKey);
            
            $authResponse = $workos->userManagement->authenticateWithPassword([
                'clientId' => $workosClientId,
                'clientSecret' => $workosClientSecret,
                'email' => $email,
                'password' => $password,
                'ipAddress' => $request->ip(),
                'userAgent' => $request->userAgent(),
            ]);

            $user = $this->findOrCreateUserFromWorkOS($authResponse->user);
            
            Auth::login($user, true);
            $request->session()->regenerate();
            
            $user = AvatarPublic::createAvatar($user, true);
            $token = $user->createToken('auth_token')->plainTextToken;

            $userData = [
                'id' => $user->id,
                'email' => $user->email,
                'username' => $user->username ?? null,
                'nickname' => $user->nickname ?? null,
                'avatar' => FileService::getAvatarUrl($user->avatar),
                'name' => $user->name ?? null,
            ];
            
            $request->session()->put('workos_user', $userData);

            $userArray = $user->toArray();
            $userArray['avatar'] = FileService::getAvatarUrl($user->avatar);
            return $this->success([
                'user' => $userArray,
                'token' => $token,
                'token_type' => 'Bearer',
                'expiration' => config('sanctum.expiration'),
            ], 'Authentication successful');
        } catch (\Exception $e) {
            Log::error('WorkOS password authentication failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Authentication failed: ' . $e->getMessage(), 401);
        }
    }

    /**
     * Authenticate using Laravel native authentication
     * Following CommonAuthService pattern: support username, email, or phone
     * Following Laravel official documentation: https://laravel.com/docs/12.x/authentication
     */
    private function authenticateWithLaravel(Request $request, string $identifier, string $password)
    {
        $user = User::where(function($query) use ($identifier) {
            $query->where('username', $identifier)
                ->orWhere('email', $identifier)
                ->orWhere('phone', $identifier);
        })->first();

        if (!$user) {
            return $this->error('The provided credentials do not match our records.', 401);
        }

        if (!Hash::check($password, $user->password)) {
            return $this->error('The provided credentials do not match our records.', 401);
        }

        $credentials = [];
        if ($user->username === $identifier) {
            $credentials = ['username' => $identifier, 'password' => $password];
        } elseif ($user->email && $user->email === $identifier) {
            $credentials = ['email' => $identifier, 'password' => $password];
        } elseif ($user->phone && $user->phone === $identifier) {
            $credentials = ['username' => $user->username, 'password' => $password];
        } else {
            $credentials = ['username' => $user->username, 'password' => $password];
        }

        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return $this->error('The provided credentials do not match our records.', 401);
        }

        $request->session()->regenerate();
        
        $authenticatedUser = Auth::user();

        $authenticatedUser = AvatarPublic::createAvatar($authenticatedUser, true);

        $token = $authenticatedUser->createToken('auth_token')->plainTextToken;

        $userData = [
            'id' => $authenticatedUser->id,
            'email' => $authenticatedUser->email,
            'username' => $authenticatedUser->username ?? null,
            'nickname' => $authenticatedUser->nickname ?? null,
            'avatar' => FileService::getAvatarUrl($authenticatedUser->avatar),
            'name' => $authenticatedUser->name ?? null,
        ];
        
        $request->session()->put('workos_user', $userData);

        $userArray = $authenticatedUser->toArray();
        $userArray['avatar'] = FileService::getAvatarUrl($authenticatedUser->avatar);
        return $this->success([
            'user' => $userArray,
            'token' => $token,
            'token_type' => 'Bearer',
            'expiration' => config('sanctum.expiration'),
        ], 'Authentication successful');
    }

    /**
     * Find or create Laravel user from WorkOS user
     */
    private function findOrCreateUserFromWorkOS($workosUser)
    {
        $email = $workosUser->email;
        $user = User::where('email', $email)->first();

        if (!$user) {
            $firstName = $workosUser->firstName ?? '';
            $lastName = $workosUser->lastName ?? '';
            $fullName = trim($firstName . ' ' . $lastName);
            $username = $this->generateUsernameFromEmail($email);

            $user = User::create([
                'email' => $email,
                'username' => $username,
                'nickname' => $fullName ?: $email,
                'name' => $fullName ?: null,
                'password' => Hash::make(Str::random(32)),
                'rolelevel' => 0,
                'rolename' => 'user',
            ]);
        }

        return $user;
    }

    /**
     * Generate username from email
     */
    private function generateUsernameFromEmail($email)
    {
        $username = explode('@', $email)[0];
        $baseUsername = $username;
        $counter = 1;

        while (User::where('username', $username)->exists()) {
            $username = $baseUsername . $counter;
            $counter++;
        }

        return $username;
    }

    /**
     * Logout SSO user
     */
    public function logout(Request $request)
    {
        if ($request->user() && $request->user()->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }
        
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        $request->session()->forget('workos_user');
        $request->session()->forget('workos_state');
        
        return $this->success([], 'Logged out successfully');
    }
}

