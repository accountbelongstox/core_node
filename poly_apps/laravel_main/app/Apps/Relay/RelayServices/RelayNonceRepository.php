<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayModels\RelayNonceModel;

final class RelayNonceRepository
{
    public function claim(string $credentialScope, string $nonce): void
    {
        $inserted = RelayNonceModel::query()->insertOrIgnore([[
            'credential_scope' => $credentialScope,
            'nonce_hash' => hash('sha256', $nonce),
            'expires_at' => now()->addSeconds(RelayContract::duration('nonce_retention_seconds')),
            'created_at' => now(),
        ]]);
        if ($inserted !== 1) {
            throw new RelayDomainException('signature_nonce_replayed', 409);
        }
    }

    public function pruneExpired(int $limit): int
    {
        $ids = RelayNonceModel::query()
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id')
            ->all();
        if ($ids === []) {
            return 0;
        }

        return RelayNonceModel::query()->whereIn('id', $ids)->delete();
    }
}
