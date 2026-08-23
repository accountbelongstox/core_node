<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Models\RelayV2NonceModel;

final class RelayV2NonceRepository
{
    public function claim(string $credentialScope, string $nonce): void
    {
        $inserted = RelayV2NonceModel::query()->insertOrIgnore([[
            'credential_scope' => $credentialScope,
            'nonce_hash' => hash('sha256', $nonce),
            'expires_at' => now()->addSeconds(RelayV2Contract::duration('nonce_retention_seconds')),
            'created_at' => now(),
        ]]);
        if ($inserted !== 1) {
            throw new RelayV2DomainException('signature_nonce_replayed', 409);
        }
    }

    public function pruneExpired(int $limit): int
    {
        $ids = RelayV2NonceModel::query()
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id')
            ->all();
        if ($ids === []) {
            return 0;
        }

        return RelayV2NonceModel::query()->whereIn('id', $ids)->delete();
    }
}
