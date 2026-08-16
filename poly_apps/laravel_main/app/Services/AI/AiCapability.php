<?php

namespace App\Services\AI;

enum AiCapability: string
{
    case Audio = 'audio';
    case Embeddings = 'embeddings';
    case Files = 'files';
    case Images = 'images';
    case Reranking = 'reranking';
    case Text = 'text';
    case Transcription = 'transcription';
}
