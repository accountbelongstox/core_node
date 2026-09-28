<?php

return [
    'client_key_missing' => 'A client-key signature is required, or the shared client key is not installed on this server.',
    'client_key_unknown' => 'The client key id is not known to this server.',
    'client_key_protocol_invalid' => 'The client, protocol version or machine id header is invalid.',
    'client_key_timestamp_invalid' => 'The request timestamp is missing or outside the allowed clock skew.',
    'client_key_nonce_invalid' => 'The request nonce is missing or malformed.',
    'client_key_nonce_replayed' => 'The request nonce was already used.',
    'client_key_body_digest_invalid' => 'The request body digest does not match the transmitted body.',
    'client_key_signature_invalid' => 'The client-key signature is invalid.',
    'local_key_missing' => 'The shared client key :name is not installed; run dd.sh or dd.cmd to decrypt the secret store.',
];
