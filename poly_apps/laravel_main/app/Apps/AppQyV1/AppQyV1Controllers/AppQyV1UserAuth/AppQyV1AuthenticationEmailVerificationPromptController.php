<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Traits\ApiResponse;

class AppQyV1AuthenticationEmailVerificationPromptController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    /**
     * Show the email verification prompt page.
     */
    public function __invoke(Request $request): RedirectResponse|Response
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json([
                'status' => 'verified',
                'message' => 'Email already verified'
            ]);
        }
        
        return response()->json([
            'status' => 'unverified',
            'message' => 'Email verification required',
            'session_status' => $request->session()->get('status')
        ]);
    }
}

