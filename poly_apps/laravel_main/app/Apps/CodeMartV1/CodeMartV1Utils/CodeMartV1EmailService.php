<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
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
            $verificationUrl = $this->buildVerificationUrl($email, $token);

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

    public function buildVerificationUrl(string $email, string $token): string
    {
        $frontendUrl = rtrim((string) Config::get('app.frontend_url'), '/');

        return $frontendUrl . CodeMartV1Constants::EMAIL_VERIFICATION_UI_PATH . '?' . http_build_query(['email' => $email, 'token' => $token]);
    }

    public function buildEmailChangeUrl(string $token): string
    {
        $frontendUrl = rtrim((string) Config::get('app.frontend_url'), '/');

        return $frontendUrl . CodeMartV1Constants::EMAIL_CHANGE_UI_PATH . '?' . http_build_query(['email_change_token' => $token]);
    }

    /** Confirmation link for a requested email change, sent to the new address. */
    public function sendEmailChangeEmail(string $newEmail, string $token): bool
    {
        try {
            $url = $this->buildEmailChangeUrl($token);

            Mail::raw(__('codemart.mail.email_change_body', ['url' => $url]), function ($message) use ($newEmail) {
                $message->to($newEmail)
                    ->subject(__('codemart.mail.email_change_subject'))
                    ->from(Config::get('mail.from.address'));
            });

            return true;
        } catch (\Exception $e) {
            return false;
        }
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
