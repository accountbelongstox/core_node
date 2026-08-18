<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * One-time DEDUP of vocabulary_libraries (runs BEFORE the NOT-NULL + UNIQUE
 * constraint migration AppQyV1_2026_06_20_200002 so the constraint can be added
 * without violation).
 *
 * Root cause being repaired: two sys:init import paths both inserted library
 * rows and the `source` unique index was unenforceable (nullable -> many NULLs
 * allowed), so each public library could exist twice (8 unique -> 16 rows).
 *
 * What this does, per canonical key (normalized `source`, else name+language):
 *   1. Backfill a NOT-NULL canonical `source` on every row whose source is
 *      NULL/blank (derived from name+language; slugified).
 *   2. Group by the canonical key, keep the LOWEST id as the survivor, UNION the
 *      duplicates' word_ids into the survivor (fill-missing: never shrink),
 *      recompute total_words, then delete the duplicate rows.
 *
 * Idempotent: re-running finds no remaining duplicates and no blank sources, so
 * it is a no-op. Cross-DB safe (pgsql + sqlite): pure Eloquent/queries, JSON
 * handled in PHP, no driver-specific SQL.
 */
return new class extends Migration
{
    // NOTE: $connection is inherited from Migration as an UNTYPED property, so it
    // MUST stay untyped here (a `string` type triggers a fatal "must be omitted to
    // match the parent definition"). $tableName is new, so it may be typed.
    protected $connection;
    protected string $tableName;

    public function __construct()
    {
        $appKey = AppKeys::APPQYV1;
        $this->connection = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);
        if (!$schema->hasTable($this->tableName)) {
            // Nothing to dedup yet (fresh install creates the table empty).
            return;
        }

        $conn = DB::connection($this->connection);

        // Step 1: backfill a canonical NOT-NULL source on PUBLIC/SYSTEM rows
        // missing one. Restricted to the public catalogue (is_public = true AND
        // owner_user_id IS NULL) because that is the only place the duplicate-
        // import bug created rows. A private user library with a NULL source is
        // left untouched here so it can never be merged across owners (its
        // owner-scoped grouping key below is also defensive).
        $blankSourceRows = $conn->table($this->tableName)
            ->whereNull('owner_user_id')
            ->where('is_public', true)
            ->where(function ($q) {
                $q->whereNull('source')->orWhere('source', '');
            })
            ->get(['id', 'name', 'language']);

        foreach ($blankSourceRows as $row) {
            $conn->table($this->tableName)
                ->where('id', $row->id)
                ->update(['source' => $this->deriveSource($row->name, $row->language)]);
        }

        // Step 2: group every row by its OWNER-SCOPED canonical key (normalized
        // source when present, else owner|name|language) and collapse duplicates
        // into the lowest-id survivor. owner_user_id is part of the key so a
        // blank-source private library of one user is never grouped with another
        // user's same name+language library.
        $rows = $conn->table($this->tableName)
            ->orderBy('id')
            ->get(['id', 'source', 'name', 'language', 'owner_user_id', 'word_ids', 'total_words']);

        $groups = [];
        foreach ($rows as $row) {
            $key = $this->canonicalKey($row->source, $row->name, $row->language, $row->owner_user_id);
            if (!isset($groups[$key])) {
                $groups[$key] = [];
            }
            $groups[$key][] = $row;
        }

        foreach ($groups as $members) {
            if (count($members) < 2) {
                continue;
            }

            // Lowest id is already first (rows fetched orderBy id).
            $survivor = $members[0];
            $mergedIds = $this->decodeIds($survivor->word_ids);
            $seen = array_flip($mergedIds);

            $duplicateIds = [];
            foreach (array_slice($members, 1) as $dup) {
                $duplicateIds[] = (int) $dup->id;
                // Union the duplicate's word_ids into the survivor (fill-missing).
                foreach ($this->decodeIds($dup->word_ids) as $wid) {
                    if (isset($seen[$wid])) {
                        continue;
                    }
                    $mergedIds[] = $wid;
                    $seen[$wid] = true;
                }
            }

            $conn->table($this->tableName)
                ->where('id', $survivor->id)
                ->update([
                    'word_ids' => json_encode(array_values($mergedIds)),
                    'total_words' => count($mergedIds),
                ]);

            if (!empty($duplicateIds)) {
                // Re-point every foreign reference from the duplicate ids to the
                // survivor BEFORE deleting the duplicate rows, so no orphaned
                // selection / group-link / uploaded-document is left behind.
                $this->repointReferences($conn, (int) $survivor->id, $duplicateIds);

                $conn->table($this->tableName)->whereIn('id', $duplicateIds)->delete();
            }
        }
    }

    /**
     * Re-point referencing tables from $duplicateIds to $survivorId, run BEFORE
     * the duplicate library rows are deleted so no dangling references remain.
     * Each referencing table is guarded with hasTable() and skipped if absent on
     * this install. Table names + columns come from the app's table-prefix
     * helper / TableMaps (never hardcoded).
     *
     * Tables handled:
     *   - user_selected_libraries.collection_id  (FIRST collapse colliding
     *     (user_id, collection_id) pairs so the re-point cannot create a
     *     duplicate active selection)
     *   - group_libraries.library_id
     *   - uploaded_documents.collection_id
     */
    private function repointReferences($conn, int $survivorId, array $duplicateIds): void
    {
        $schema = Schema::connection($this->connection);
        $appKey = AppKeys::APPQYV1;

        // ---- user_selected_libraries (user_id, collection_id) ----
        $uslTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'user_selected_libraries');
        if ($schema->hasTable($uslTable)) {
            // A user may already have the survivor selected AND a duplicate
            // selected. Re-pointing the duplicate to the survivor would create
            // two (user_id, survivor) rows. Pre-collapse: for each user that
            // would collide, delete the duplicate-pointing selection rows and
            // keep the survivor-pointing one (or the lowest-id duplicate when no
            // survivor row exists yet, handled by the re-point that follows).
            $usersWithSurvivor = $conn->table($uslTable)
                ->where('collection_id', $survivorId)
                ->pluck('user_id')
                ->all();

            if (!empty($usersWithSurvivor)) {
                // Drop the duplicate-pointing rows for users that already own a
                // survivor-pointing selection (would collide on re-point).
                $conn->table($uslTable)
                    ->whereIn('collection_id', $duplicateIds)
                    ->whereIn('user_id', $usersWithSurvivor)
                    ->delete();
            }

            // Among the remaining duplicate-pointing rows, a single user could
            // still hold selections to TWO different duplicate ids. Keep the
            // lowest-id such row per user, delete the rest, so the re-point below
            // yields at most one (user_id, survivor) row per user.
            $remaining = $conn->table($uslTable)
                ->whereIn('collection_id', $duplicateIds)
                ->orderBy('id')
                ->get(['id', 'user_id']);
            $seenUser = [];
            $extraSelectionIds = [];
            foreach ($remaining as $sel) {
                $uid = (string) $sel->user_id;
                if (isset($seenUser[$uid])) {
                    $extraSelectionIds[] = (int) $sel->id;
                    continue;
                }
                $seenUser[$uid] = true;
            }
            if (!empty($extraSelectionIds)) {
                $conn->table($uslTable)->whereIn('id', $extraSelectionIds)->delete();
            }

            // Now the re-point cannot create a duplicate (user_id, survivor) pair.
            $conn->table($uslTable)
                ->whereIn('collection_id', $duplicateIds)
                ->update(['collection_id' => $survivorId]);
        }

        // ---- group_libraries.library_id ----
        $glTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'group_libraries');
        if ($schema->hasTable($glTable)) {
            // A group could link both the survivor and a duplicate; collapse the
            // colliding (group_id, library_id) pairs first (keep lowest id),
            // then re-point the rest.
            if ($schema->hasColumn($glTable, 'group_id')) {
                $groupsWithSurvivor = $conn->table($glTable)
                    ->where('library_id', $survivorId)
                    ->pluck('group_id')
                    ->all();
                if (!empty($groupsWithSurvivor)) {
                    $conn->table($glTable)
                        ->whereIn('library_id', $duplicateIds)
                        ->whereIn('group_id', $groupsWithSurvivor)
                        ->delete();
                }

                $remainingLinks = $conn->table($glTable)
                    ->whereIn('library_id', $duplicateIds)
                    ->orderBy('id')
                    ->get(['id', 'group_id']);
                $seenGroup = [];
                $extraLinkIds = [];
                foreach ($remainingLinks as $link) {
                    $gid = (string) $link->group_id;
                    if (isset($seenGroup[$gid])) {
                        $extraLinkIds[] = (int) $link->id;
                        continue;
                    }
                    $seenGroup[$gid] = true;
                }
                if (!empty($extraLinkIds)) {
                    $conn->table($glTable)->whereIn('id', $extraLinkIds)->delete();
                }
            }

            $conn->table($glTable)
                ->whereIn('library_id', $duplicateIds)
                ->update(['library_id' => $survivorId]);
        }

        // ---- uploaded_documents.collection_id ----
        $udTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'uploaded_documents');
        if ($schema->hasTable($udTable)) {
            // No uniqueness constraint to honour; a straight re-point is enough.
            $conn->table($udTable)
                ->whereIn('collection_id', $duplicateIds)
                ->update(['collection_id' => $survivorId]);
        }
    }

    public function down(): void
    {
        // Irreversible data merge: deleted duplicate rows cannot be recreated.
        // No-op (the surviving rows remain valid).
    }

    /**
     * Owner-scoped canonical comparison key.
     *
     * When a (normalized) source is present it already encodes identity
     * (system sources are globally unique to the catalogue; user-upload sources
     * are owner+language+name scoped), so it is used directly. For a blank
     * source the key falls back to owner|name|language so two different users'
     * private libraries with the same name+language are NEVER merged.
     */
    private function canonicalKey(?string $source, ?string $name, ?string $language, $ownerUserId): string
    {
        $source = trim((string) $source);
        if ($source !== '') {
            return 's:' . mb_strtolower($source);
        }
        $owner = ($ownerUserId === null || $ownerUserId === '') ? 'null' : (string) $ownerUserId;
        return 'o:' . $owner . '|' . mb_strtolower(trim((string) $name)) . '|' . mb_strtolower(trim((string) $language));
    }

    /**
     * Derive a NOT-NULL source slug from name+language (slugify: lowercase,
     * non-alphanumeric runs -> single '_'). Never returns empty.
     */
    private function deriveSource(?string $name, ?string $language): string
    {
        $base = mb_strtolower(trim((string) $name)) . '_' . mb_strtolower(trim((string) $language));
        $slug = preg_replace('/[^a-z0-9]+/u', '_', $base);
        $slug = trim((string) $slug, '_');
        if ($slug === '') {
            $slug = 'lib_' . md5($base);
        }
        return $slug;
    }

    /**
     * Decode a word_ids cell (JSON string OR already-array) into a flat int list.
     */
    private function decodeIds($raw): array
    {
        if (is_array($raw)) {
            $decoded = $raw;
        } else {
            if ($raw === null || $raw === '') {
                return [];
            }
            $decoded = json_decode((string) $raw, true);
        }
        if (!is_array($decoded)) {
            return [];
        }
        return array_map('intval', array_values($decoded));
    }
};
