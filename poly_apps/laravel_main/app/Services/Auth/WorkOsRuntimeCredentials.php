<?php

namespace App\Services\Auth;

final class WorkOsRuntimeCredentials
{
    public function apiKey(): ?string
    {
        return config('services.workos.api_key');
    }

    public function clientId(): ?string
    {
        return config('services.workos.client_id');
    }

    public function clientSecret(): ?string
    {
        return config('services.workos.client_secret');
    }

    public function redirectUrl(string $default): string
    {
        return config('services.workos.redirect_url') ?? $default;
    }

    public function supportsAuthorizationCode(): bool
    {
        return $this->apiKey() !== null && $this->clientId() !== null;
    }

    public function supportsPasswordAuthentication(): bool
    {
        return $this->supportsAuthorizationCode() && $this->clientSecret() !== null;
    }
}
