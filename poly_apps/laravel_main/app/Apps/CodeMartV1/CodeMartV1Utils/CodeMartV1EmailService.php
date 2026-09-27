<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EmailVerificationModel;
use Illuminate\Support\Str;
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

            Mail::raw(__('codemart.mail.verification_body', ['url' => $verificationUrl]), function ($message) use ($email) {
                $message->to($email)
                    ->subject(__('codemart.mail.verification_subject'))
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
        return CodeMartV1EmailVerificationModel::consume($email, $token);
    }

    /**
     * Issue a fresh verification token (replacing the previous one) and mail
     * it. Registration and resend share this single token path.
     */
    public function issueVerification(string $email): bool
    {
        return $this->sendVerificationEmail($email, $this->createEmailVerification($email));
    }

    public function createEmailVerification(string $email): string
    {
        $token = $this->generateVerificationToken();

        CodeMartV1EmailVerificationModel::replaceForEmail($email, $token);

        return $token;
    }

    public function isEmailVerified(string $email): bool
    {
        return CodeMartV1EmailVerificationModel::isVerifiedEmail($email);
    }
}
