<?php

namespace App\Apps\Relay\RelayGvar;

final class RelayConstants
{
    public const ENROLLMENT_PENDING = 'pending';
    public const ENROLLMENT_CLAIMED = 'claimed';
    public const ENROLLMENT_EXPIRED = 'expired';
    public const ENROLLMENT_REVOKED = 'revoked';
    public const CREDENTIAL_ACTIVE = 'active';
    public const CREDENTIAL_REVOKED = 'revoked';
    public const PAIRING_ACTIVE = 'active';
    public const PAIRING_REVOKED = 'revoked';
    public const PAIRING_EXPIRED = 'expired';
    public const BLOB_REQUEST = 'request';
    public const BLOB_RESPONSE = 'response';
    public const OUTBOX_PENDING = 'pending';
    public const OUTBOX_PUBLISHED = 'published';
    public const OUTBOX_DEAD = 'dead';

    private function __construct()
    {
    }
}
