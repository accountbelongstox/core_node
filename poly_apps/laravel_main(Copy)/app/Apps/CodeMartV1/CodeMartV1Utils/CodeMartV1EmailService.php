<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;

class CodeMartV1EmailService
{
    public function generateVerificationToken(): string
    {
        return Str::random(64);
    }

    public function sendVerificationEmail(string $email, string $token): bool
    {
        try {
            $verificationUrl = $this->buildVerificationUrl($token);

            Mail::raw("Please verify your email by clicking the link: {$verificationUrl}", function ($message) use ($email) {
                $message->to($email)
                    ->subject('CodeMart Email Verification')
                    ->from(Config::get('mail.from.address'));
            });

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function buildVerificationUrl(string $token): string
    {
        $frontendUrl = Config::get('app.frontend_url', 'http://localhost:3000');
        return "{$frontendUrl}/auth/verify-email?token={$token}";
    }

    public function verifyToken(string $email, string $token): bool
    {
        $record = DB::table('codemart_email_verifications')
            ->where('email', $email)
            ->where('token', $token)
            ->first();

        if (!$record) {
            return false;
        }

        if ($record->verified_at !== null) {
            return false;
        }

        DB::table('codemart_email_verifications')
            ->where('id', $record->id)
            ->update(['verified_at' => now()]);

        return true;
    }

    public function createEmailVerification(string $email): string
    {
        $token = $this->generateVerificationToken();

        DB::table('codemart_email_verifications')->updateOrCreate(
            ['email' => $email],
            [
                'token' => $token,
                'verified_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return $token;
    }

    public function isEmailVerified(string $email): bool
    {
        $record = DB::table('codemart_email_verifications')
            ->where('email', $email)
            ->where('verified_at', '!=', null)
            ->first();

        return $record !== null;
    }
}
