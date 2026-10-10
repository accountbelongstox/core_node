<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EmailChangeModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EmailVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1EmailService;
use App\Constants\AppKeys;
use App\Services\AvatarService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Account self-service on top of the shared identity: avatar upload (shared
 * AvatarService pipeline) and email change confirmed through a mailed token.
 */
class CodeMartV1AccountService
{
    private const AVATAR_DEFAULT = 'avatars/1.png';

    public function __construct(private readonly CodeMartV1EmailService $emailService)
    {
    }

    private static function failure(string $errorCode, string $message, int $status): array
    {
        return ['error_code' => $errorCode, 'message' => $message, 'http_status' => $status];
    }

    public static function avatarUrl(?string $avatar): ?string
    {
        return $avatar ? AvatarService::getAvatarUrl($avatar) : null;
    }

    public function updateAvatar(CodeMartV1UserModel $user, UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $maxBytes = min(AvatarService::MAX_UPLOAD_BYTES, CodeMartV1PolicyService::int('max_kyc_image_size_kb') * 1024);
        if (!$file->isValid()
            || !in_array($extension, CodeMartV1Constants::AVATAR_ALLOWED_EXTENSIONS, true)
            || $file->getSize() > $maxBytes) {
            return self::failure(CodeMartV1Constants::ERROR_AVATAR_INVALID, __('codemart.messages.avatar_invalid'), 422);
        }

        $mime = $extension === 'png' ? 'png' : 'jpeg';
        $encoded = 'data:image/' . $mime . ';base64,' . base64_encode((string) file_get_contents($file->getRealPath()));
        $path = AvatarService::saveBase64Avatar($encoded, (int) $user->id, AppKeys::CODEMARTV1);
        if ($path === null) {
            return self::failure(CodeMartV1Constants::ERROR_FILE_STORE_FAILED, __('codemart.messages.avatar_store_failed'), 500);
        }

        $previous = $user->avatar;
        $user->updateRecord(['avatar' => $path]);
        if ($previous && $previous !== self::AVATAR_DEFAULT && $previous !== $path) {
            AvatarService::deleteAvatar($previous);
        }

        CodeMartV1DomainEventService::emit((int) $user->id, CodeMartV1Constants::RESOURCE_USER, (int) $user->id, 'avatar_updated');

        return ['avatar' => $path, 'avatar_url' => self::avatarUrl($path)];
    }

    public function requestEmailChange(CodeMartV1UserModel $user, string $newEmail, string $password): array
    {
        $newEmail = trim($newEmail);
        if (!Hash::check($password, (string) $user->password)) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_PASSWORD, __('codemart.messages.email_change_password_invalid'), 422);
        }
        if (strcasecmp($newEmail, (string) $user->email) === 0) {
            return self::failure(CodeMartV1Constants::ERROR_EMAIL_UNCHANGED, __('codemart.messages.email_change_unchanged'), 422);
        }
        if ($this->emailTaken($newEmail, (int) $user->id)) {
            return self::failure(CodeMartV1Constants::ERROR_EMAIL_TAKEN, __('codemart.messages.email_change_taken'), 422);
        }

        $token = Str::random(64);
        CodeMartV1EmailChangeModel::replacePendingForUser(
            (int) $user->id,
            $newEmail,
            hash('sha256', $token),
            now()->addHours(CodeMartV1Constants::EMAIL_CHANGE_TTL_HOURS)
        );

        if (!$this->emailService->sendEmailChangeEmail($newEmail, $token)) {
            return self::failure(CodeMartV1Constants::ERROR_MAIL_UNAVAILABLE, __('codemart.messages.email_change_mail_failed'), 503);
        }

        CodeMartV1DomainEventService::emit(
            (int) $user->id,
            CodeMartV1Constants::RESOURCE_USER,
            (int) $user->id,
            'email_change_requested'
        );

        return ['pending_email' => $newEmail, 'expires_in_hours' => CodeMartV1Constants::EMAIL_CHANGE_TTL_HOURS];
    }

    public function confirmEmailChange(CodeMartV1UserModel $user, string $token): array
    {
        $change = CodeMartV1EmailChangeModel::findPendingForUser((int) $user->id, hash('sha256', $token));
        if (!$change) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_EMAIL_CHANGE_TOKEN, __('codemart.messages.email_change_token_invalid'), 422);
        }
        $newEmail = (string) $change->new_email;
        if ($this->emailTaken($newEmail, (int) $user->id)) {
            return self::failure(CodeMartV1Constants::ERROR_EMAIL_TAKEN, __('codemart.messages.email_change_taken'), 422);
        }

        // The identity row lives on the default connection, the change request on the CodeMart one:
        // the account is updated first, so a repeated confirmation is idempotent if marking fails.
        $user->email = $newEmail;
        $user->email_verified_at = now();
        $user->saveRecord();
        $change->updateRecord(['confirmed_at' => now()]);
        CodeMartV1EmailVerificationModel::replaceForEmail($newEmail, Str::random(64));
        CodeMartV1EmailVerificationModel::query()->where('email', $newEmail)->update(['verified_at' => now()]);

        CodeMartV1DomainEventService::emit((int) $user->id, CodeMartV1Constants::RESOURCE_USER, (int) $user->id, 'email_changed');

        return ['email' => $newEmail];
    }

    private function emailTaken(string $email, int $exceptUserId): bool
    {
        $other = CodeMartV1UserModel::findByEmail($email);

        return $other !== null && (int) $other->id !== $exceptUserId;
    }
}
