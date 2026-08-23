<?php

namespace App\Apps\RelayV2\RelayV2Gvar;

final class RelayV2Constants
{
    public const STATE_ACCEPTED = 'accepted';
    public const STATE_LEASED = 'leased';
    public const STATE_EXECUTING = 'executing';
    public const STATE_CANCEL_REQUESTED = 'cancel_requested';
    public const STATE_RESPONDED = 'responded';
    public const STATE_FAILED = 'failed';
    public const STATE_EXECUTION_UNKNOWN = 'execution_unknown';
    public const STATE_EXPIRED = 'expired';
    public const STATE_CANCELED = 'canceled';
    public const RETRY_READ = 'read';
    public const RETRY_IDEMPOTENT_WRITE = 'idempotent_write';
    public const RETRY_AT_MOST_ONCE = 'at_most_once_action';
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
