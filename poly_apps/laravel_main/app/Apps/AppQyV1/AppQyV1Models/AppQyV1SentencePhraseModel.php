<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\BindsAppQyV1LanguageTable;

/**
 * Per-language sentence -> phrase links {prefix}_sentence_phrases_{lang}
 * (docs_fix/DESIGN_PHRASE_PIPELINE.md §3): one row per (sentence_content_id,
 * phrase_content_id), `ord` = position of the phrase within the sentence.
 * Bound dynamically; obtain an instance via AppQyV1SentencePhraseModel::for($lang).
 */
class AppQyV1SentencePhraseModel extends AppQyV1Model
{
    use BindsAppQyV1LanguageTable;

    public const UPDATED_AT = null;

    private const LOOKUP_CHUNK = 500;

    protected $fillable = [
        'sentence_content_id',
        'phrase_content_id',
        'ord',
    ];

    protected function casts(): array
    {
        return [
            'ord' => 'integer',
        ];
    }

    protected static function resolveLanguageTable(string $language): string
    {
        return AppQyV1TableMaps::getSentencePhraseTableName(AppQyV1TableMaps::normalizeLangCode($language));
    }

    /**
     * Linked phrases of the given sentences, ordered by `ord`.
     *
     * @param array<int,string> $sentenceContentIds
     * @return array<string,array<int,array{content_id:string,text:string,meaning:?string,has_audio:bool,updated_at:?string}>>
     *         sentence content_id => ordered phrase rows (sentences without links are absent)
     */
    public static function phrasesForSentences(string $lang, array $sentenceContentIds): array
    {
        $result = [];
        $sentenceContentIds = array_values(array_unique(array_filter(array_map('strval', $sentenceContentIds), static fn (string $id): bool => $id !== '')));
        if ($sentenceContentIds === [] || !self::tableExists($lang) || !AppQyV1LangPhraseModel::tableExists($lang)) {
            return $result;
        }
        $links = self::for($lang);
        $linkTable = $links->getTable();
        $phraseTable = AppQyV1LangPhraseModel::for($lang)->getTable();

        foreach (array_chunk($sentenceContentIds, self::LOOKUP_CHUNK) as $chunk) {
            $rows = $links->getConnection()->table($linkTable . ' as l')
                ->join($phraseTable . ' as p', 'p.content_id', '=', 'l.phrase_content_id')
                ->whereIn('l.sentence_content_id', $chunk)
                ->orderBy('l.sentence_content_id')
                ->orderBy('l.ord')
                ->orderBy('l.id')
                ->get(['l.sentence_content_id', 'p.content_id', 'p.text', 'p.meaning', 'p.has_audio', 'p.updated_at']);
            foreach ($rows as $row) {
                $result[trim((string) $row->sentence_content_id)][] = [
                    'content_id' => trim((string) $row->content_id),
                    'text' => (string) $row->text,
                    'meaning' => $row->meaning !== null ? (string) $row->meaning : null,
                    'has_audio' => (bool) $row->has_audio,
                    'updated_at' => $row->updated_at !== null ? (string) $row->updated_at : null,
                ];
            }
        }

        return $result;
    }
}
