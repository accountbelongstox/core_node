<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

/**
 * A pipeline step waits on live pycore tasks: the background runner keeps the
 * task processing with its checkpoint and resumes it on a later tick.
 */
final class VoiceSubtitleV1PipelineSuspended extends \RuntimeException
{
}
