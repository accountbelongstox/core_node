<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;

final class AppQyV1AudioGateway
{
    private ?AppQyV1WordAudioGateway $wordGateway;
    private ?AppQyV1SentenceAudioService $sentenceGateway;

    public function __construct(
        ?AppQyV1WordAudioGateway $wordGateway = null,
        ?AppQyV1SentenceAudioService $sentenceGateway = null
    ) {
        $this->wordGateway = $wordGateway;
        $this->sentenceGateway = $sentenceGateway;
    }

    public function requestWord(
        string $word,
        string $language,
        ?string $accent = null,
        bool $enqueueMissing = true,
        bool $moveToHead = true
    ): array {
        return $this->wordGateway()->request(
            $word,
            $language,
            $accent,
            $enqueueMissing,
            $moveToHead
        );
    }

    public function requestWordBatch(array $words, string $language): array
    {
        return $this->wordGateway()->requestBatch($words, $language);
    }

    public function requestSentence(
        ?string $hash,
        ?string $text,
        ?string $language,
        ?string $variantKey = null,
        ?string $accent = null,
        bool $enqueueMissing = true
    ): array {
        return $this->sentenceGateway()->resolve(
            $hash,
            $text,
            $language,
            $variantKey,
            $accent,
            $enqueueMissing
        );
    }

    public function requestSentenceBatch(array $items): array
    {
        return $this->sentenceGateway()->moveToHeadBatch($items);
    }

    public function resolveWordAudioUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        return $this->wordGateway()->resolveAudioUrl($row);
    }

    public function resolveWordAudioPick(
        AppQyV1LangDictionaryModel $row,
        ?string $accent = null
    ): array {
        return $this->wordGateway()->resolveAudioPick($row, $accent);
    }

    public function wordAudioVariantsForApi(
        AppQyV1LangDictionaryModel $row,
        string $language
    ): array {
        return $this->wordGateway()->audioVariantsForApi($row, $language);
    }

    private function wordGateway(): AppQyV1WordAudioGateway
    {
        return $this->wordGateway ??= new AppQyV1WordAudioGateway();
    }

    private function sentenceGateway(): AppQyV1SentenceAudioService
    {
        return $this->sentenceGateway ??= new AppQyV1SentenceAudioService();
    }
}
