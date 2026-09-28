<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Services\SafeMigrationHelper;
use RuntimeException;

final class AppQyV1ArticleIdentityRepairService
{
    private const BATCH_SIZE = 200;
    private const GROUP_BATCH_SIZE = 100;
    private const AUDIO_METADATA_KEYS = [
        'audio_url',
        'audio_status',
        'audio_sha256',
        'audio_files',
        'audio_replaced_at',
        'audio_rebuilt_at',
        'tts_engine',
        'tts_model',
        'tts_chunked',
        'tts_accent',
    ];

    public static function ensureSchema(): array
    {
        $model = new AppQyV1Article();
        $connectionName = (string) $model->getConnection()->getName();
        $tableName = $model->getTable();
        $schema = $model->getConnection()->getSchemaBuilder();
        $tableStructure = [
            'columns' => [
                'title_md5' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => true,
                    'comment' => 'MD5 of the exact article title',
                ],
                'content_md5' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => true,
                    'comment' => 'MD5 of the exact article content',
                ],
                'canonical_article_id' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => true,
                    'comment' => 'Canonical article ID for retained duplicate rows',
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['user_id', 'title_md5', 'content_md5'],
                    'name' => 'idx_articles_content_identity',
                ],
                [
                    'columns' => ['canonical_article_id'],
                    'name' => 'idx_articles_canonical',
                ],
            ],
        ];

        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'table_missing',
                'actions' => [],
                'message' => 'Article table is not available',
            ];
        }

        return SafeMigrationHelper::alignTableStructureFromArray(
            $connectionName,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public static function repair(): array
    {
        $schemaResult = self::ensureSchema();
        $hashesBackfilled = 0;
        $duplicateResult = [];

        if (($schemaResult['status'] ?? '') === 'table_missing') {
            throw new RuntimeException((string) $schemaResult['message']);
        }

        $hashesBackfilled = self::backfillMissingHashes();
        $duplicateResult = self::reconcileDuplicateGroups();

        return [
            'schema_status' => $schemaResult['status'] ?? 'unknown',
            'hashes_backfilled' => $hashesBackfilled,
            'duplicate_groups' => $duplicateResult['groups'],
            'aliases_linked' => $duplicateResult['aliases'],
            'canonicals_updated' => $duplicateResult['canonicals'],
        ];
    }

    private static function backfillMissingHashes(): int
    {
        $updated = 0;
        $query = AppQyV1Article::query()
            ->select(['id', 'title', 'content', 'title_md5', 'content_md5'])
            ->where(function ($missingQuery): void {
                $missingQuery->whereNull('title_md5')
                    ->orWhere('title_md5', '')
                    ->orWhereNull('content_md5')
                    ->orWhere('content_md5', '');
            });

        $query->orderBy('id')->chunkById(
            self::BATCH_SIZE,
            static function ($rows) use (&$updated): void {
                foreach ($rows as $row) {
                    $hashes = AppQyV1Article::identityHashes(
                        (string) $row->title,
                        (string) $row->content
                    );
                    $attributes = [];

                    if (trim((string) $row->title_md5) === '') {
                        $attributes['title_md5'] = $hashes['title_md5'];
                    }
                    if (trim((string) $row->content_md5) === '') {
                        $attributes['content_md5'] = $hashes['content_md5'];
                    }
                    if ($attributes !== []) {
                        $updated += AppQyV1Article::query()
                            ->whereKey($row->getKey())
                            ->update($attributes);
                    }
                }
            },
            'id'
        );

        return $updated;
    }

    private static function reconcileDuplicateGroups(): array
    {
        $groups = AppQyV1Article::query()
            ->select(['user_id', 'title_md5', 'content_md5'])
            ->whereNull('canonical_article_id')
            ->whereNotNull('title_md5')
            ->whereNotNull('content_md5')
            ->groupBy(['user_id', 'title_md5', 'content_md5'])
            ->havingRaw('COUNT(*) > 1')
            ->orderBy('title_md5')
            ->orderBy('content_md5')
            ->get();
        $groupCount = 0;
        $aliasCount = 0;
        $canonicalCount = 0;

        foreach ($groups->chunk(self::GROUP_BATCH_SIZE) as $groupBatch) {
            foreach ($groupBatch as $group) {
                $result = self::reconcileGroup(
                    $group->user_id !== null ? (int) $group->user_id : null,
                    (string) $group->title_md5,
                    (string) $group->content_md5
                );
                $groupCount += $result['group'];
                $aliasCount += $result['aliases'];
                $canonicalCount += $result['canonical'];
            }
        }

        return [
            'groups' => $groupCount,
            'aliases' => $aliasCount,
            'canonicals' => $canonicalCount,
        ];
    }

    private static function reconcileGroup(?int $userId, string $titleMd5, string $contentMd5): array
    {
        $model = new AppQyV1Article();

        return $model->getConnection()->transaction(
            static function () use ($userId, $titleMd5, $contentMd5): array {
                $query = AppQyV1Article::query()
                    ->where('title_md5', $titleMd5)
                    ->where('content_md5', $contentMd5)
                    ->whereNull('canonical_article_id');
                if ($userId === null) {
                    $query->whereNull('user_id');
                } else {
                    $query->where('user_id', $userId);
                }
                $articles = $query->latest('id')->lockForUpdate()->get();
                if ($articles->count() < 2) {
                    return ['group' => 0, 'aliases' => 0, 'canonical' => 0];
                }

                $canonical = $articles->shift();
                $canonicalMetadata = is_array($canonical->metadata) ? $canonical->metadata : [];
                $canonicalChanged = false;
                $aliasCount = 0;

                foreach ($articles as $alias) {
                    $aliasMetadata = is_array($alias->metadata) ? $alias->metadata : [];
                    $mergedMetadata = AppQyV1Article::mergeIdentityMetadata(
                        $aliasMetadata,
                        $canonicalMetadata
                    );
                    if (self::audioMetadataScore($aliasMetadata) > self::audioMetadataScore($mergedMetadata)) {
                        foreach (self::AUDIO_METADATA_KEYS as $key) {
                            if (array_key_exists($key, $aliasMetadata)) {
                                $mergedMetadata[$key] = $aliasMetadata[$key];
                            }
                        }
                    }
                    if ($mergedMetadata !== $canonicalMetadata) {
                        $canonicalMetadata = $mergedMetadata;
                        $canonicalChanged = true;
                    }
                    if ((bool) $alias->tts_generated && !(bool) $canonical->tts_generated) {
                        $canonical->tts_generated = true;
                        $canonicalChanged = true;
                    }
                    $alias->canonical_article_id = (string) $canonical->article_id;
                    $alias->saveRecord();
                    $aliasCount++;
                }

                if ($canonicalChanged) {
                    $canonical->metadata = $canonicalMetadata;
                    $canonical->saveRecord();
                }

                return [
                    'group' => 1,
                    'aliases' => $aliasCount,
                    'canonical' => $canonicalChanged ? 1 : 0,
                ];
            },
            5
        );
    }

    private static function audioMetadataScore(array $metadata): int
    {
        $score = 0;

        if (($metadata['audio_status'] ?? null) === 'ready') {
            $score += 4;
        }
        if (trim((string) ($metadata['audio_sha256'] ?? '')) !== '') {
            $score += 2;
        }
        if (trim((string) ($metadata['audio_url'] ?? '')) !== '') {
            $score += 1;
        }
        if (trim((string) ($metadata['audio_rebuilt_at'] ?? '')) !== '') {
            $score += 8;
        }

        return $score;
    }
}
