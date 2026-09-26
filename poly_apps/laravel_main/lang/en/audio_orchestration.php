<?php

return [
    'content_id_mismatch' => 'The sentence text does not match the reported content identifier.',
    'orch_audio_tasks_ingested' => 'Orchestration tasks stored.',
    'orch_audio_segment_received' => 'Segment audio chunk accepted.',
    'orch_audio_tasks_loaded' => 'Orchestrated audio loaded.',
    'orch_audio_task_loaded' => 'Orchestrated audio task loaded.',
    'orch_audio_validation_failed' => 'The orchestrated audio request is invalid.',
    'orch_audio_task_not_found' => 'The orchestrated audio task does not exist; send its metadata first.',
    'orch_audio_segment_undeclared' => 'The segment index is not declared by the stored task; resend the task metadata.',
    'orch_audio_segment_hash_mismatch' => 'The uploaded audio hash differs from the declared segment hash; resend the task metadata.',
    'orch_audio_upload_invalid' => 'The audio chunk was rejected (offset, size or hash mismatch).',
    'orch_audio_store_failed' => 'The completed segment audio could not be stored.',
];
