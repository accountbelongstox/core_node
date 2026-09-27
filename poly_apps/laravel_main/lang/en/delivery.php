<?php

return [
    'info_loaded' => 'Delivery information loaded.',
    'diff_computed' => 'Delivery diff computed.',
    'batch_registered' => 'Delivery batch registered.',
    'batch_content_received' => 'Delivery batch content chunk accepted.',
    'batch_status_loaded' => 'Delivery batch status loaded.',
    'invalid_key' => 'The item key does not match the "<lang>:<md5>[:<variant>]" format.',
    'delivery_validation_failed' => 'The delivery request is invalid.',
    'delivery_kind_unsupported' => 'The delivery kind is not supported by this endpoint.',
    'delivery_batch_too_large' => 'The batch exceeds the item or total size limit; split it.',
    'delivery_batch_not_found' => 'The delivery batch does not exist or has expired; register the manifest again.',
    'delivery_batch_content_mismatch' => 'The uploaded batch content does not match the item hashes; register the manifest and upload again.',
    'delivery_upload_invalid' => 'The batch content chunk was rejected (offset, size or hash mismatch).',
    'delivery_store_failed' => 'The completed batch content could not be stored.',
];
