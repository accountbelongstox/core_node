<?php

namespace App\Utils;

use App\Helpers\AuthHelper;
use App\Providers\GlobalTablesMap;
use App\Providers\PathMapper;
use App\Services\Realtime\MercurePublisher;
use App\Services\Relay\RelayHubJwt;
use App\Support\CloudClipboardContract as Contract;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class CloudClipboardService
{
    private function db(): ConnectionInterface
    {
        return DB::connection(GlobalTablesMap::getConnection());
    }

    private function rooms(): Builder
    {
        return $this->db()->table(GlobalTablesMap::getTableName('CLOUD_CLIPBOARD_ROOMS'));
    }

    private function entries(): Builder
    {
        return $this->db()->table(GlobalTablesMap::getTableName('CLOUD_CLIPBOARD_ENTRIES'));
    }

    public function namespace(Request $request): string
    {
        $namespace = strtolower(trim((string) $request->input('namespace', '')));

        abort_unless($namespace === '' || preg_match('/'.Contract::get('namespace_pattern').'$/D', $namespace),
            422, __('cloud_clipboard.invalid_namespace'));

        return $namespace;
    }

    private function emptyEntry(string $roomId, ?string $entryId = null): array
    {
        return [
            'id' => $entryId ?? (string) Str::uuid(), 'room_id' => $roomId,
            'text' => '', 'files' => '[]', 'revision' => 0, 'editor_user_id' => null,
            'created_at' => now(), 'updated_at' => now(),
        ];
    }

    private function createRoom(string $namespace): bool
    {
        $id = (string) Str::uuid();
        $entryId = (string) Str::uuid();

        return $this->db()->transaction(function () use ($namespace, $id, $entryId) {
            $inserted = $this->rooms()->insertOrIgnore([
                'id' => $id, 'namespace' => $namespace, 'password_hash' => null,
                'topic_key' => (string) Str::uuid(), 'current_entry_id' => $entryId,
                'revision' => 0, 'created_at' => now(), 'updated_at' => now(),
            ]);
            if ($inserted) {
                $this->entries()->insert($this->emptyEntry($id, $entryId));
            }

            return (bool) $inserted;
        });
    }

    public function generate(): string
    {
        $alphabet = Contract::get('namespace_alphabet');
        $name = '';
        $letter = '';

        do {
            $name = '';
            while (strlen($name) < Contract::get('namespace_length')) {
                $letter = $alphabet[random_int(0, strlen($alphabet) - 1)];
                if (!str_contains($name, $letter)) {
                    $name .= $letter;
                }
            }
        } while (!$this->createRoom($name));

        return $name;
    }

    private function authorize(object $room, Request $request): void
    {
        $password = base64_decode((string) $request->header(Contract::get('password_header'), ''), true);

        abort_if($room->password_hash !== null && ($password === false || !Hash::check(hash('sha256', $password), $room->password_hash)),
            403, __('cloud_clipboard.password_required'));
    }

    private function room(Request $request, bool $lock = false): object
    {
        $namespace = $this->namespace($request);
        $query = $this->rooms()->where('namespace', $namespace);
        $room = null;

        if (!$query->exists()) {
            $this->createRoom($namespace);
        }
        $room = ($lock ? $query->lockForUpdate() : $query)->first();
        $this->authorize($room, $request);

        return $room;
    }

    private function present(object $entry): array
    {
        return [
            'id' => $entry->id, 'text' => $entry->text,
            'files' => json_decode($entry->files, true, 512, JSON_THROW_ON_ERROR),
            'revision' => (int) $entry->revision,
            'created_at' => $entry->created_at, 'updated_at' => $entry->updated_at,
        ];
    }

    private function topic(object $room): string
    {
        return 'urn:core-node:cloud-clipboard:'.$room->id.':'.$room->topic_key;
    }

    public function snapshot(Request $request): array
    {
        return $this->db()->transaction(function () use ($request) {
            $room = $this->room($request, true);
            $page = max(1, (int) $request->input('page', 1));
            $history = $this->entries()->where('room_id', $room->id)->where('id', '!=', $room->current_entry_id);
            $count = (clone $history)->count();
            $current = $this->entries()->where('id', $room->current_entry_id)->first();

            if ($request->has('since_revision') && (int) $request->input('since_revision') === (int) $room->revision) {
                return ['unchanged' => true, 'revision' => (int) $room->revision];
            }

            return [
                'namespace' => $room->namespace, 'revision' => (int) $room->revision,
                'protected' => $room->password_hash !== null, 'current' => $this->present($current),
                'history' => $history->orderByDesc('created_at')->orderByDesc('id')
                    ->forPage($page, Contract::get('history_page_size'))->get()->map(fn ($entry) => $this->present($entry))->all(),
                'history_total' => $count, 'page' => $page, 'page_size' => Contract::get('history_page_size'),
                'hub_url' => RelayHubJwt::hubUrl(), 'topics' => [$this->topic($room)],
            ];
        });
    }

    public function hubAuthorization(Request $request): array
    {
        $room = $this->room($request);
        $ttl = Contract::get('token_ttl_seconds');

        return [
            'token' => RelayHubJwt::subscriberTokenForTtl('clipboard:'.$room->id, [$this->topic($room)], $ttl),
            'token_ttl_seconds' => $ttl,
        ];
    }

    private function archive(object $entry): void
    {
        $copy = (array) $entry;

        if ($entry->text === '' && $entry->files === '[]') {
            return;
        }
        $copy['id'] = (string) Str::uuid();
        $copy['created_at'] = now();
        $copy['updated_at'] = now();
        $this->entries()->insert($copy);
    }

    public function mutate(Request $request, string $action): array
    {
        $result = $this->db()->transaction(function () use ($request, $action) {
            $room = $this->room($request, true);
            $entryId = (string) $request->input('entry_id', $room->current_entry_id);
            $entry = $this->entries()->where('room_id', $room->id)->where('id', $entryId)->first();
            $changes = [];
            $files = [];
            $fileId = (string) $request->input('file_id', '');
            $revision = (int) $room->revision + 1;
            $oldTopic = $this->topic($room);
            $newEntry = null;
            $password = null;
            $id = '';
            $path = '';
            $removedFiles = [];

            abort_if($entry === null, 404, __('cloud_clipboard.entry_missing'));
            abort_unless($request->has('expected_revision')
                && (int) $request->input('expected_revision') === (int) $entry->revision,
                409, __('cloud_clipboard.conflict'));
            if ($action === 'password') {
                abort_unless($request->has('expected_room_revision')
                    && (int) $request->input('expected_room_revision') === (int) $room->revision,
                    409, __('cloud_clipboard.conflict'));
                $password = (string) $request->input('new_password', '');
                $this->rooms()->where('id', $room->id)->update([
                    'password_hash' => $password === '' ? null : Hash::make(hash('sha256', $password)),
                    'topic_key' => (string) Str::uuid(),
                ]);
            } elseif ($action === 'new' || $action === 'restore') {
                abort_unless((string) $request->input('expected_current_entry_id') === $room->current_entry_id,
                    409, __('cloud_clipboard.conflict'));
                $newEntry = $this->emptyEntry($room->id);
                if ($action === 'restore') {
                    $newEntry['text'] = $entry->text;
                    $newEntry['files'] = $entry->files;
                }
                $this->entries()->insert($newEntry);
                $this->rooms()->where('id', $room->id)->update(['current_entry_id' => $newEntry['id']]);
            } elseif ($action === 'delete') {
                $removedFiles = json_decode($entry->files, true, 512, JSON_THROW_ON_ERROR);
                if ($entry->id === $room->current_entry_id) {
                    $newEntry = $this->emptyEntry($room->id);
                    $this->entries()->insert($newEntry);
                    $this->rooms()->where('id', $room->id)->update(['current_entry_id' => $newEntry['id']]);
                }
                $this->entries()->where('id', $entry->id)->delete();
                foreach ($removedFiles as $removedFile) {
                    if (!$this->entries()->where('room_id', $room->id)->whereRaw('files::jsonb @> ?::jsonb', [
                        json_encode([['id' => $removedFile['id']]], JSON_THROW_ON_ERROR),
                    ])->exists()) {
                        $path = $this->filePath($removedFile['id']);
                        $this->db()->afterCommit(function () use ($path) {
                            FileSystemManager::delete($path);
                        });
                    }
                }
            } else {
                $files = json_decode($entry->files, true, 512, JSON_THROW_ON_ERROR);
                if ($action === 'text') {
                    $changes['text'] = (string) $request->input('text', '');
                    if ($changes['text'] === $entry->text) {
                        return ['changed' => false, 'revision' => (int) $room->revision];
                    }
                } elseif ($action === 'upload') {
                    foreach ($request->file('files', []) as $file) {
                        $id = (string) Str::uuid();
                        $path = $this->filePath($id);
                        abort_unless(FileSystemManager::copy($file->getPathname(), $path),
                            500, __('cloud_clipboard.upload_failed'));
                        $files[] = [
                            'id' => $id, 'original_name' => basename(str_replace('\\', '/', $file->getClientOriginalName())),
                            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
                            'size' => $file->getSize(), 'uploaded_at' => now()->toISOString(),
                        ];
                    }
                    $changes['files'] = json_encode($files, JSON_THROW_ON_ERROR);
                } elseif ($action === 'delete-file') {
                    abort_unless(collect($files)->contains('id', $fileId), 404, __('cloud_clipboard.file_missing'));
                    $changes['files'] = json_encode(array_values(array_filter($files,
                        fn ($file) => $file['id'] !== $fileId)), JSON_THROW_ON_ERROR);
                }
                $this->archive($entry);
                $changes['revision'] = (int) $entry->revision + 1;
                $changes['updated_at'] = now();
                $changes['editor_user_id'] = AuthHelper::requireAuth($request)?->getKey();
                $this->entries()->where('id', $entry->id)->update($changes);
            }
            $this->rooms()->where('id', $room->id)->update(['revision' => $revision, 'updated_at' => now()]);
            $room = $this->rooms()->where('id', $room->id)->first();

            return ['changed' => true, 'revision' => $revision, 'topics' => array_unique([$oldTopic, $this->topic($room)])];
        });

        if ($result['changed']) {
            MercurePublisher::publish(array_values($result['topics']), json_encode([
                'revision' => $result['revision'],
            ], JSON_THROW_ON_ERROR), true, Contract::get('event_type'));
        }
        unset($result['topics']);

        return $result;
    }

    private function filePath(string $id): string
    {
        return PathMapper::getLaravelUploadsDir(Contract::get('upload_subdirectory').'/'.$id);
    }

    public function file(Request $request): array
    {
        return $this->db()->transaction(function () use ($request) {
            $room = $this->room($request, true);
            $entry = $this->entries()->where('room_id', $room->id)->where('id', $request->input('entry_id'))->first();
            $files = $entry ? json_decode($entry->files, true, 512, JSON_THROW_ON_ERROR) : [];
            $file = collect($files)->firstWhere('id', $request->input('file_id'));
            $path = $file ? $this->filePath($file['id']) : '';

            abort_unless($file && FileSystemManager::isFile($path), 404, __('cloud_clipboard.file_missing'));

            return ['path' => $path, 'metadata' => $file];
        });
    }
}
